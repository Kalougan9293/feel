import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import {
  DAY_END_MINUTES,
  HALF_HOUR_OPTIONS,
  TIME_STEP_MINUTES,
  WEEK_DAYS,
  formatMinutes,
  type AvailSlot,
  type WeekDay,
} from '../../data/availability'
import { CATEGORIES, colorOf, type CategoryLabel } from '../../data/categories'
import {
  PLACE_MEDIA_MAX,
  normalizePricing,
  type PricingGrid,
} from '../../data/places'
import { formatFrenchPhone } from '../../data/phone'
import { BulletTextarea } from './BulletTextarea'
import {
  defaultSlotsForOwnerPlace,
  type OwnerMedia,
  type OwnerPlace,
} from './OwnerAccountContext'
import './Owner.css'

export type OwnerEditSection =
  | 'identity'
  | 'contact'
  | 'media'
  | 'studios'
  | 'description'
  | 'specDesc'
  | 'pricing'
  | 'slots'

type DayHours = { start: number; end: number }
type DayHoursMap = Partial<Record<WeekDay, DayHours>>

const DEFAULT_DAY_HOURS: DayHours = { start: 9 * 60, end: 18 * 60 }
const START_OPTIONS = HALF_HOUR_OPTIONS
const END_OPTIONS = [...HALF_HOUR_OPTIONS.slice(1), DAY_END_MINUTES]

const HOUR_ROWS: { key: keyof PricingGrid; label: string }[] = [
  { key: 'hour', label: '1 h' },
  { key: 'hours2', label: '2 h' },
  { key: 'hours3', label: '3 h' },
  { key: 'hours4', label: '4 h' },
]

const FROM_ROWS: { key: keyof PricingGrid; label: string }[] = [
  { key: 'day', label: 'Journée' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'semester', label: 'Semestre' },
  { key: 'year', label: 'Année' },
]

const PHOTO_POOL = [
  '/inspiration-cabine.jpg',
  '/hero-salon.jpg',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80',
]

const TITLES: Record<OwnerEditSection, string> = {
  identity: 'Identité & adresse',
  contact: 'Contact',
  media: 'Photos',
  studios: 'Studios & descriptions',
  description: 'Description du centre',
  specDesc: 'Description studio',
  pricing: 'Grille tarifaire',
  slots: 'Horaires généraux',
}

function snapMinutes(value: number): number {
  if (value >= DAY_END_MINUTES) return DAY_END_MINUTES
  const stepped = Math.round(value / TIME_STEP_MINUTES) * TIME_STEP_MINUTES
  return Math.min(Math.max(stepped, 0), DAY_END_MINUTES)
}

function buildSlotsFromDayHours(map: DayHoursMap): AvailSlot[] {
  const slots: AvailSlot[] = []
  for (const d of WEEK_DAYS) {
    const hrs = map[d.value]
    if (!hrs) continue
    const start = snapMinutes(hrs.start)
    const end = snapMinutes(hrs.end)
    const s = Math.min(start, end)
    const e = Math.max(start, end)
    const last =
      e >= DAY_END_MINUTES ? DAY_END_MINUTES - TIME_STEP_MINUTES : e
    for (let m = s; m <= last; m += TIME_STEP_MINUTES) {
      slots.push({ day: d.value, minutes: m })
    }
  }
  return slots
}

function dayHoursFromSlots(list: AvailSlot[]): DayHoursMap {
  const map: DayHoursMap = {}
  for (const d of WEEK_DAYS) {
    const mins = list
      .filter((s) => s.day === d.value)
      .map((s) => s.minutes)
    if (mins.length === 0) continue
    const start = Math.min(...mins)
    let end = Math.max(...mins)
    if (end >= DAY_END_MINUTES - TIME_STEP_MINUTES) end = DAY_END_MINUTES
    map[d.value] = { start, end }
  }
  return map
}

type Props = {
  open: boolean
  section: OwnerEditSection | null
  place: OwnerPlace
  initialSpecialty?: CategoryLabel | null
  onClose: () => void
  onSave: (patch: Partial<OwnerPlace>) => void
}

