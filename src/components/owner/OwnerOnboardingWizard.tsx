import { AnimatePresence, motion } from 'framer-motion'
import {
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
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
import { PLACE_MEDIA_MAX, type PricingGrid } from '../../data/places'
import { formatFrenchPhone } from '../../data/phone'
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
} from '../../data/supportContact'
import { BulletTextarea } from './BulletTextarea'
import {
  defaultPricing,
  defaultSlotsForOwnerPlace,
  useOwnerAccount,
  type OwnerMedia,
} from './OwnerAccountContext'
import './Owner.css'

const PHOTO_POOL = [
  '/inspiration-cabine.jpg',
  '/hero-salon.jpg',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80',
]

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

type Step = 1 | 2 | 3 | 4 | 5 | 6
type DayHours = { start: number; end: number }
type DayHoursMap = Partial<Record<WeekDay, DayHours>>

const DEFAULT_DAY_HOURS: DayHours = { start: 9 * 60, end: 18 * 60 }
const START_OPTIONS = HALF_HOUR_OPTIONS
const END_OPTIONS = [...HALF_HOUR_OPTIONS.slice(1), DAY_END_MINUTES]

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (placeId: string) => void
}

function snapMinutes(value: number): number {
  if (value >= DAY_END_MINUTES) return DAY_END_MINUTES
  const stepped =
    Math.round(value / TIME_STEP_MINUTES) * TIME_STEP_MINUTES
  return Math.min(Math.max(stepped, 0), DAY_END_MINUTES)
}

function clampMinutePair(start: number, end: number): DayHours {
  const s = snapMinutes(start)
  const e = snapMinutes(end)
  return { start: Math.min(s, e), end: Math.max(s, e) }
}

