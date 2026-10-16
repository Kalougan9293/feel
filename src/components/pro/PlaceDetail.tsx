import { AnimatePresence, motion } from 'framer-motion'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AVAIL_HORIZON_MONTHS,
  WEEK_DAYS,
  buildMonthGrid,
  exceptionForSlot,
  exceptionMatchesSpecialty,
  formatMinutes,
  monthLabel,
  openSlotsOnDate,
  sameDay,
  startOfDay,
  toDateKey,
  weeklyMinutesOnDate,
  type SlotException,
} from '../../data/availability'
import { colorOf, type CategoryLabel } from '../../data/categories'
import {
  PLACE_MEDIA_MAX,
  descriptionForSpecialty,
  priceForDuration,
  pricingForSpecialty,
  slotsForSpecialty,
  type Place,
} from '../../data/places'
import {
  AvailFilter,
  DEFAULT_DURATION_MINUTES,
  DURATION_OPTIONS,
  FULL_DAY,
  dateMatchesDayFilter,
  startSlotsForDuration,
  type DayFilter,
  type TimeRange,
} from './AvailFilter'
import { useProAccount } from './ProAccountContext'

/** Aperçu fiche : au-delà, la liste devient trop longue */
const CLIENTS_LIST_LIMIT = 8

const HOUR_PRICING_ROWS: {
  key: keyof Place['pricing']
  label: string
}[] = [
  { key: 'hour', label: '1 h' },
  { key: 'hours2', label: '2 h' },
  { key: 'hours3', label: '3 h' },
  { key: 'hours4', label: '4 h' },
]

const FROM_PRICING_ROWS: {
  key: keyof Place['pricing']
  label: string
}[] = [
  { key: 'day', label: 'Journée' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'semester', label: 'Semestre' },
  { key: 'year', label: 'Année' },
]

function addMonths(date: Date, n: number) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1)
  return d
}

function clampMonth(view: Date, now: Date) {
  const min = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const max = addMonths(min, AVAIL_HORIZON_MONTHS - 1)
  if (view < min) return min
  if (view > max) return max
  return new Date(view.getFullYear(), view.getMonth(), 1)
}

/** Description centre : paragraphes + puces optionnelles (`- …`) */
function parseDescription(raw: string) {
  const paragraphs: string[] = []
  const bullets: string[] = []

  for (const block of raw.split(/\n\s*\n/)) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue

    const onlyBullets = lines.every((l) => l.startsWith('- ') || l.startsWith('• '))
    if (onlyBullets) {
      for (const l of lines) {
        bullets.push(l.replace(/^[-•]\s+/, ''))
      }
    } else {
      paragraphs.push(lines.join(' '))
    }
  }

  return { paragraphs, bullets }
}

function slotsLevel(open: number[]): 'none' | 'open' {
  return open.length === 0 ? 'none' : 'open'
}

export type PlaceDetailSectionActions = {
  gallery?: ReactNode
  identity?: ReactNode
  contact?: ReactNode
  calendar?: ReactNode
  description?: ReactNode
  specialty?: ReactNode
  pricing?: ReactNode
}

type PlaceDetailProps = {
  place: Place
  onBack: () => void
  initialSpecialty?: CategoryLabel | 'all'
  initialDay?: DayFilter
  initialRange?: TimeRange
  /** Aperçu hors compte pro (ex. fiche propriétaire) */
  preview?: boolean
  hideFavorite?: boolean
  backLabel?: string
  /** Boutons d’édition (fiche propriétaire) */
  sectionActions?: PlaceDetailSectionActions
  /** Gestion jour par jour des blocages (fiche propriétaire) */
  onSlotExceptionsChange?: (next: SlotException[]) => void
  /** Réservations à afficher sur l’agenda (fiche propriétaire) */
  bookings?: PlaceAgendaBooking[]
  /** Événements gérés côté propriétaire */
  events?: PlaceEventItem[]
  onEventsChange?: (next: PlaceEventItem[]) => void
}

export type PlaceEventItem = {
  id: string
  title: string
  description: string
}

export type PlaceAgendaBooking = {
  id: string
  proName: string
  specialty: string
  day: Date
  startMinutes: number
  durationMin: number
  status: 'confirmed' | 'pending' | 'no_show' | 'cancelled'
  price?: number
  accessCode?: string
  accessKind?: 'code' | 'qr'
}

function bookingCoversMinutes(
  booking: Pick<PlaceAgendaBooking, 'startMinutes' | 'durationMin'>,
  minutes: number,
): boolean {
  return (
    minutes >= booking.startMinutes &&
    minutes < booking.startMinutes + booking.durationMin
  )
}

export function PlaceDetail(props: PlaceDetailProps) {
  if (props.preview) {
    return (
      <PlaceDetailView
        {...props}
        favorited={false}
        onToggleFavorite={() => {}}
        onAddBooking={() => {}}
      />
    )
  }
  return <PlaceDetailLive {...props} />
}

function PlaceDetailLive(props: PlaceDetailProps) {
  const { isFavorite, toggleFavorite, addBooking } = useProAccount()
  return (
    <PlaceDetailView
      {...props}
      favorited={isFavorite(props.place.id)}
      onToggleFavorite={() => toggleFavorite(props.place.id)}
      onAddBooking={addBooking}
    />
  )
}