export function OwnerPlaceEditSheet({
  open,
  section,
  place,
  initialSpecialty = null,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(place.name)
  const [street, setStreet] = useState(place.street)
  const [postalCode, setPostalCode] = useState(place.postalCode)
  const [city, setCity] = useState(place.city)
  const [email, setEmail] = useState(place.email)
  const [phone, setPhone] = useState(place.phone)
  const [emailVisible, setEmailVisible] = useState(place.emailVisible)
  const [phoneVisible, setPhoneVisible] = useState(place.phoneVisible)
  const [description, setDescription] = useState(place.description)
  const [specialties, setSpecialties] = useState(place.specialties)
  const [specDescs, setSpecDescs] = useState(place.descriptionBySpecialty)
  const [postBookingMsgs, setPostBookingMsgs] = useState(
    place.postBookingMessageBySpecialty ?? {},
  )
  const [activeSpec, setActiveSpec] = useState<CategoryLabel | null>(
    initialSpecialty && place.specialties.includes(initialSpecialty)
      ? initialSpecialty
      : (place.specialties[0] ?? null),
  )
  const [media, setMedia] = useState(place.media)
  const [pricing, setPricing] = useState(() => normalizePricing(place.pricing))
  const [pricingSpec, setPricingSpec] = useState<'all' | CategoryLabel>('all')
  const [pricingBySpecialty, setPricingBySpecialty] = useState(
    place.pricingBySpecialty,
  )
  const [calSpec, setCalSpec] = useState<'all' | CategoryLabel>('all')
  const [sameHoursAllDays, setSameHoursAllDays] = useState(true)
  const [slots, setSlots] = useState(place.slots)
  const [slotsBySpecialty, setSlotsBySpecialty] = useState(
    place.slotsBySpecialty,
  )

  useEffect(() => {
    if (!open || !section) return
    setName(place.name)
    setStreet(place.street)
    setPostalCode(place.postalCode)
    setCity(place.city)
    setEmail(place.email)
    setPhone(place.phone)
    setEmailVisible(place.emailVisible)
    setPhoneVisible(place.phoneVisible)
    setDescription(place.description)
    setSpecialties(place.specialties)
    setSpecDescs(place.descriptionBySpecialty)
    setPostBookingMsgs(place.postBookingMessageBySpecialty ?? {})
    setActiveSpec(
      initialSpecialty && place.specialties.includes(initialSpecialty)
        ? initialSpecialty
        : (place.specialties[0] ?? null),
    )
    setMedia(place.media.length ? place.media : [])
    setPricing(normalizePricing(place.pricing))
    setPricingSpec('all')
    setPricingBySpecialty(place.pricingBySpecialty)
    setCalSpec('all')
    setSameHoursAllDays(true)
    setSlots(place.slots.length ? place.slots : defaultSlotsForOwnerPlace())
    setSlotsBySpecialty(place.slotsBySpecialty)
  }, [open, section, place, initialSpecialty])

  const activeSlots = useMemo(() => {
    if (calSpec !== 'all' && slotsBySpecialty[calSpec]?.length) {
      return slotsBySpecialty[calSpec]!
    }
    return slots
  }, [calSpec, slots, slotsBySpecialty])

  const dayHours = useMemo(
    () => dayHoursFromSlots(activeSlots),
    [activeSlots],
  )
  const openWeekdays = useMemo(
    () => WEEK_DAYS.map((d) => d.value).filter((d) => Boolean(dayHours[d])),
    [dayHours],
  )

  const activePricing = useMemo(() => {
    if (pricingSpec !== 'all' && pricingBySpecialty[pricingSpec]) {
      return normalizePricing(pricingBySpecialty[pricingSpec]!)
    }
    return pricing
  }, [pricing, pricingSpec, pricingBySpecialty])

  const calAccent = calSpec === 'all' ? '#9a7b55' : colorOf(calSpec)

  if (!open || !section) return null

  function writeDayHours(next: DayHoursMap) {
    const built = buildSlotsFromDayHours(next)
    if (calSpec === 'all') {
      setSlots(built)
      const forAll: Partial<Record<CategoryLabel, AvailSlot[]>> = {}
      for (const s of specialties) forAll[s] = [...built]
      setSlotsBySpecialty(forAll)
    } else {
      setSlotsBySpecialty((v) => ({ ...v, [calSpec]: built }))
    }
  }

  function applyDayHours(day: WeekDay, start: number, end: number) {
    const prev = dayHours[day] ?? DEFAULT_DAY_HOURS
    let s = snapMinutes(start)
    let e = snapMinutes(end)
    if (e <= s) {
      if (s !== prev.start) e = Math.min(s + TIME_STEP_MINUTES, DAY_END_MINUTES)
      else s = Math.max(e - TIME_STEP_MINUTES, 0)
    }
    const pair = { start: s, end: e }
    if (sameHoursAllDays) {
      const next: DayHoursMap = {}
      for (const d of openWeekdays) next[d] = { ...pair }
      writeDayHours(next)
      return
    }
    writeDayHours({ ...dayHours, [day]: pair })
  }

  function toggleWeekday(day: WeekDay) {
    const next: DayHoursMap = { ...dayHours }
    if (next[day]) delete next[day]
    else {
      const template =
        openWeekdays.length > 0
          ? (dayHours[openWeekdays[0]] ?? DEFAULT_DAY_HOURS)
          : DEFAULT_DAY_HOURS
      next[day] = { ...template }
    }
    writeDayHours(next)
  }

  function patchPricing(next: PricingGrid) {
    const grid = normalizePricing(next)
    if (pricingSpec === 'all') {
      setPricing(grid)
      const forAll: Partial<Record<CategoryLabel, PricingGrid>> = {}
      for (const s of specialties) forAll[s] = { ...grid }
      setPricingBySpecialty(forAll)
    } else {
      setPricingBySpecialty((v) => ({ ...v, [pricingSpec]: grid }))
    }
  }

  function addPhotoFromPool(src: string) {
    setMedia((list) => {
      if (list.length >= PLACE_MEDIA_MAX) return list
      return [
        ...list,
        { id: `media-${Date.now()}-${list.length}`, src },
      ]
    })
  }

  function onUploadFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        const src = String(reader.result ?? '')
        if (!src) return
        setMedia((list) => {
          if (list.length >= PLACE_MEDIA_MAX) return list
          return [
            ...list,
            { id: `media-${Date.now()}-${list.length}`, src },
          ]
        })
      }
      reader.readAsDataURL(file)
    }
  }

  function save() {
    if (section === 'identity') {
      onSave({
        name: name.trim(),
        street: street.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
      })
    } else if (section === 'contact') {
      onSave({
        email: email.trim(),
        phone: formatFrenchPhone(phone),
        emailVisible,
        phoneVisible,
      })
    } else if (section === 'media') {
      const nextMedia = media.length
        ? media
        : ([{ id: `${place.id}-cover`, src: place.image }] as OwnerMedia[])
      onSave({ media: nextMedia, image: nextMedia[0]?.src ?? place.image })
    } else if (section === 'studios') {
      if (specialties.length === 0) return
      const descs: Partial<Record<CategoryLabel, string>> = {}
      const prices: Partial<Record<CategoryLabel, PricingGrid>> = {}
      const slotMap: Partial<Record<CategoryLabel, AvailSlot[]>> = {}
      const msgs: Partial<Record<CategoryLabel, string>> = {}
      for (const s of specialties) {
        descs[s] = specDescs[s] ?? place.descriptionBySpecialty[s] ?? ''
        prices[s] =
          pricingBySpecialty[s] ??
          place.pricingBySpecialty[s] ??
          normalizePricing(place.pricing)
        slotMap[s] =
          slotsBySpecialty[s] ??
          place.slotsBySpecialty[s] ??
          place.slots
        msgs[s] = (postBookingMsgs[s] ?? '').trim()
      }
      onSave({
        specialties,
        descriptionBySpecialty: descs,
        pricingBySpecialty: prices,
        slotsBySpecialty: slotMap,
        postBookingMessageBySpecialty: msgs,
      })
    } else if (section === 'description') {
      onSave({ description: description.trim() })
    } else if (section === 'specDesc') {
      onSave({
        descriptionBySpecialty: { ...specDescs },
        postBookingMessageBySpecialty: { ...postBookingMsgs },
      })
    } else if (section === 'pricing') {
      onSave({ pricing, pricingBySpecialty })
    } else if (section === 'slots') {
      onSave({ slots, slotsBySpecialty })
    }
    onClose()
  }

  const postalOk = /^\d{5}$/.test(postalCode.trim())
  const canSave =
    section === 'identity'
      ? name.trim() && street.trim() && postalOk && city.trim()
      : section === 'studios'
        ? specialties.length > 0
        : section === 'media'
          ? media.length > 0
          : true

  return createPortal(
    <div className="owner-edit-sheet" role="dialog" aria-modal="true">
      <button
        type="button"
        className="owner-edit-sheet__backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="owner-edit-sheet__panel">
        <header className="owner-edit-sheet__head">
          <h2>{TITLES[section]}</h2>
          <button
            type="button"
            className="owner-edit-sheet__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <div className="owner-edit-sheet__body">
          {section === 'identity' && (
            <div className="owner-onboard__step">
              <label>
                Nom du lieu
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                Adresse (n° + rue)
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </label>
              <div className="owner-create__row">
                <label>
                  Code postal
                  <input
                    value={postalCode}
                    onChange={(e) =>
                      setPostalCode(
                        e.target.value.replace(/\D/g, '').slice(0, 5),
                      )
                    }
                    inputMode="numeric"
                    maxLength={5}
                  />
                </label>
                <label>
                  Ville
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {section === 'contact' && (
            <div className="owner-onboard__step">
              <label>
                E-mail d’accueil
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="owner-create__check">
                <input
                  type="checkbox"
                  checked={emailVisible}
                  onChange={(e) => setEmailVisible(e.target.checked)}
                />
                Visible sur la fiche
              </label>
              <label>
                Téléphone
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatFrenchPhone(e.target.value))}
                />
              </label>
              <label className="owner-create__check">
                <input
                  type="checkbox"
                  checked={phoneVisible}
                  onChange={(e) => setPhoneVisible(e.target.checked)}
                />
                Visible sur la fiche
              </label>
            </div>
          )}

          {section === 'media' && (
            <div className="owner-onboard__step">
              <div className="owner-onboard__photo-actions">
                <label className="owner-onboard__upload">
                  Ajouter
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onUploadFiles}
                  />
                </label>
              </div>
              <p className="owner-onboard__mini">Ou une image démo :</p>
              <div className="owner-onboard__pool">
                {PHOTO_POOL.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className="owner-onboard__pool-btn"
                    style={{ backgroundImage: `url(${src})` }}
                    onClick={() => addPhotoFromPool(src)}
                  />
                ))}
              </div>
              <ul className="owner-onboard__media-list">
                {media.map((m, idx) => (
                  <li key={m.id}>
                    <div
                      className="owner-onboard__media-thumb"
                      style={{ backgroundImage: `url(${m.src})` }}
                    >
                      {idx === 0 && (
                        <span className="owner-onboard__cover-badge">
                          Couverture
                        </span>
                      )}
                    </div>
                    <select
                      value={m.specialty ?? ''}
                      onChange={(e) => {
                        const specialty = e.target.value as CategoryLabel | ''
                        setMedia((list) =>
                          list.map((item) =>
                            item.id === m.id
                              ? specialty
                                ? { ...item, specialty }
                                : { id: item.id, src: item.src }
                              : item,
                          ),
                        )
                      }}
                    >
                      <option value="">Général</option>
                      {place.specialties.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="owner-onboard__media-remove"
                      onClick={() =>
                        setMedia((list) => list.filter((x) => x.id !== m.id))
                      }
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section === 'studios' && (
            <div className="owner-onboard__step">
              <div className="owner-create__specs">
                {CATEGORIES.filter(
                  (cat) => !specialties.includes(cat.label),
                ).map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    className="owner-create__spec"
                    style={
                      {
                        ['--spec-color' as string]: cat.color,
                      } as CSSProperties
                    }
                    onClick={() => {
                      setSpecialties((list) => [...list, cat.label])
                      setActiveSpec(cat.label)
                    }}
                  >
                    <span className="owner-create__spec-fill" aria-hidden />
                    <span className="owner-create__spec-label">
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="owner-edit-sheet__specs-split">
                <span>Mes choix</span>
              </div>
              {specialties.length > 0 ? (
                <>
                  <div className="owner-create__specs owner-onboard__pricing-specs owner-edit-sheet__my-specs">
                    {specialties.map((s) => (
                      <div
                        key={s}
                        className={`owner-edit-sheet__my-spec${activeSpec === s ? ' is-active' : ''}`}
                      >
                        <button
                          type="button"
                          className={`owner-create__spec${activeSpec === s ? ' is-active' : ''}`}
                          style={
                            {
                              ['--spec-color' as string]: colorOf(s),
                            } as CSSProperties
                          }
                          onClick={() => setActiveSpec(s)}
                        >
                          <span
                            className="owner-create__spec-fill"
                            aria-hidden
                          />
                          <span className="owner-create__spec-label">{s}</span>
                        </button>
                        <button
                          type="button"
                          className="owner-edit-sheet__my-spec-remove"
                          aria-label={`Retirer ${s}`}
                          onClick={() => {
                            setSpecialties((list) => {
                              const next = list.filter((x) => x !== s)
                              if (activeSpec === s) {
                                setActiveSpec(next[0] ?? null)
                              }
                              return next
                            })
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {activeSpec && (
                    <>
                      <label>
                        Description · {activeSpec}
                        <BulletTextarea
                          rows={5}
                          value={specDescs[activeSpec] ?? ''}
                          onChange={(text) => {
                            setSpecDescs((v) => ({ ...v, [activeSpec]: text }))
                          }}
                        />
                      </label>
                      <div className="owner-edit-sheet__post-msg">
                        <p className="owner-edit-sheet__post-msg-title">
                          Après réservation
                        </p>
                        <p className="owner-edit-sheet__post-msg-text">
                          Dès qu’un professionnel réserve ce studio, rédigez le
                          message qui lui sera envoyé (accès, digicode,
                          consignes…).
                        </p>
                        <label>
                          Message à envoyer
                          <textarea
                            rows={4}
                            value={postBookingMsgs[activeSpec] ?? ''}
                            onChange={(e) =>
                              setPostBookingMsgs((v) => ({
                                ...v,
                                [activeSpec]: e.target.value,
                              }))
                            }
                            placeholder="Ex. Bonjour, votre accès : digicode 4521. Entrée par la cour, 2ᵉ étage."
                          />
                        </label>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="owner-edit-sheet__specs-empty">
                  Aucune spécialité sélectionnée.
                </p>
              )}
            </div>
          )}

          {section === 'description' && (
            <div className="owner-onboard__step">
              <label>
                Description générale
                <BulletTextarea
                  rows={7}
                  value={description}
                  onChange={setDescription}
                  autoFocus
                />
              </label>
            </div>
          )}

          {section === 'specDesc' && (
            <div className="owner-onboard__step">
              <div className="owner-create__specs owner-onboard__pricing-specs">
                {specialties.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`owner-create__spec${activeSpec === s ? ' is-active' : ''}`}
                    style={
                      {
                        ['--spec-color' as string]: colorOf(s),
                      } as CSSProperties
                    }
                    onClick={() => setActiveSpec(s)}
                  >
                    <span className="owner-create__spec-fill" aria-hidden />
                    <span className="owner-create__spec-label">{s}</span>
                  </button>
                ))}
              </div>
              {activeSpec && (
                <>
                  <label>
                    Description · {activeSpec}
                    <BulletTextarea
                      rows={6}
                      value={specDescs[activeSpec] ?? ''}
                      onChange={(text) => {
                        setSpecDescs((v) => ({ ...v, [activeSpec]: text }))
                      }}
                      autoFocus
                    />
                  </label>
                  <div className="owner-edit-sheet__post-msg">
                    <p className="owner-edit-sheet__post-msg-title">
                      Après réservation
                    </p>
                    <p className="owner-edit-sheet__post-msg-text">
                      Dès qu’un professionnel réserve ce studio, rédigez le
                      message qui lui sera envoyé (accès, digicode,
                      consignes…).
                    </p>
                    <label>
                      Message à envoyer
                      <textarea
                        rows={4}
                        value={postBookingMsgs[activeSpec] ?? ''}
                        onChange={(e) =>
                          setPostBookingMsgs((v) => ({
                            ...v,
                            [activeSpec]: e.target.value,
                          }))
                        }
                        placeholder="Ex. Bonjour, votre accès : digicode 4521. Entrée par la cour, 2ᵉ étage."
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {section === 'pricing' && (
            <div className="owner-onboard__step">
              <div className="owner-create__specs owner-onboard__pricing-specs">
                <button
                  type="button"
                  className={`owner-create__spec owner-onboard__pricing-default${pricingSpec === 'all' ? ' is-active' : ''}`}
                  onClick={() => setPricingSpec('all')}
                >
                  <span className="owner-create__spec-fill" aria-hidden />
                  <span className="owner-create__spec-label">Pour tous</span>
                </button>
                {specialties.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`owner-create__spec${pricingSpec === s ? ' is-active' : ''}`}
                    style={
                      {
                        ['--spec-color' as string]: colorOf(s),
                      } as CSSProperties
                    }
                    onClick={() => setPricingSpec(s)}
                  >
                    <span className="owner-create__spec-fill" aria-hidden />
                    <span className="owner-create__spec-label">{s}</span>
                  </button>
                ))}
              </div>
              <ul className="owner-pricing-compact">
                {HOUR_ROWS.map((row) => (
                  <li key={row.key}>
                    <label>
                      {row.label}
                      <span className="owner-pricing-compact__input">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            activePricing[row.key]
                              ? String(activePricing[row.key])
                              : ''
                          }
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '')
                            patchPricing({
                              ...activePricing,
                              [row.key]: digits ? Number(digits) : 0,
                            })
                          }}
                        />
                        <em>€</em>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="owner-onboard__mini">À partir de (optionnel)</p>
              <ul className="owner-pricing-compact">
                {FROM_ROWS.map((row) => (
                  <li key={row.key}>
                    <label>
                      {row.label}
                      <span className="owner-pricing-compact__input">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            activePricing[row.key]
                              ? String(activePricing[row.key])
                              : ''
                          }
                          placeholder="—"
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '')
                            patchPricing({
                              ...activePricing,
                              [row.key]: digits ? Number(digits) : 0,
                            })
                          }}
                        />
                        <em>€</em>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section === 'slots' && (
            <div
              className="owner-onboard__step owner-onboard__step--cal"
              style={
                { ['--cal-accent' as string]: calAccent } as CSSProperties
              }
            >
              <div className="owner-create__specs owner-onboard__cal-specs">
                <button
                  type="button"
                  className={`owner-create__spec owner-onboard__pricing-default${calSpec === 'all' ? ' is-active' : ''}`}
                  onClick={() => setCalSpec('all')}
                >
                  <span className="owner-create__spec-fill" aria-hidden />
                  <span className="owner-create__spec-label">Pour tous</span>
                </button>
                {specialties.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`owner-create__spec${calSpec === s ? ' is-active' : ''}`}
                    style={
                      {
                        ['--spec-color' as string]: colorOf(s),
                      } as CSSProperties
                    }
                    onClick={() => setCalSpec(s)}
                  >
                    <span className="owner-create__spec-fill" aria-hidden />
                    <span className="owner-create__spec-label">{s}</span>
                  </button>
                ))}
              </div>
              <div className="owner-onboard__weekday-toggles">
                {WEEK_DAYS.map((d) => {
                  const closed = !openWeekdays.includes(d.value)
                  return (
                    <button
                      key={d.value}
                      type="button"
                      className={`owner-onboard__weekday-chip${closed ? ' is-closed' : ' is-open'}`}
                      onClick={() => toggleWeekday(d.value)}
                    >
                      {d.short}
                    </button>
                  )
                })}
              </div>
              {openWeekdays.length > 0 && (
                <div className="owner-onboard__day-hours">
                  <label className="owner-onboard__same-hours">
                    <input
                      type="checkbox"
                      checked={sameHoursAllDays}
                      onChange={(e) => {
                        setSameHoursAllDays(e.target.checked)
                        if (!e.target.checked || openWeekdays.length === 0)
                          return
                        const first =
                          dayHours[openWeekdays[0]] ?? DEFAULT_DAY_HOURS
                        const next: DayHoursMap = {}
                        for (const d of openWeekdays) next[d] = { ...first }
                        writeDayHours(next)
                      }}
                    />
                    Pareil pour tous les jours
                  </label>
                  {sameHoursAllDays ? (
                    <div className="owner-onboard__time-pair">
                      <label>
                        Ouverture
                        <select
                          value={
                            dayHours[openWeekdays[0]]?.start ??
                            DEFAULT_DAY_HOURS.start
                          }
                          onChange={(e) =>
                            applyDayHours(
                              openWeekdays[0],
                              Number(e.target.value),
                              dayHours[openWeekdays[0]]?.end ??
                                DEFAULT_DAY_HOURS.end,
                            )
                          }
                        >
                          {START_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {formatMinutes(m)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="owner-onboard__time-arrow" aria-hidden>
                        →
                      </span>
                      <label>
                        Fermeture
                        <select
                          value={
                            dayHours[openWeekdays[0]]?.end ??
                            DEFAULT_DAY_HOURS.end
                          }
                          onChange={(e) =>
                            applyDayHours(
                              openWeekdays[0],
                              dayHours[openWeekdays[0]]?.start ??
                                DEFAULT_DAY_HOURS.start,
                              Number(e.target.value),
                            )
                          }
                        >
                          {END_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {formatMinutes(m)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    WEEK_DAYS.filter((d) => dayHours[d.value]).map((d) => {
                      const hrs = dayHours[d.value]!
                      return (
                        <div key={d.value} className="owner-onboard__day-row">
                          <span className="owner-onboard__day-row-label">
                            {d.short}
                          </span>
                          <select
                            value={hrs.start}
                            onChange={(e) =>
                              applyDayHours(
                                d.value,
                                Number(e.target.value),
                                hrs.end,
                              )
                            }
                          >
                            {START_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {formatMinutes(m)}
                              </option>
                            ))}
                          </select>
                          <span
                            className="owner-onboard__time-arrow"
                            aria-hidden
                          >
                            →
                          </span>
                          <select
                            value={hrs.end}
                            onChange={(e) =>
                              applyDayHours(
                                d.value,
                                hrs.start,
                                Number(e.target.value),
                              )
                            }
                          >
                            {END_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {formatMinutes(m)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="owner-edit-sheet__foot">
          <button
            type="button"
            className="owner-create__secondary"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="owner-profile__primary"
            disabled={!canSave}
            onClick={save}
          >
            Enregistrer
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

export function ReglagesButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="owner-reglages"
      aria-label={`Réglages · ${label}`}
      title={`Réglages · ${label}`}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.5 2.5a7.6 7.6 0 0 0-1.7 1L6.5 6.4l-2 3.4 2 1.2a7.8 7.8 0 0 0 0 2l-2 1.2 2 3.4 2.3-.6a7.6 7.6 0 0 0 1.7 1l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