function buildSlotsFromDayHours(map: DayHoursMap): AvailSlot[] {
  const slots: AvailSlot[] = []
  for (const d of WEEK_DAYS) {
    const hrs = map[d.value]
    if (!hrs) continue
    const { start, end } = clampMinutePair(hrs.start, hrs.end)
    const last =
      end >= DAY_END_MINUTES ? DAY_END_MINUTES - TIME_STEP_MINUTES : end
    for (let m = start; m <= last; m += TIME_STEP_MINUTES) {
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
    // Si le dernier créneau est le dernier pas avant minuit → fin = 23h59
    if (end >= DAY_END_MINUTES - TIME_STEP_MINUTES) end = DAY_END_MINUTES
    map[d.value] = { start, end }
  }
  return map
}

function openDaysFromMap(map: DayHoursMap): WeekDay[] {
  return WEEK_DAYS.map((d) => d.value).filter((d) => Boolean(map[d]))
}

export function OwnerOnboardingWizard({ open, onClose, onCreated }: Props) {
  const { createPlace } = useOwnerAccount()
  const [step, setStep] = useState<Step>(1)

  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailVisible, setEmailVisible] = useState(true)
  const [phoneVisible, setPhoneVisible] = useState(true)

  const [specialties, setSpecialties] = useState<CategoryLabel[]>([])
  const [media, setMedia] = useState<OwnerMedia[]>([])
  const [description, setDescription] = useState('')
  const [specDescs, setSpecDescs] = useState<
    Partial<Record<CategoryLabel, string>>
  >({})
  const [activeSpecDesc, setActiveSpecDesc] = useState<CategoryLabel | null>(
    null,
  )

  const [pricing, setPricing] = useState<PricingGrid>(defaultPricing)
  const [pricingSpec, setPricingSpec] = useState<CategoryLabel | 'all'>('all')
  const [pricingBySpecialty, setPricingBySpecialty] = useState<
    Partial<Record<CategoryLabel, PricingGrid>>
  >({})

  const [slots, setSlots] = useState<AvailSlot[]>(() =>
    defaultSlotsForOwnerPlace(),
  )
  const [slotsBySpecialty, setSlotsBySpecialty] = useState<
    Partial<Record<CategoryLabel, AvailSlot[]>>
  >({})
  const [calSpec, setCalSpec] = useState<'all' | CategoryLabel>('all')
  const [sameHoursAllDays, setSameHoursAllDays] = useState(true)

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
  const openWeekdays = useMemo(() => openDaysFromMap(dayHours), [dayHours])

  const calAccent = calSpec === 'all' ? '#9a7b55' : colorOf(calSpec)

  function writeActiveSlots(next: AvailSlot[]) {
    if (calSpec === 'all') {
      setSlots(next)
      const forAll: Partial<Record<CategoryLabel, AvailSlot[]>> = {}
      for (const spec of specialties) forAll[spec] = [...next]
      setSlotsBySpecialty(forAll)
    } else {
      setSlotsBySpecialty((v) => ({ ...v, [calSpec]: next }))
    }
  }

  function writeDayHours(next: DayHoursMap) {
    writeActiveSlots(buildSlotsFromDayHours(next))
  }

  function selectCalSpec(next: 'all' | CategoryLabel) {
    setCalSpec(next)
  }

  function toggleClosedWeekday(day: WeekDay) {
    const next: DayHoursMap = { ...dayHours }
    if (next[day]) {
      delete next[day]
    } else {
      const template =
        openWeekdays.length > 0
          ? (dayHours[openWeekdays[0]] ?? DEFAULT_DAY_HOURS)
          : DEFAULT_DAY_HOURS
      next[day] = { ...template }
    }
    writeDayHours(next)
  }

  function applyDayHours(day: WeekDay, start: number, end: number) {
    const prev = dayHours[day] ?? DEFAULT_DAY_HOURS
    let s = snapMinutes(start)
    let e = snapMinutes(end)
    if (e <= s) {
      if (s !== prev.start) {
        e = Math.min(s + TIME_STEP_MINUTES, DAY_END_MINUTES)
      } else {
        s = Math.max(e - TIME_STEP_MINUTES, 0)
      }
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

  function onToggleSameHours(checked: boolean) {
    setSameHoursAllDays(checked)
    if (!checked || openWeekdays.length === 0) return
    const first = dayHours[openWeekdays[0]] ?? DEFAULT_DAY_HOURS
    const next: DayHoursMap = {}
    for (const d of openWeekdays) next[d] = { ...first }
    writeDayHours(next)
  }

  function reset() {
    setStep(1)
    setName('')
    setStreet('')
    setPostalCode('')
    setCity('')
    setEmail('')
    setPhone('')
    setEmailVisible(true)
    setPhoneVisible(true)
    setSpecialties([])
    setMedia([])
    setDescription('')
    setSpecDescs({})
    setActiveSpecDesc(null)
    setPricing(defaultPricing())
    setPricingSpec('all')
    setPricingBySpecialty({})
    setSlots(defaultSlotsForOwnerPlace())
    setSlotsBySpecialty({})
    setCalSpec('all')
    setSameHoursAllDays(true)
  }

  function close() {
    reset()
    onClose()
  }

  function goPrev() {
    if (step <= 1) return
    const prev = (step - 1) as Step
    if (prev === 4) {
      setActiveSpecDesc(specialties[0] ?? null)
    }
    if (prev === 5) setPricingSpec('all')
    if (prev === 6) {
      selectCalSpec('all')
      setSameHoursAllDays(true)
    }
    setStep(prev)
  }

  const postalOk = /^\d{5}$/.test(postalCode.trim())
  const canStep1 =
    name.trim().length > 0 &&
    street.trim().length > 0 &&
    postalOk &&
    city.trim().length > 0
  const canStep2 = specialties.length > 0
  const canStep3 = media.length > 0
  const missingSpecDescs = specialties.filter(
    (s) => !(specDescs[s] ?? '').trim(),
  )
  const allSpecDescsOk = missingSpecDescs.length === 0
  const generalDescOk = description.trim().length > 0
  const canStep4 = generalDescOk && allSpecDescsOk
  const canStep5 =
    pricing.hour > 0 &&
    pricing.hours2 > 0 &&
    pricing.hours3 > 0 &&
    pricing.hours4 > 0
  const step4BlockReason = !generalDescOk
    ? 'Renseignez la description générale.'
    : !allSpecDescsOk
      ? `Complétez encore : ${missingSpecDescs.join(', ')}.`
      : null

  function toggleSpec(spec: CategoryLabel) {
    setSpecialties((list) =>
      list.includes(spec) ? list.filter((s) => s !== spec) : [...list, spec],
    )
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

  function setMediaSpecialty(id: string, specialty: CategoryLabel | '') {
    setMedia((list) =>
      list.map((m) =>
        m.id === id
          ? specialty
            ? { ...m, specialty }
            : { id: m.id, src: m.src }
          : m,
      ),
    )
  }

  function removeMedia(id: string) {
    setMedia((list) => list.filter((m) => m.id !== id))
  }

  function activePricingGrid(): PricingGrid {
    if (pricingSpec !== 'all' && pricingBySpecialty[pricingSpec]) {
      return pricingBySpecialty[pricingSpec]!
    }
    return pricing
  }

  function patchActivePricing(next: PricingGrid) {
    if (pricingSpec === 'all') {
      setPricing(next)
      const forAll: Partial<Record<CategoryLabel, PricingGrid>> = {}
      for (const spec of specialties) {
        forAll[spec] = { ...next }
      }
      setPricingBySpecialty(forAll)
    } else {
      setPricingBySpecialty((v) => ({ ...v, [pricingSpec]: next }))
    }
  }

  function finish() {
    const bySpec: Partial<Record<CategoryLabel, PricingGrid>> = {
      ...pricingBySpecialty,
    }
    for (const spec of specialties) {
      if (!bySpec[spec]) bySpec[spec] = { ...pricing }
    }
    const id = createPlace({
      name,
      street,
      postalCode,
      city,
      email,
      phone,
      emailVisible,
      phoneVisible,
      description,
      specialties,
      descriptionBySpecialty: specDescs,
      pricing,
      pricingBySpecialty: bySpec,
      media,
      slots,
      slotsBySpecialty,
    })
    reset()
    onClose()
    onCreated(id)
  }

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="owner-onboard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-onboard-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="owner-onboard__backdrop"
            aria-label="Fermer"
            onClick={close}
          />
          <motion.div
            className="owner-onboard__panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <header className="owner-onboard__head">
              <div className="owner-onboard__head-main">
                {step > 1 ? (
                  <button
                    type="button"
                    className="owner-onboard__back"
                    onClick={goPrev}
                    aria-label="Étape précédente"
                    title="Étape précédente"
                  >
                    ‹
                  </button>
                ) : (
                  <span className="owner-onboard__back-spacer" aria-hidden />
                )}
                <div>
                  <p className="owner-onboard__kicker">
                    Nouveau lieu · {step}/6
                  </p>
                  <h2 id="owner-onboard-title">
                    {step === 1 && 'Identité & contact'}
                    {step === 2 && 'Studios / métiers'}
                    {step === 3 && 'Photos'}
                    {step === 4 && 'Descriptions'}
                    {step === 5 && 'Grille tarifaire'}
                    {step === 6 && 'Disponibilités'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="owner-onboard__close"
                onClick={close}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <div className="owner-onboard__progress" aria-hidden>
              {([1, 2, 3, 4, 5, 6] as Step[]).map((n) => (
                <i key={n} className={step >= n ? 'is-on' : ''} />
              ))}
            </div>

            <div className="owner-onboard__body">
              {step === 1 && (
                <div className="owner-onboard__step">
                  <label>
                    Nom du lieu
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex. Feel Haussmann"
                      autoFocus
                    />
                  </label>
                  <label>
                    Adresse (n° + rue)
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Ex. 135 boulevard Haussmann"
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
                        placeholder="75008"
                      />
                    </label>
                    <label>
                      Ville
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Paris"
                      />
                    </label>
                  </div>
                  <label>
                    E-mail d’accueil
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="accueil@monlieu.fr"
                    />
                  </label>
                  <label className="owner-create__check">
                    <input
                      type="checkbox"
                      checked={emailVisible}
                      onChange={(e) => setEmailVisible(e.target.checked)}
                    />
                    <span>Afficher l’e-mail sur la fiche professionnelle</span>
                  </label>
                  <label>
                    Téléphone
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(formatFrenchPhone(e.target.value))
                      }
                      inputMode="numeric"
                      placeholder="01 42 00 00 00"
                    />
                  </label>
                  <label className="owner-create__check">
                    <input
                      type="checkbox"
                      checked={phoneVisible}
                      onChange={(e) => setPhoneVisible(e.target.checked)}
                    />
                    <span>
                      Afficher le téléphone sur la fiche professionnelle
                    </span>
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="owner-onboard__step">
                  <p className="owner-onboard__guide">
                    Sélectionnez les studios / métiers proposés dans ce lieu.
                  </p>
                  <div className="owner-create__specs">
                    {CATEGORIES.map((cat) => {
                      const on = specialties.includes(cat.label)
                      return (
                        <button
                          key={cat.label}
                          type="button"
                          className={`owner-create__spec${on ? ' is-active' : ''}`}
                          style={
                            {
                              ['--spec-color' as string]: colorOf(cat.label),
                            } as CSSProperties
                          }
                          aria-pressed={on}
                          onClick={() => toggleSpec(cat.label)}
                        >
                          <span className="owner-create__spec-fill" aria-hidden />
                          <span className="owner-create__spec-label">
                            {cat.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="owner-create__other-hint">
                    Métier manquant ? Écrivez-moi ou appelez-moi, je l’ajoute —{' '}
                    <span className="owner-create__other-hint-contact">
                      {SUPPORT_EMAIL} · {SUPPORT_PHONE_DISPLAY}
                    </span>
                  </p>
                </div>
              )}

              {step === 3 && (
                <div className="owner-onboard__step">
                  <p className="owner-onboard__guide">
                    Ajoutez des photos en vrac, puis assignez chaque cliché à un
                    studio (ou laissez « Commun » pour l’accueil / les espaces
                    partagés).
                  </p>
                  <div className="owner-onboard__photo-actions">
                    <label className="owner-onboard__upload">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onUploadFiles}
                      />
                      Importer des photos
                    </label>
                  </div>
                  <p className="owner-onboard__mini">Ou choisir une image démo :</p>
                  <div className="owner-onboard__pool">
                    {PHOTO_POOL.map((src) => (
                      <button
                        key={src}
                        type="button"
                        className="owner-onboard__pool-btn"
                        style={{ backgroundImage: `url(${src})` }}
                        aria-label="Ajouter cette photo"
                        onClick={() => addPhotoFromPool(src)}
                      />
                    ))}
                  </div>
                  {media.length === 0 ? (
                    <p className="owner-home__empty">
                      Aucune photo pour l’instant.
                    </p>
                  ) : (
                    <ul className="owner-onboard__media-list">
                      {media.map((m, i) => (
                        <li key={m.id}>
                          <div
                            className="owner-onboard__media-thumb"
                            style={{ backgroundImage: `url(${m.src})` }}
                          >
                            {i === 0 && (
                              <span className="owner-onboard__cover-badge">
                                Couverture
                              </span>
                            )}
                          </div>
                          <label>
                            Assignation
                            <select
                              value={m.specialty ?? ''}
                              onChange={(e) =>
                                setMediaSpecialty(
                                  m.id,
                                  e.target.value as CategoryLabel | '',
                                )
                              }
                            >
                              <option value="">Commun / accueil</option>
                              {specialties.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="owner-onboard__media-remove"
                            onClick={() => removeMedia(m.id)}
                          >
                            Retirer
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="owner-onboard__step">
                  <p className="owner-onboard__guide">
                    Décrivez l’ambiance générale, les options, ce qui rend votre
                    lieu agréable. Puis détaillez chaque studio (m², matériel,
                    règles…).
                  </p>
                  <label>
                    Description générale
                    <BulletTextarea
                      rows={5}
                      value={description}
                      onChange={setDescription}
                      placeholder="Ambiance, accueil, équipements communs, parking…"
                    />
                  </label>
                  <p className="owner-onboard__mini">
                    Studios à détailler
                    {!allSpecDescsOk && (
                      <span> — tous doivent être complétés pour continuer</span>
                    )}
                  </p>
                  <div className="owner-create__specs">
                    {specialties.map((spec) => {
                      const done = Boolean((specDescs[spec] ?? '').trim())
                      return (
                        <button
                          key={spec}
                          type="button"
                          className={`owner-create__spec owner-onboard__spec-pulse${done ? ' is-done' : ''}${activeSpecDesc === spec ? ' is-active' : ''}`}
                          style={
                            {
                              ['--spec-color' as string]: colorOf(spec),
                            } as CSSProperties
                          }
                          onClick={() => setActiveSpecDesc(spec)}
                        >
                          <span className="owner-create__spec-fill" aria-hidden />
                          <span className="owner-create__spec-label">
                            {spec}
                            {done ? ' ✓' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {activeSpecDesc && (
                    <div className="owner-onboard__spec-panel">
                      <h3>Description · {activeSpecDesc}</h3>
                      <p className="owner-onboard__guide">
                        Donnez des détails sur cet espace : surface (m²),
                        matériel à disposition, capacités, consignes
                        spécifiques… Ne pas indiquer les informations
                        techniques — uniquement les infos commerciales pour le
                        moment.
                      </p>
                      <BulletTextarea
                        rows={4}
                        value={specDescs[activeSpecDesc] ?? ''}
                        onChange={(value) => {
                          const spec = activeSpecDesc
                          setSpecDescs((v) => ({
                            ...v,
                            [spec]: value,
                          }))
                        }}
                        placeholder={`Ex. Cabine ${activeSpecDesc}, ~12 m², fauteuil, point d’eau…`}
                        autoFocus
                      />
                    </div>
                  )}
                  {step4BlockReason && (
                    <p className="owner-onboard__block-hint" role="status">
                      {step4BlockReason}
                    </p>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="owner-onboard__step">
                  {specialties.length > 0 && (
                    <div className="owner-create__specs owner-onboard__pricing-specs">
                      <button
                        type="button"
                        className={`owner-create__spec owner-onboard__pricing-default${pricingSpec === 'all' ? ' is-active' : ''}`}
                        onClick={() => setPricingSpec('all')}
                      >
                        <span className="owner-create__spec-fill" aria-hidden />
                        <span className="owner-create__spec-label">
                          Pour tous
                        </span>
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
                  )}
                  <ul className="owner-pricing-compact">
                    {HOUR_ROWS.map((row) => (
                      <li key={row.key}>
                        <label>
                          {row.label}
                          <span className="owner-pricing-compact__input">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                              value={
                                activePricingGrid()[row.key]
                                  ? String(activePricingGrid()[row.key])
                                  : ''
                              }
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '')
                                patchActivePricing({
                                  ...activePricingGrid(),
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
                  <div className="owner-pricing-devis">
                    <p>
                      Au-delà de 4&nbsp;h, c’est sur devis, en contact direct
                      avec vous. Indiquez ici seulement vos prix à partir de :
                    </p>
                    <ul className="owner-pricing-compact is-from">
                      {FROM_ROWS.map((row) => (
                        <li key={row.key}>
                          <label>
                            {row.label}
                            <span className="owner-pricing-compact__input">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete="off"
                                value={
                                  activePricingGrid()[row.key]
                                    ? String(activePricingGrid()[row.key])
                                    : ''
                                }
                                placeholder="—"
                                onChange={(e) => {
                                  const digits = e.target.value.replace(
                                    /\D/g,
                                    '',
                                  )
                                  patchActivePricing({
                                    ...activePricingGrid(),
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
                </div>
              )}

              {step === 6 && (
                <div
                  className="owner-onboard__step owner-onboard__step--cal"
                  style={
                    { ['--cal-accent' as string]: calAccent } as CSSProperties
                  }
                >
                  <p className="owner-onboard__cal-section">
                    Horaires du centre & des spécialités
                  </p>

                  <div className="owner-create__specs owner-onboard__pricing-specs owner-onboard__cal-specs">
                    <button
                      type="button"
                      className={`owner-create__spec owner-onboard__pricing-default${calSpec === 'all' ? ' is-active' : ''}`}
                      onClick={() => selectCalSpec('all')}
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
                        onClick={() => selectCalSpec(s)}
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
                          aria-pressed={!closed}
                          onClick={() => toggleClosedWeekday(d.value)}
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
                          onChange={(e) => onToggleSameHours(e.target.checked)}
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
                            <div
                              key={d.value}
                              className="owner-onboard__day-row"
                            >
                              <span className="owner-onboard__day-row-label">
                                {d.short}
                              </span>
                              <select
                                value={hrs.start}
                                aria-label={`${d.label} ouverture`}
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
                                aria-label={`${d.label} fermeture`}
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

            <footer className="owner-onboard__foot">
              {step > 1 ? (
                <button
                  type="button"
                  className="owner-create__secondary"
                  onClick={goPrev}
                >
                  ← Retour
                </button>
              ) : (
                <button
                  type="button"
                  className="owner-create__secondary"
                  onClick={close}
                >
                  Annuler
                </button>
              )}
              {step < 6 ? (
                <button
                  type="button"
                  className="owner-profile__primary"
                  disabled={
                    (step === 1 && !canStep1) ||
                    (step === 2 && !canStep2) ||
                    (step === 3 && !canStep3) ||
                    (step === 4 && !canStep4) ||
                    (step === 5 && !canStep5)
                  }
                  onClick={() => {
                    if (step === 3) {
                      setActiveSpecDesc(specialties[0] ?? null)
                    }
                    if (step === 4) {
                      setPricingSpec('all')
                    }
                    if (step === 5) {
                      selectCalSpec('all')
                      setSameHoursAllDays(true)
                    }
                    setStep((s) => (s + 1) as Step)
                  }}
                >
                  Continuer
                </button>
              ) : (
                <button
                  type="button"
                  className="owner-profile__primary"
                  onClick={finish}
                >
                  Voir ma fiche pro
                </button>
              )}
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
