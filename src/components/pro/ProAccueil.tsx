import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  addDays,
  formatNextOpenSlot,
  isFullDayRange,
  nextOpenSlot,
  startOfDay,
  type NextOpenSlot,
} from '../../data/availability'
import {
  CATEGORIES,
  colorOf,
  type CategoryLabel,
} from '../../data/categories'
import { PLACES, slotsForSpecialty, type Place } from '../../data/places'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import {
  AvailFilter,
  FULL_DAY,
  isAvailActive,
  isWeekdaysFilter,
  type DayFilter,
  type TimeRange,
} from './AvailFilter'
import { MiniMap } from './MiniMap'
import { PlaceDetail } from './PlaceDetail'
import './ProAccueil.css'

type MobileView = 'list' | 'map'

function promoMetaDaysFromNow(days: number, suffix: string) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const label = d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
  return `Jusqu’au ${label} · ${suffix}`
}

const PROMO_EVENTS = [
  {
    kicker: 'Événement à venir !',
    title: '-20% sur votre première réservation chez Feel Haussmann',
    meta: promoMetaDaysFromNow(45, 'Cabines & studios'),
    center: 'Feel Haussmann',
  },
  {
    kicker: 'Promo du moment',
    title: 'Soirée découverte gratuite chez Studio Rivoli Collective',
    meta: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 12)
      const label = d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      return `${label} · 18h–21h · Places limitées`
    })(),
    center: 'Studio Rivoli Collective',
  },
  {
    kicker: 'Nouveau partenaire',
    title: 'Maison Vertu ouvre ses cabines premium à -15%',
    meta: promoMetaDaysFromNow(30, 'Réservation en ligne'),
    center: 'Maison Vertu',
  },
] as const

function findPlaceByCenter(places: Place[], center: string) {
  return (
    places.find((p) => p.name === center || p.center === center) ?? null
  )
}

const PROMO_ROTATE_MS = 5500

/** "Boulogne · 92100" → "92100 - Boulogne" */
function locationLabel(place: Place) {
  const [city, postal] = place.area.split('·').map((s) => s.trim())
  if (city && postal) return `${postal} - ${city}`
  return place.area
}

/** Options de scan « live » pour le filtre dispo — null = aucun filtre */
function availScanOpts(day: DayFilter, range: TimeRange) {
  const fullTime = isFullDayRange(range.start, range.end)
  if (day === 'all' && fullTime) return null
  if (isWeekdaysFilter(day) && day.length === 0 && fullTime) return null

  const time = fullTime
    ? {}
    : { rangeStart: range.start, rangeEnd: range.end }

  if (isWeekdaysFilter(day)) {
    return { weekdays: day, ...time }
  }
  if (day === 'today') {
    return { onlyDate: startOfDay(new Date()), ...time }
  }
  if (day === 'tomorrow') {
    return { onlyDate: startOfDay(addDays(new Date(), 1)), ...time }
  }
  if (day === 'week') {
    return { withinDays: 6, ...time }
  }
  if (day === 'all') {
    return { weekday: 'any' as const, ...time }
  }
  return { weekday: 'any' as const, ...time }
}

type ProAccueilProps = {
  openPlaceId?: string | null
  onOpenPlaceHandled?: () => void
}