function PlaceDetailView({
  place,
  onBack,
  initialSpecialty = 'all',
  initialDay = 'all',
  initialRange = FULL_DAY,
  preview = false,
  hideFavorite = false,
  backLabel = '← Retour à la liste',
  sectionActions,
  onSlotExceptionsChange,
  bookings = [],
  events = [],
  onEventsChange,
  favorited,
  onToggleFavorite,
  onAddBooking,
}: PlaceDetailProps & {
  favorited: boolean
  onToggleFavorite: () => void
  onAddBooking: ReturnType<typeof useProAccount>['addBooking']
}) {
  const now = useMemo(() => new Date(), [])
  const canManageDaySlots = Boolean(preview && onSlotExceptionsChange)
  const canManageEvents = Boolean(preview && onEventsChange)
  const [eventDraftOpen, setEventDraftOpen] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [monthCursor, setMonthCursor] = useState(() =>
    new Date(now.getFullYear(), now.getMonth(), 1),
  )
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(now))
  const [noteFocusMinutes, setNoteFocusMinutes] = useState<number | null>(null)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1)
  const [booking, setBooking] = useState<{
    specialty: CategoryLabel
    day: Date
    startMinutes: number
    durationMin: number
  } | null>(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const [calSpecialty, setCalSpecialty] = useState<CategoryLabel | 'all'>(() => {
    if (
      initialSpecialty !== 'all' &&
      place.specialties.includes(initialSpecialty)
    ) {
      return initialSpecialty
    }
    return 'all'
  })
  const manageDaySlots = canManageDaySlots
  const activeSpecColor =
    calSpecialty !== 'all' ? colorOf(calSpecialty) : '#4a9b6e'
  const slotOptions = useMemo(
    () => ({
      exceptions: place.slotExceptions,
      specialty: calSpecialty,
      skipLiveDemo: canManageDaySlots,
    }),
    [place.slotExceptions, calSpecialty, canManageDaySlots],
  )
  const [calDay, setCalDay] = useState<DayFilter>(initialDay)
  const [calRange, setCalRange] = useState<TimeRange>(initialRange)
  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION_MINUTES)

  const media = (
    place.media.length > 0
      ? place.media
      : [
          {
            id: 'cover',
            kind: 'image' as const,
            src: place.image,
            alt: place.name,
          },
        ]
  ).slice(0, PLACE_MEDIA_MAX)
  const activeMedia = media[Math.min(mediaIndex, media.length - 1)]

  useEffect(() => {
    const root = thumbsRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>('[aria-selected="true"]')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [mediaIndex])

  const touchStartX = useRef<number | null>(null)

  function onGalleryTouchStart(e: ReactTouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  function onGalleryTouchEnd(e: ReactTouchEvent) {
    if (media.length < 2 || touchStartX.current == null) return
    const endX = e.changedTouches[0]?.clientX
    if (endX == null) return
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 40) return
    setMediaIndex((i) =>
      delta < 0
        ? (i + 1) % media.length
        : (i - 1 + media.length) % media.length,
    )
  }

  const activeSlots = useMemo(
    () => slotsForSpecialty(place, calSpecialty),
    [place, calSpecialty],
  )

  useEffect(() => {
    setMediaIndex(0)
    setCalSpecialty(
      initialSpecialty !== 'all' &&
        place.specialties.includes(initialSpecialty)
        ? initialSpecialty
        : 'all',
    )
    setCalDay(initialDay)
    setCalRange(initialRange)
    setDurationMin(DEFAULT_DURATION_MINUTES)
  }, [place.id, place.specialties, initialSpecialty, initialDay, initialRange])

  const minMonth = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
    [now],
  )
  const maxMonth = useMemo(
    () => addMonths(minMonth, AVAIL_HORIZON_MONTHS - 1),
    [minMonth],
  )

  const canPrev = monthCursor > minMonth
  const canNext = monthCursor < maxMonth

  const grid = useMemo(
    () => buildMonthGrid(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor],
  )

  const selectedInViewedMonth =
    selectedDay.getFullYear() === monthCursor.getFullYear() &&
    selectedDay.getMonth() === monthCursor.getMonth()

  const daySlots = useMemo(() => {
    if (!dateMatchesDayFilter(selectedDay, calDay, now)) return []
    const open = openSlotsOnDate(
      place.id,
      activeSlots,
      selectedDay,
      now,
      slotOptions,
    )
    return startSlotsForDuration(open, durationMin, calRange)
  }, [
    place.id,
    activeSlots,
    selectedDay,
    now,
    calDay,
    calRange,
    durationMin,
    slotOptions,
  ])

  const ownerDayMinutes = useMemo(
    () =>
      manageDaySlots ? weeklyMinutesOnDate(activeSlots, selectedDay) : [],
    [manageDaySlots, activeSlots, selectedDay],
  )

  const selectedDateKey = useMemo(
    () => toDateKey(selectedDay),
    [selectedDay],
  )

  /** Points calendrier : tous les RDV en « Tous », sinon filtrés par spécialité */
  const visibleBookings = useMemo(() => {
    if (!bookings.length) return []
    return bookings.filter((b) => {
      if (b.status === 'cancelled') return false
      if (calSpecialty === 'all') return true
      return b.specialty === calSpecialty
    })
  }, [bookings, calSpecialty])

  const bookingsByDayKey = useMemo(() => {
    const map = new Map<string, PlaceAgendaBooking[]>()
    for (const b of visibleBookings) {
      const key = toDateKey(b.day)
      const list = map.get(key)
      if (list) list.push(b)
      else map.set(key, [b])
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startMinutes - b.startMinutes)
    }
    return map
  }, [visibleBookings])

  const selectedDayBookings = useMemo(
    () => bookingsByDayKey.get(selectedDateKey) ?? [],
    [bookingsByDayKey, selectedDateKey],
  )

  /** RDV du jour pour la gestion (y compris vue « Tous ») */
  const dayBookingsForManage = useMemo(
    () =>
      bookings
        .filter((b) => {
          if (toDateKey(b.day) !== selectedDateKey) return false
          if (calSpecialty === 'all') return true
          return b.specialty === calSpecialty
        })
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [bookings, selectedDateKey, calSpecialty],
  )

  const upcomingClients = useMemo(() => {
    const nowMs = now.getTime()
    return [...bookings]
      .filter((b) => {
        if (b.status === 'cancelled') return false
        const end =
          startOfDay(b.day).getTime() +
          (b.startMinutes + b.durationMin) * 60_000
        return end >= nowMs
      })
      .sort((a, b) => {
        const aAt = startOfDay(a.day).getTime() + a.startMinutes * 60_000
        const bAt = startOfDay(b.day).getTime() + b.startMinutes * 60_000
        return aAt - bAt
      })
  }, [bookings, now])

  useEffect(() => {
    setNoteFocusMinutes(null)
    setSlotError(null)
  }, [selectedDateKey, calSpecialty])

  function patchExceptions(mutator: (list: SlotException[]) => SlotException[]) {
    if (!onSlotExceptionsChange) return
    onSlotExceptionsChange(mutator([...(place.slotExceptions ?? [])]))
  }

  function isSameOwnerException(e: SlotException, minutes: number) {
    if (e.date !== selectedDateKey || e.minutes !== minutes) return false
    if (calSpecialty === 'all') return e.specialty == null
    return exceptionMatchesSpecialty(e, calSpecialty)
  }

  function ownerExceptionPayload(
    minutes: number,
    note = '',
  ): SlotException {
    return calSpecialty === 'all'
      ? { date: selectedDateKey, minutes, note }
      : {
          date: selectedDateKey,
          minutes,
          specialty: calSpecialty,
          note,
        }
  }

  function bookingOnOwnerSlot(minutes: number) {
    return bookings.find((b) => {
      if (toDateKey(b.day) !== selectedDateKey) return false
      if (!bookingCoversMinutes(b, minutes)) return false
      if (calSpecialty === 'all') return true
      return b.specialty === calSpecialty
    })
  }

  function toggleOwnerSlot(minutes: number) {
    const booked = bookingOnOwnerSlot(minutes)
    const existing = exceptionForSlot(
      place.slotExceptions,
      selectedDateKey,
      minutes,
      calSpecialty,
    )
    if (booked && !existing) {
      setSlotError(
        'Impossible de fermer ce créneau car un RDV est déjà pris.',
      )
      return
    }
    setSlotError(null)
    if (existing) {
      if (noteFocusMinutes === minutes) {
        patchExceptions((list) =>
          list.filter((e) => !isSameOwnerException(e, minutes)),
        )
        setNoteFocusMinutes(null)
      } else {
        setNoteFocusMinutes(minutes)
      }
      return
    }
    patchExceptions((list) => [...list, ownerExceptionPayload(minutes)])
    setNoteFocusMinutes(minutes)
  }

  function setOwnerSlotNote(minutes: number, note: string) {
    patchExceptions((list) => {
      const idx = list.findIndex((e) => isSameOwnerException(e, minutes))
      if (idx < 0) {
        return [...list, ownerExceptionPayload(minutes, note)]
      }
      const next = [...list]
      next[idx] = { ...next[idx], ...ownerExceptionPayload(minutes, note) }
      return next
    })
  }

  function unblockOwnerSlot(minutes: number) {
    patchExceptions((list) =>
      list.filter((e) => !isSameOwnerException(e, minutes)),
    )
    setNoteFocusMinutes((m) => (m === minutes ? null : m))
  }

  function blockOwnerDay() {
    const freeMinutes = ownerDayMinutes.filter(
      (minutes) => !bookingOnOwnerSlot(minutes),
    )
    const blockedByBooking = ownerDayMinutes.length - freeMinutes.length
    if (freeMinutes.length === 0) {
      setSlotError(
        'Impossible de fermer cette journée : tous les créneaux ont déjà un RDV.',
      )
      return
    }
    patchExceptions((list) => {
      const others = list.filter((e) => {
        if (e.date !== selectedDateKey) return true
        if (calSpecialty === 'all') return e.specialty != null
        return !exceptionMatchesSpecialty(e, calSpecialty)
      })
      const keptNotes = new Map(
        list
          .filter((e) => {
            if (e.date !== selectedDateKey) return false
            if (calSpecialty === 'all') return e.specialty == null
            return exceptionMatchesSpecialty(e, calSpecialty)
          })
          .map((e) => [e.minutes, e.note ?? '']),
      )
      return [
        ...others,
        ...freeMinutes.map((minutes) =>
          ownerExceptionPayload(minutes, keptNotes.get(minutes) ?? ''),
        ),
      ]
    })
    setSlotError(
      blockedByBooking > 0
        ? 'Journée fermée sauf les créneaux déjà réservés.'
        : null,
    )
  }

  function clearOwnerDayBlocks() {
    setSlotError(null)
    patchExceptions((list) =>
      list.filter((e) => {
        if (e.date !== selectedDateKey) return true
        if (calSpecialty === 'all') return e.specialty != null
        return !exceptionMatchesSpecialty(e, calSpecialty)
      }),
    )
    setNoteFocusMinutes(null)
  }

  const descriptionParts = useMemo(
    () => parseDescription(place.description),
    [place.description],
  )

  const activePricing = useMemo(
    () => pricingForSpecialty(place, calSpecialty),
    [place, calSpecialty],
  )
  const specialtyDescription = useMemo(
    () => descriptionForSpecialty(place, calSpecialty),
    [place, calSpecialty],
  )
  const specialtyDescParts = useMemo(
    () =>
      specialtyDescription ? parseDescription(specialtyDescription) : null,
    [specialtyDescription],
  )

  const durationLabel =
    DURATION_OPTIONS.find((d) => d.minutes === (booking?.durationMin ?? durationMin))
      ?.label ?? `${durationMin / 60} h`

  const bookingEndLabel = booking
    ? formatMinutes(booking.startMinutes + booking.durationMin)
    : ''

  const bookingPrice = booking
    ? priceForDuration(
        pricingForSpecialty(place, booking.specialty),
        booking.durationMin,
      )
    : 0

  const closeBooking = () => {
    setBooking(null)
    setBookingStep(1)
  }

  const confirmBooking = () => {
    if (!booking || preview) return
    onAddBooking({
      placeId: place.id,
      placeName: place.name,
      specialty: booking.specialty,
      day: booking.day,
      startMinutes: booking.startMinutes,
      durationMin: booking.durationMin,
      price: bookingPrice,
    })
    closeBooking()
  }

  const startBooking = (startMinutes: number) => {
    if (preview) return
    const specialty =
      calSpecialty !== 'all'
        ? calSpecialty
        : (place.specialties[0] ?? null)
    if (!specialty) return
    if (calSpecialty === 'all') setCalSpecialty(specialty)
    setBooking({
      specialty,
      day: startOfDay(selectedDay),
      startMinutes,
      durationMin,
    })
    setBookingStep(1)
  }

  return (
    <article className={`pro-detail${preview ? ' is-preview' : ''}`}>
      <button type="button" className="pro-detail__back" onClick={onBack}>
        {backLabel}
      </button>

      <div
        className={`pro-detail__gallery${media.length > 1 ? ' has-thumbs' : ''}${sectionActions?.gallery ? ' has-actions' : ''}`}
      >
        <div
          className="pro-detail__gallery-main"
          onTouchStart={onGalleryTouchStart}
          onTouchEnd={onGalleryTouchEnd}
        >
          {sectionActions?.gallery && (
            <div className="pro-detail__section-action is-gallery">
              {sectionActions.gallery}
            </div>
          )}
          {activeMedia.kind === 'video' ? (
            <div
              className="pro-detail__gallery-frame is-video"
              style={{ backgroundImage: `url(${activeMedia.src})` }}
              role="img"
              aria-label={activeMedia.alt ?? 'Vidéo'}
            >
              <span className="pro-detail__gallery-play" aria-hidden>
                ▶
              </span>
              <span className="pro-detail__gallery-badge">Vidéo</span>
              {activeMedia.specialty && (
                <span
                  className="pro-detail__gallery-spec"
                  style={
                    {
                      ['--spec-color' as string]: colorOf(activeMedia.specialty),
                    } as CSSProperties
                  }
                >
                  {activeMedia.specialty}
                </span>
              )}
            </div>
          ) : (
            <div
              className="pro-detail__gallery-frame"
              style={{ backgroundImage: `url(${activeMedia.src})` }}
              role="img"
              aria-label={activeMedia.alt ?? place.name}
            >
              {activeMedia.specialty && (
                <span
                  className="pro-detail__gallery-spec"
                  style={
                    {
                      ['--spec-color' as string]: colorOf(activeMedia.specialty),
                    } as CSSProperties
                  }
                >
                  {activeMedia.specialty}
                </span>
              )}
            </div>
          )}

          {media.length > 1 && (
            <>
              <button
                type="button"
                className="pro-detail__gallery-nav is-prev"
                aria-label="Média précédent"
                onClick={() =>
                  setMediaIndex((i) => (i - 1 + media.length) % media.length)
                }
              >
                ‹
              </button>
              <button
                type="button"
                className="pro-detail__gallery-nav is-next"
                aria-label="Média suivant"
                onClick={() =>
                  setMediaIndex((i) => (i + 1) % media.length)
                }
              >
                ›
              </button>
            </>
          )}
        </div>

        {media.length > 1 && (
          <div
            ref={thumbsRef}
            className="pro-detail__gallery-thumbs"
            role="tablist"
            aria-label="Médias du lieu"
          >
            {media.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={idx === mediaIndex}
                aria-label={item.alt ?? `Média ${idx + 1}`}
                className={`pro-detail__gallery-thumb${idx === mediaIndex ? ' is-active' : ''}${item.kind === 'video' ? ' is-video' : ''}`}
                style={{ backgroundImage: `url(${item.src})` }}
                onClick={() => setMediaIndex(idx)}
              >
                {item.kind === 'video' && (
                  <span className="pro-detail__gallery-thumb-play" aria-hidden>
                    ▶
                  </span>
                )}
                {item.specialty && (
                  <span
                    className="pro-detail__gallery-spec is-thumb"
                    style={
                      {
                        ['--spec-color' as string]: colorOf(item.specialty),
                      } as CSSProperties
                    }
                  >
                    {item.specialty}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pro-detail__body">
        <div className="pro-detail__top">
          <div className="pro-detail__identity">
            <div className="pro-detail__name-row">
              <h2 className="pro-detail__name">{place.name}</h2>
              {sectionActions?.identity}
              {!hideFavorite && (
                <button
                  type="button"
                  className={`pro-detail__fav${favorited ? ' is-on' : ''}`}
                  aria-pressed={favorited}
                  aria-label={
                    favorited
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                  }
                  onClick={onToggleFavorite}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 20.2 10.55 18.9C5.4 14.25 2 11.2 2 7.5 2 4.5 4.4 2.2 7.35 2.2c1.7 0 3.35.8 4.4 2.05C12.8 3 14.45 2.2 16.15 2.2 19.1 2.2 21.5 4.5 21.5 7.5c0 3.7-3.4 6.75-8.55 11.4L12 20.2Z"
                      fill={favorited ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="pro-detail__address">{place.address}</p>
          </div>

          <div className="pro-detail__contact" aria-label="Contact">
            <div className="pro-detail__contact-btns">
              {place.contact.emailVisible !== false &&
                place.contact.mailHref !== '#' && (
                <a
                  className="pro-detail__contact-btn"
                  href={place.contact.mailHref}
                  title={`Écrire à ${place.contact.email}`}
                  aria-label="Envoyer un e-mail"
                >
                  <span aria-hidden>✉️</span>
                </a>
              )}
              {place.contact.phoneVisible !== false &&
                place.contact.phoneHref !== '#' && (
                <a
                  className="pro-detail__contact-btn"
                  href={place.contact.phoneHref}
                  title={`Appeler ${place.contact.phone}`}
                  aria-label="Appeler"
                >
                  <span aria-hidden>📞</span>
                </a>
              )}
              {sectionActions?.contact}
            </div>
            {(place.contact.emailVisible !== false &&
              place.contact.mailHref !== '#') ||
            (place.contact.phoneVisible !== false &&
              place.contact.phoneHref !== '#') ? (
              <p className="pro-detail__visit-hint">
                Besoin de visiter avant en physique ou en visio ? Contactez
                l’accueil
              </p>
            ) : null}
          </div>
        </div>

        <div className="pro-detail__booking">
          {!preview && (
            <div
              className="pro-detail__cal-filters"
              role="search"
              aria-label="Filtres calendrier"
            >
              <label
                className={`pro-home__filter${calSpecialty !== 'all' ? ' is-set' : ''}`}
                style={
                  calSpecialty !== 'all'
                    ? ({
                        ['--filter-accent' as string]: colorOf(calSpecialty),
                      } as CSSProperties)
                    : undefined
                }
              >
                <span className="pro-home__filter-label">Spécialité</span>
                <select
                  value={calSpecialty}
                  aria-label="Spécialité"
                  onChange={(e) =>
                    setCalSpecialty(e.target.value as CategoryLabel | 'all')
                  }
                >
                  <option value="all">Toutes</option>
                  {place.specialties.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </label>

              <AvailFilter
                day={calDay}
                range={calRange}
                onApply={(nextDay, nextRange) => {
                  setCalDay(nextDay)
                  setCalRange(nextRange)
                }}
              />

              <label
                className={`pro-home__filter${durationMin !== DEFAULT_DURATION_MINUTES ? ' is-set' : ''}`}
              >
                <span className="pro-home__filter-label">Temps voulu</span>
                <select
                  value={durationMin}
                  aria-label="Temps voulu"
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.minutes} value={opt.minutes}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <section
            className="pro-detail__calendar"
            aria-label="Disponibilités"
            style={
              {
                ['--day-accent' as string]: activeSpecColor,
              } as CSSProperties
            }
          >
            {preview && (
              <ul className="pro-detail__cal-specs" aria-label="Spécialités">
                <li>
                  <button
                    type="button"
                    className={`pro-spec${calSpecialty === 'all' ? ' is-active' : ''}`}
                    style={
                      {
                        ['--spec-color' as string]: '#4a9b6e',
                      } as CSSProperties
                    }
                    aria-pressed={calSpecialty === 'all'}
                    onClick={() => setCalSpecialty('all')}
                  >
                    Tous
                  </button>
                </li>
                {place.specialties.map((spec) => (
                  <li key={spec}>
                    <button
                      type="button"
                      className={`pro-spec${calSpecialty === spec ? ' is-active' : ''}`}
                      style={
                        {
                          ['--spec-color' as string]: colorOf(spec),
                        } as CSSProperties
                      }
                      aria-pressed={calSpecialty === spec}
                      onClick={() => setCalSpecialty(spec)}
                    >
                      {spec}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div
              className={`pro-detail__month-nav${sectionActions?.calendar ? ' has-action' : ''}`}
            >
              <div className="pro-detail__month-nav-core">
                <button
                  type="button"
                  className="pro-detail__month-btn"
                  disabled={!canPrev}
                  aria-label="Mois précédent"
                  onClick={() =>
                    setMonthCursor((m) => clampMonth(addMonths(m, -1), now))
                  }
                >
                  ‹
                </button>
                <p className="pro-detail__month-label">
                  {selectedInViewedMonth ? (
                    <>
                      {selectedDay.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                      {preview
                        ? calSpecialty === 'all'
                          ? ' · Tous'
                          : ` · ${calSpecialty}`
                        : ''}
                    </>
                  ) : (
                    monthLabel(monthCursor)
                  )}
                </p>
                <button
                  type="button"
                  className="pro-detail__month-btn"
                  disabled={!canNext}
                  aria-label="Mois suivant"
                  onClick={() =>
                    setMonthCursor((m) => clampMonth(addMonths(m, 1), now))
                  }
                >
                  ›
                </button>
              </div>
              {sectionActions?.calendar}
            </div>

            <div className="pro-detail__weekday-row" aria-hidden>
              {WEEK_DAYS.map((d) => (
                <span key={d.value}>{d.short}</span>
              ))}
            </div>

            <div className="pro-detail__day-grid" role="grid">
              {grid.map((cell, i) => {
                if (!cell) {
                  return (
                    <span key={`e-${i}`} className="pro-detail__day is-empty" />
                  )
                }
                const isPast = startOfDay(cell) < startOfDay(now)
                const inFilter = dateMatchesDayFilter(cell, calDay, now)
                const weekly = weeklyMinutesOnDate(activeSlots, cell)
                const openMins = inFilter
                  ? openSlotsOnDate(
                      place.id,
                      activeSlots,
                      cell,
                      now,
                      slotOptions,
                    )
                  : []
                // Proprio : couleur = créneaux encore libres (sans filtre durée résa).
                // Pro : couleur = débuts possibles pour la durée choisie.
                const starts = manageDaySlots
                  ? openMins
                  : startSlotsForDuration(openMins, durationMin, calRange)
                const level = isPast || !inFilter ? 'none' : slotsLevel(starts)
                const selected =
                  selectedInViewedMonth && sameDay(cell, selectedDay)
                const dayHasBooking = bookingsByDayKey.has(toDateKey(cell))
                const canSelect =
                  manageDaySlots
                    ? !isPast && (weekly.length > 0 || dayHasBooking)
                    : (level !== 'none' || dayHasBooking) && !isPast
                return (
                  <button
                    key={cell.toISOString()}
                    type="button"
                    role="gridcell"
                    disabled={!canSelect}
                    className={[
                      'pro-detail__day',
                      `is-${level}`,
                      selected ? 'is-selected' : '',
                      sameDay(cell, now) ? 'is-today' : '',
                      dayHasBooking ? 'has-booking' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedDay(startOfDay(cell))}
                  >
                    {cell.getDate()}
                    {dayHasBooking ? (
                      <i className="pro-detail__day-dot" aria-hidden />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="pro-detail__day-slots">
              {selectedInViewedMonth &&
              (manageDaySlots
                ? dayBookingsForManage
                : selectedDayBookings
              ).length > 0 && (
                <ul className="pro-detail__day-bookings">
                  {(manageDaySlots
                    ? dayBookingsForManage
                    : selectedDayBookings
                  ).map((b) => (
                    <li key={b.id}>
                      <div className="pro-detail__day-bookings-main">
                        <strong>
                          {formatMinutes(b.startMinutes)} –{' '}
                          {formatMinutes(b.startMinutes + b.durationMin)}
                        </strong>
                        <span>{b.proName}</span>
                        <span>
                          {b.specialty}
                          {b.status === 'pending' ? ' · En attente' : ''}
                        </span>
                      </div>
                      {b.price != null ? <em>{b.price}€</em> : null}
                    </li>
                  ))}
                </ul>
              )}
              {!selectedInViewedMonth ? (
                <p className="pro-detail__day-slots-empty">
                  Cliquez un jour pour voir les créneaux.
                </p>
              ) : manageDaySlots ? (
                ownerDayMinutes.length === 0 ? (
                  <p className="pro-detail__day-slots-empty">
                    Aucun créneau dans les horaires généraux pour ce jour.
                  </p>
                ) : (
                  <>
                    <div className="pro-detail__day-slots-actions">
                      <button
                        type="button"
                        className="pro-detail__day-slots-action"
                        onClick={blockOwnerDay}
                      >
                        Bloquer la journée
                      </button>
                      <button
                        type="button"
                        className="pro-detail__day-slots-action"
                        onClick={clearOwnerDayBlocks}
                      >
                        Tout libérer
                      </button>
                    </div>
                    {slotError ? (
                      <p className="pro-detail__slot-error" role="alert">
                        {slotError}
                      </p>
                    ) : null}
                    <div className="pro-detail__slot-list">
                      {ownerDayMinutes.map((mins) => {
                        const booked = dayBookingsForManage.find((b) =>
                          bookingCoversMinutes(b, mins),
                        )
                        const ex = exceptionForSlot(
                          place.slotExceptions,
                          selectedDateKey,
                          mins,
                          calSpecialty,
                        )
                        const blocked = Boolean(ex) && !booked
                        const focused = noteFocusMinutes === mins
                        const note = ex?.note?.trim() ?? ''
                        return (
                          <button
                            key={mins}
                            type="button"
                            className={[
                              'pro-detail__slot',
                              booked
                                ? 'is-booked'
                                : blocked
                                  ? 'is-blocked'
                                  : 'is-open',
                              focused ? 'is-note-focus' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            title={
                              booked
                                ? `${booked.proName} · ${booked.specialty}`
                                : note
                                  ? note
                                  : blocked
                                    ? 'Bloqué — cliquer pour noter ou libérer'
                                    : 'Disponible — cliquer pour bloquer'
                            }
                            onClick={() => {
                              if (booked) return
                              toggleOwnerSlot(mins)
                            }}
                          >
                            <span className="pro-detail__slot-time">
                              {formatMinutes(mins)}
                            </span>
                            {!booked && note ? (
                              <span className="pro-detail__slot-note-preview">
                                {note}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    {noteFocusMinutes != null &&
                      exceptionForSlot(
                        place.slotExceptions,
                        selectedDateKey,
                        noteFocusMinutes,
                        calSpecialty,
                      ) && (
                        <div className="pro-detail__slot-note">
                          <label>
                            Note · {formatMinutes(noteFocusMinutes)}
                            <input
                              type="text"
                              value={
                                exceptionForSlot(
                                  place.slotExceptions,
                                  selectedDateKey,
                                  noteFocusMinutes,
                                  calSpecialty,
                                )?.note ?? ''
                              }
                              placeholder="Travaux, visite, Mme Martin 06…"
                              onChange={(e) =>
                                setOwnerSlotNote(
                                  noteFocusMinutes,
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="pro-detail__slot-note-free"
                            onClick={() => unblockOwnerSlot(noteFocusMinutes)}
                          >
                            Libérer ce créneau
                          </button>
                        </div>
                      )}
                  </>
                )
              ) : daySlots.length === 0 ? (
                <p className="pro-detail__day-slots-empty">
                  Aucun créneau libre ce jour-là.
                </p>
              ) : (
                <div className="pro-detail__slot-list">
                  {daySlots.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className="pro-detail__slot"
                      disabled={preview}
                      onClick={() => startBooking(mins)}
                    >
                      {formatMinutes(mins)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="pro-detail__booking-aside">
            <section className="pro-detail__block">
              <div className="pro-detail__block-head">
                <h3 className="pro-detail__section-title">Description</h3>
                {sectionActions?.description}
              </div>
              <div className="pro-detail__description">
                {descriptionParts.paragraphs.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
                {descriptionParts.bullets.length > 0 && (
                  <ul>
                    {descriptionParts.bullets.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="pro-detail__block">
              <div className="pro-detail__block-head">
                <h3 className="pro-detail__section-title">
                  Spécialité
                  {calSpecialty !== 'all' ? ` · ${calSpecialty}` : ''}
                </h3>
                {sectionActions?.specialty}
              </div>
              {specialtyDescParts ? (
                <div className="pro-detail__description">
                  {specialtyDescParts.paragraphs.map((text, i) => (
                    <p key={i}>{text}</p>
                  ))}
                  {specialtyDescParts.bullets.length > 0 && (
                    <ul>
                      {specialtyDescParts.bullets.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="pro-detail__price-hint">
                  Sélectionnez une spécialité pour voir la description de
                  l’espace.
                </p>
              )}
            </section>

            <section className="pro-detail__block pro-detail__tarif">
              <div className="pro-detail__block-head is-tarif">
                <button
                  type="button"
                  className="pro-detail__pricing-link"
                  onClick={() => {
                    if (calSpecialty === 'all' && place.specialties[0]) {
                      setCalSpecialty(place.specialties[0])
                    }
                    setPricingOpen(true)
                  }}
                >
                  Grille tarifaire
                </button>
                {sectionActions?.pricing}
              </div>
            </section>

            {canManageDaySlots && (
              <section
                className="pro-detail__block pro-detail__clients"
                aria-labelledby="pro-detail-clients"
              >
                <h3
                  id="pro-detail-clients"
                  className="pro-detail__section-title"
                >
                  Mes prochains clients
                </h3>
                {upcomingClients.length === 0 ? (
                  <p className="pro-detail__clients-empty">
                    Aucun client à venir pour l’instant.
                  </p>
                ) : (
                  <>
                    <ul className="pro-detail__clients-list">
                      {upcomingClients
                        .slice(0, CLIENTS_LIST_LIMIT)
                        .map((b) => {
                          const specColor = colorOf(
                            place.specialties.includes(
                              b.specialty as CategoryLabel,
                            )
                              ? (b.specialty as CategoryLabel)
                              : null,
                          )
                          return (
                            <li
                              key={b.id}
                              style={
                                {
                                  ['--client-accent' as string]: specColor,
                                } as CSSProperties
                              }
                            >
                              <div className="pro-detail__clients-top">
                                <strong>{b.proName}</strong>
                                {b.price != null ? <em>{b.price}€</em> : null}
                              </div>
                              <div className="pro-detail__clients-main">
                                <span>
                                  {b.day.toLocaleDateString('fr-FR', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                                <span>
                                  {formatMinutes(b.startMinutes)}–
                                  {formatMinutes(
                                    b.startMinutes + b.durationMin,
                                  )}
                                  {' · '}
                                  {b.specialty}
                                  {b.status === 'pending'
                                    ? ' · Att.'
                                    : b.status === 'no_show'
                                      ? ' · No-show'
                                      : ''}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                    </ul>
                    {upcomingClients.length > CLIENTS_LIST_LIMIT ? (
                      <p className="pro-detail__clients-more">
                        + {upcomingClients.length - CLIENTS_LIST_LIMIT} autre
                        {upcomingClients.length - CLIENTS_LIST_LIMIT > 1
                          ? 's'
                          : ''}{' '}
                        à venir
                      </p>
                    ) : null}
                  </>
                )}
              </section>
            )}

            {canManageEvents && (
              <section
                className="pro-detail__block pro-detail__events"
                aria-labelledby="pro-detail-events"
              >
                <div className="pro-detail__block-head">
                  <h3
                    id="pro-detail-events"
                    className="pro-detail__section-title"
                  >
                    Événements
                  </h3>
                  <button
                    type="button"
                    className="pro-detail__events-add"
                    onClick={() => {
                      setEventDraftOpen((v) => !v)
                      setEventTitle('')
                      setEventDescription('')
                    }}
                  >
                    Événements +
                  </button>
                </div>
                {events.length === 0 && !eventDraftOpen ? (
                  <p className="pro-detail__clients-empty">
                    Aucun événement pour l’instant.
                  </p>
                ) : (
                  <ul className="pro-detail__formations">
                    {events.map((f) => (
                      <li key={f.id} className="pro-detail__events-item">
                        <div className="pro-detail__events-body">
                          <strong>{f.title}</strong>
                          {f.description ? <p>{f.description}</p> : null}
                        </div>
                        <button
                          type="button"
                          className="pro-detail__events-remove"
                          aria-label={`Retirer ${f.title}`}
                          onClick={() =>
                            onEventsChange?.(
                              events.filter((e) => e.id !== f.id),
                            )
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {eventDraftOpen && (
                  <div className="pro-detail__events-draft">
                    <label>
                      Titre
                      <input
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="MasterClass Head Spa - 26.10.2026"
                        autoFocus
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        value={eventDescription}
                        onChange={(e) => setEventDescription(e.target.value)}
                        placeholder="Quelques mots sur l’événement…"
                        rows={3}
                      />
                    </label>
                    <div className="pro-detail__events-draft-actions">
                      <button
                        type="button"
                        className="pro-detail__day-slots-action"
                        onClick={() => setEventDraftOpen(false)}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="pro-detail__events-save"
                        disabled={!eventTitle.trim()}
                        onClick={() => {
                          const title = eventTitle.trim()
                          if (!title || !onEventsChange) return
                          onEventsChange([
                            ...events,
                            {
                              id: `event-${Date.now()}`,
                              title,
                              description: eventDescription.trim(),
                            },
                          ])
                          setEventTitle('')
                          setEventDescription('')
                          setEventDraftOpen(false)
                        }}
                      >
                        Créer
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>

        {!canManageEvents && place.formations.length > 0 && (
          <section className="pro-detail__block">
            <h3 className="pro-detail__section-title">Formations & événements</h3>
            <ul className="pro-detail__formations">
              {place.formations.map((f) => (
                <li key={f.title} className="pro-detail__events-item">
                  <div className="pro-detail__events-body">
                    <strong>{f.title}</strong>
                    {f.description ? <p>{f.description}</p> : null}
                  </div>
                  {!f.description ? (
                    <span
                      className={`pro-detail__formation-badge${f.status === 'soon' ? ' is-soon' : ''}`}
                    >
                      {f.status === 'soon' ? 'À venir' : 'Ouverte'}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>

      {createPortal(
        <AnimatePresence>
          {booking && (
            <motion.div
              className="pro-detail__pricing-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeBooking}
            >
              <motion.div
                className="pro-detail__booking-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={`Réservation étape ${bookingStep} sur 3`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="pro-detail__pricing-head">
                <h3>
                  Réservation
                  <span className="pro-detail__booking-step">
                    {' '}
                    · {bookingStep}/3
                  </span>
                </h3>
                <button
                  type="button"
                  className="pro-detail__pricing-close"
                  onClick={closeBooking}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              <div className="pro-detail__booking-progress" aria-hidden>
                <i className={bookingStep >= 1 ? 'is-on' : ''} />
                <i className={bookingStep >= 2 ? 'is-on' : ''} />
                <i className={bookingStep >= 3 ? 'is-on' : ''} />
              </div>

              {bookingStep === 1 && (
                <div className="pro-detail__booking-panel">
                  <h4>Confirmation</h4>
                  <dl className="pro-detail__booking-recap">
                    <div>
                      <dt>Spécialité</dt>
                      <dd>{booking.specialty}</dd>
                    </div>
                    <div>
                      <dt>Disponibilité</dt>
                      <dd>
                        {booking.day.toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                        <br />
                        {formatMinutes(booking.startMinutes)} – {bookingEndLabel}
                      </dd>
                    </div>
                    <div>
                      <dt>Temps voulu</dt>
                      <dd>{durationLabel}</dd>
                    </div>
                    <div>
                      <dt>Prix réel</dt>
                      <dd>{bookingPrice}€</dd>
                    </div>
                  </dl>
                  <div className="pro-detail__booking-actions">
                    <button
                      type="button"
                      className="pro-detail__booking-secondary"
                      onClick={closeBooking}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="pro-detail__booking-primary"
                      onClick={() => setBookingStep(2)}
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 2 && (
                <div className="pro-detail__booking-panel">
                  <h4>Règlement / Instructions</h4>
                  <ul className="pro-detail__booking-rules">
                    <li>
                      Arrivez 10 minutes avant le début du créneau. Accès
                      autonome via le digicode envoyé après paiement.
                    </li>
                    <li>
                      Laissez l’espace propre : ranger le matériel, jeter les
                      consommables, éteindre lumières et appareils.
                    </li>
                    <li>
                      Annulation gratuite jusqu’à 24 h avant le créneau. Au-delà,
                      le montant peut être retenu.
                    </li>
                    <li>
                      En cas de problème sur place, contactez l’accueil du hub
                      via les coordonnées indiquées sur la fiche.
                    </li>
                  </ul>
                  <label className="pro-detail__booking-check">
                    <input type="checkbox" defaultChecked />
                    <span>J’accepte le règlement et les instructions</span>
                  </label>
                  <div className="pro-detail__booking-actions">
                    <button
                      type="button"
                      className="pro-detail__booking-secondary"
                      onClick={() => setBookingStep(1)}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className="pro-detail__booking-primary"
                      onClick={() => setBookingStep(3)}
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div className="pro-detail__booking-panel">
                  <h4>Validation</h4>
                  <p className="pro-detail__price-hint">
                    Démo — aucun paiement réel. La réservation sera ajoutée à
                    « À venir ».
                  </p>
                  <div className="pro-detail__booking-pay">
                    <label>
                      Titulaire
                      <input type="text" defaultValue="Alex Martin" readOnly />
                    </label>
                    <label>
                      Carte
                      <input
                        type="text"
                        defaultValue="4242 4242 4242 4242"
                        readOnly
                      />
                    </label>
                    <div className="pro-detail__booking-pay-row">
                      <label>
                        Exp.
                        <input type="text" defaultValue="12/28" readOnly />
                      </label>
                      <label>
                        CVC
                        <input type="text" defaultValue="123" readOnly />
                      </label>
                    </div>
                    <p className="pro-detail__booking-total">
                      Total à régler · <strong>{bookingPrice}€</strong>
                    </p>
                  </div>
                  <div className="pro-detail__booking-actions">
                    <button
                      type="button"
                      className="pro-detail__booking-secondary"
                      onClick={() => setBookingStep(2)}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className="pro-detail__booking-primary"
                      onClick={confirmBooking}
                    >
                      Confirmer (démo)
                    </button>
                  </div>
                </div>
              )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
        <AnimatePresence>
          {pricingOpen && (
            <motion.div
              className="pro-detail__pricing-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setPricingOpen(false)}
            >
              <motion.div
                className="pro-detail__pricing-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Grille tarifaire"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="pro-detail__pricing-head">
                <h3>Grille tarifaire</h3>
                <button
                  type="button"
                  className="pro-detail__pricing-close"
                  onClick={() => setPricingOpen(false)}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
              {place.specialties.length > 0 && (
                <ul
                  className="pro-detail__pricing-specs"
                  aria-label="Spécialité tarifaire"
                >
                  {place.specialties.map((spec) => (
                    <li key={spec}>
                      <button
                        type="button"
                        className={`pro-spec${calSpecialty === spec ? ' is-active' : ''}`}
                        style={
                          {
                            ['--spec-color' as string]: colorOf(spec),
                          } as CSSProperties
                        }
                        aria-pressed={calSpecialty === spec}
                        onClick={() => setCalSpecialty(spec)}
                      >
                        {spec}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="pro-detail__pricing-list">
                {HOUR_PRICING_ROWS.map((row) => (
                  <li key={row.key}>
                    <div>
                      <strong>{row.label}</strong>
                    </div>
                    <em>{activePricing[row.key]}€</em>
                  </li>
                ))}
              </ul>
              <p className="pro-detail__pricing-devis">
                Au-delà de 4&nbsp;h, c’est sur devis, en contact direct avec
                l’accueil.
              </p>
              {FROM_PRICING_ROWS.some((row) => activePricing[row.key] > 0) && (
                <ul className="pro-detail__pricing-list is-from">
                  {FROM_PRICING_ROWS.filter(
                    (row) => activePricing[row.key] > 0,
                  ).map((row) => (
                    <li key={row.key}>
                      <div>
                        <strong>{row.label}</strong>
                        <span>À partir de</span>
                      </div>
                      <em>{activePricing[row.key]}€</em>
                    </li>
                  ))}
                </ul>
              )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </article>
  )
}