export function ProAccueil({
  openPlaceId = null,
  onOpenPlaceHandled,
}: ProAccueilProps = {}) {
  const isMobile = useMediaQuery('(max-width: 900px)')
  const allPlaces = useMemo(() => PLACES, [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('list')

  const [specialty, setSpecialty] = useState<CategoryLabel | 'all'>('all')
  const [city, setCity] = useState<string>('all')
  const [appliedDay, setAppliedDay] = useState<DayFilter>('all')
  const [appliedRange, setAppliedRange] = useState<TimeRange>(FULL_DAY)
  const [promoIndex, setPromoIndex] = useState(0)
  const [promoPaused, setPromoPaused] = useState(false)

  const promo = PROMO_EVENTS[promoIndex]

  const locations = useMemo(() => {
    const set = new Set(allPlaces.map(locationLabel))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allPlaces])

  const places = useMemo(() => {
    const scan = availScanOpts(appliedDay, appliedRange)
    const matched = allPlaces
      .map((p) => {
        if (specialty !== 'all' && !p.specialties.includes(specialty)) {
          return null
        }
        if (city !== 'all' && locationLabel(p) !== city) return null

        const slots = slotsForSpecialty(p, specialty)
        const next = nextOpenSlot(p.id, slots, {
          ...(scan ?? { weekday: 'any' }),
          exceptions: p.slotExceptions,
          specialty,
        })
        if (scan && !next) return null
        return { place: p, next }
      })
      .filter(
        (row): row is { place: Place; next: NextOpenSlot | null } =>
          Boolean(row),
      )

    matched.sort((a, b) => {
      if (a.next && b.next) return a.next.at - b.next.at
      if (a.next) return -1
      if (b.next) return 1
      return 0
    })

    return matched.map(({ place, next }) => ({
      ...place,
      availability: next
        ? formatNextOpenSlot(next)
        : 'Aucune disponibilité',
    }))
  }, [allPlaces, specialty, city, appliedDay, appliedRange])

  const availSet = isAvailActive(appliedDay, appliedRange)
  const hasFilters = specialty !== 'all' || city !== 'all' || availSet

  const selected = places.find((p) => p.id === selectedId) ?? null
  const detail = allPlaces.find((p) => p.id === detailId) ?? null

  useEffect(() => {
    if (detail || promoPaused) return
    const id = window.setInterval(() => {
      setPromoIndex((i) => (i + 1) % PROMO_EVENTS.length)
    }, PROMO_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [detail, promoPaused])

  useEffect(() => {
    if (selectedId && !places.some((p) => p.id === selectedId)) {
      setSelectedId(null)
    }
  }, [places, selectedId])

  const openDetail = (id: string) => {
    setSelectedId(id)
    setDetailId(id)
  }

  useEffect(() => {
    if (!openPlaceId) return
    if (!allPlaces.some((p) => p.id === openPlaceId)) {
      onOpenPlaceHandled?.()
      return
    }
    openDetail(openPlaceId)
    onOpenPlaceHandled?.()
  }, [openPlaceId, allPlaces, onOpenPlaceHandled])

  const openPromoDetail = () => {
    const place = findPlaceByCenter(allPlaces, promo.center)
    if (place) openDetail(place.id)
  }

  const closeDetail = () => setDetailId(null)

  const resetFilters = () => {
    setSpecialty('all')
    setCity('all')
    setAppliedDay('all')
    setAppliedRange(FULL_DAY)
  }

  const layoutClass = [
    'pro-home__layout',
    detail ? 'is-detail' : '',
    isMobile && !detail ? `is-mobile-${mobileView}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="pro-home">
      {!detail && (
        <button
          type="button"
          className="pro-home__promo"
          aria-live="polite"
          aria-label={`Voir la fiche ${promo.center}`}
          onClick={openPromoDetail}
          onMouseEnter={() => setPromoPaused(true)}
          onMouseLeave={() => setPromoPaused(false)}
          onFocus={() => setPromoPaused(true)}
          onBlur={() => setPromoPaused(false)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={promo.kicker + promo.title}
              className="pro-home__promo-slide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="pro-home__promo-kicker">{promo.kicker}</span>
              <span className="pro-home__promo-title">{promo.title}</span>
              <span className="pro-home__promo-meta">{promo.meta}</span>
            </motion.span>
          </AnimatePresence>
        </button>
      )}

      <div className={layoutClass}>
        {!detail && (
          <>
            {isMobile && (
              <div className="pro-home__list-head">
                <div
                  className="pro-home__view-toggle"
                  role="tablist"
                  aria-label="Affichage"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileView === 'list'}
                    className={`pro-home__view-btn${mobileView === 'list' ? ' is-active' : ''}`}
                    onClick={() => setMobileView('list')}
                  >
                    Liste
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileView === 'map'}
                    className={`pro-home__view-btn${mobileView === 'map' ? ' is-active' : ''}`}
                    onClick={() => setMobileView('map')}
                  >
                    Carte
                  </button>
                </div>
              </div>
            )}

            <div className="pro-home__filters" role="search" aria-label="Filtres">
              <label
                className={`pro-home__filter${city !== 'all' ? ' is-set' : ''}`}
              >
                <span className="pro-home__filter-label">Lieu</span>
                <select
                  value={city}
                  aria-label="Lieu"
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="all">{isMobile ? 'Lieu' : 'Tous les lieux'}</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className={`pro-home__filter${specialty !== 'all' ? ' is-set' : ''}`}
                style={
                  specialty !== 'all'
                    ? ({
                        ['--filter-accent' as string]: colorOf(specialty),
                      } as CSSProperties)
                    : undefined
                }
              >
                <span className="pro-home__filter-label">Spécialité</span>
                <select
                  value={specialty}
                  aria-label="Spécialité"
                  onChange={(e) =>
                    setSpecialty(e.target.value as CategoryLabel | 'all')
                  }
                >
                  <option value="all">
                    {isMobile ? 'Spécialité' : 'Toutes'}
                  </option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.label} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>

              <AvailFilter
                day={appliedDay}
                range={appliedRange}
                compact={isMobile}
                onApply={(nextDay, nextRange) => {
                  setAppliedDay(nextDay)
                  setAppliedRange(nextRange)
                }}
              />

              {hasFilters && (
                <button
                  type="button"
                  className="pro-home__filter-reset"
                  onClick={resetFilters}
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </>
        )}

        <div className="pro-home__list-pane">
          <AnimatePresence initial={false}>
            {!detail && !(isMobile && mobileView === 'map') && (
              <motion.div
                key="list"
                className="pro-home__list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {places.length === 0 ? (
                  <p className="pro-home__empty">
                    Aucun espace ne correspond à ces filtres.
                    {hasFilters && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="pro-home__empty-reset"
                          onClick={resetFilters}
                        >
                          Tout afficher
                        </button>
                      </>
                    )}
                  </p>
                ) : (
                  <ul className="pro-home__cards">
                    {places.map((place) => (
                      <li key={place.id}>
                        <PlaceCard
                          place={place}
                          active={place.id === selectedId}
                          onHover={() => setSelectedId(place.id)}
                          onOpen={() => openDetail(place.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {detail && (
              <motion.div
                key="detail"
                className="pro-home__detail"
                initial={
                  isMobile && mobileView === 'map'
                    ? false
                    : { opacity: 0, y: 6 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <PlaceDetail
                  place={detail}
                  onBack={closeDetail}
                  initialSpecialty={specialty}
                  initialDay={appliedDay}
                  initialRange={appliedRange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside
          className="pro-home__map-pane"
          hidden={Boolean(detail) || (isMobile && mobileView !== 'map')}
          aria-hidden={Boolean(detail) || (isMobile && mobileView !== 'map')}
        >
          <MiniMap
            places={places}
            selectedId={selected?.id ?? detailId}
            onSelect={openDetail}
            active={!detail && (!isMobile || mobileView === 'map')}
          />
        </aside>
      </div>
    </div>
  )
}

function PlaceCard({
  place,
  active,
  onHover,
  onOpen,
}: {
  place: Place
  active: boolean
  onHover: () => void
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className={`pro-card${active ? ' is-active' : ''}`}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onOpen}
    >
      <div
        className="pro-card__media"
        style={{ backgroundImage: `url(${place.image})` }}
      />
      <div className="pro-card__body">
        <ul className="pro-card__specs" aria-label="Spécialités">
          {place.specialties.slice(0, 3).map((spec) => (
            <li
              key={spec}
              className="pro-spec"
              style={{ ['--spec-color' as string]: colorOf(spec) }}
            >
              {spec}
            </li>
          ))}
          {place.specialties.length > 3 && (
            <li className="pro-spec pro-spec--more">
              +{place.specialties.length - 3}
            </li>
          )}
        </ul>
        <h2 className="pro-card__name">{place.name}</h2>
        <p className="pro-card__area">{place.area}</p>
        <div className="pro-card__row">
          <span className="pro-card__price">{place.priceFrom}</span>
          <span className="pro-card__avail">{place.availability}</span>
        </div>
      </div>
    </button>
  )
}

