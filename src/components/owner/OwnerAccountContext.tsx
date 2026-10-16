import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  TIME_STEP_MINUTES,
  exceptionForSlot,
  formatMinutes,
  startOfDay,
  weeklyMinutesOnDate,
  type AvailSlot,
  type SlotException,
  type WeekDay,
} from '../../data/availability'
import { type CategoryLabel } from '../../data/categories'
import { normalizePricing, type PricingGrid } from '../../data/places'
import { formatFrenchPhone } from '../../data/phone'

export type OwnerBookingStatus =
  | 'confirmed'
  | 'pending'
  | 'no_show'
  | 'cancelled'

export type OwnerBooking = {
  id: string
  placeId: string
  placeName: string
  proName: string
  /** E-mail du professionnel (rapport clients) */
  proEmail?: string
  specialty: CategoryLabel | string
  day: Date
  startMinutes: number
  durationMin: number
  price: number
  status: OwnerBookingStatus
  /** Accès porte / digicode */
  accessCode: string
  accessKind: 'code' | 'qr'
}

export function ownerBookingStatusLabel(status: OwnerBookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmée'
    case 'pending':
      return 'En attente'
    case 'no_show':
      return 'No-show'
    case 'cancelled':
      return 'Annulée'
  }
}

export type OwnerMedia = {
  id: string
  src: string
  /** Studio associé — omis = espaces communs */
  specialty?: CategoryLabel
}

export type OwnerPlace = {
  id: string
  name: string
  /** Numéro + rue */
  street: string
  postalCode: string
  city: string
  email: string
  phone: string
  /** Visible sur la fiche pro */
  emailVisible: boolean
  phoneVisible: boolean
  description: string
  specialties: CategoryLabel[]
  descriptionBySpecialty: Partial<Record<CategoryLabel, string>>
  /** Message post-réservation par studio (accès, digicode…) */
  postBookingMessageBySpecialty: Partial<Record<CategoryLabel, string>>
  pricing: PricingGrid
  pricingBySpecialty: Partial<Record<CategoryLabel, PricingGrid>>
  /** Galerie (1ʳᵉ = couverture) */
  media: OwnerMedia[]
  /** Créneaux hebdo ouverts (absents = bloqués) — défaut « pour tous » */
  slots: AvailSlot[]
  /** Calendriers par studio (sinon fallback sur `slots`) */
  slotsBySpecialty: Partial<Record<CategoryLabel, AvailSlot[]>>
  /** Blocages ponctuels jour / demi-heure (+ notes) */
  slotExceptions: SlotException[]
  /** Formations & événements (visibles côté pro) */
  events: OwnerEvent[]
  image: string
  createdAt: string
}

export type OwnerEvent = {
  id: string
  title: string
  description: string
}

/** Affichage normalisé : « 12 rue X, 75008 Paris » */
export function formatOwnerAddress(place: Pick<OwnerPlace, 'street' | 'postalCode' | 'city'>) {
  const cityLine = [place.postalCode.trim(), place.city.trim()]
    .filter(Boolean)
    .join(' ')
  return [place.street.trim(), cityLine].filter(Boolean).join(', ')
}

const STORAGE_KEY = 'feel-owner-v2'
const DEFAULT_IMAGE = '/inspiration-cabine.jpg'

const WEEKDAYS: WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export function defaultPricing(): PricingGrid {
  return normalizePricing({
    hour: 40,
    hours2: 74,
    hours3: 105,
    hours4: 128,
  })
}

/** Créneaux hebdo ouverts (lun–sam 9h–18h, pas de 30 min) */
export function defaultSlotsForOwnerPlace(): AvailSlot[] {
  const slots: AvailSlot[] = []
  const start = 9 * 60
  const end = 18 * 60
  for (const day of WEEKDAYS) {
    for (let m = start; m <= end; m += TIME_STEP_MINUTES) {
      slots.push({ day, minutes: m })
    }
  }
  return slots
}

function normalizePlace(raw: OwnerPlace & { address?: string }): OwnerPlace {
  const media =
    Array.isArray(raw.media) && raw.media.length > 0
      ? raw.media
      : raw.image
        ? [{ id: `${raw.id}-cover`, src: raw.image }]
        : []
  return {
    ...raw,
    street: raw.street ?? raw.address ?? '',
    postalCode: raw.postalCode ?? '',
    city: raw.city ?? '',
    email: raw.email ?? '',
    phone: formatFrenchPhone(raw.phone ?? ''),
    emailVisible:
      raw.emailVisible ??
      (raw as OwnerPlace & { contactVisible?: boolean }).contactVisible ??
      false,
    phoneVisible:
      raw.phoneVisible ??
      (raw as OwnerPlace & { contactVisible?: boolean }).contactVisible ??
      false,
    media,
    slots: Array.isArray(raw.slots) ? raw.slots : defaultSlotsForOwnerPlace(),
    slotsBySpecialty: (() => {
      const base = Array.isArray(raw.slots) ? raw.slots : defaultSlotsForOwnerPlace()
      const map: Partial<Record<CategoryLabel, AvailSlot[]>> = {
        ...(raw.slotsBySpecialty ?? {}),
      }
      for (const spec of raw.specialties ?? []) {
        if (!map[spec]?.length) map[spec] = base
      }
      return map
    })(),
    slotExceptions: Array.isArray(raw.slotExceptions) ? raw.slotExceptions : [],
    events: Array.isArray(raw.events)
      ? raw.events
          .filter((e) => e && typeof e.title === 'string' && e.title.trim())
          .map((e) => ({
            id: e.id || `event-${Math.random().toString(36).slice(2, 9)}`,
            title: e.title.trim(),
            description:
              typeof e.description === 'string' ? e.description.trim() : '',
          }))
      : [],
    image: media[0]?.src ?? raw.image ?? DEFAULT_IMAGE,
    descriptionBySpecialty: raw.descriptionBySpecialty ?? {},
    postBookingMessageBySpecialty: Object.fromEntries(
      Object.entries(raw.postBookingMessageBySpecialty ?? {}).map(([k, v]) => [
        k,
        typeof v === 'string' &&
        ['digicode', 'welcome', 'contact', 'later'].includes(v)
          ? ''
          : String(v ?? ''),
      ]),
    ) as OwnerPlace['postBookingMessageBySpecialty'],
    pricing: normalizePricing(raw.pricing),
    pricingBySpecialty: Object.fromEntries(
      Object.entries(raw.pricingBySpecialty ?? {}).map(([k, v]) => [
        k,
        normalizePricing(v),
      ]),
    ) as OwnerPlace['pricingBySpecialty'],
    specialties: raw.specialties ?? [],
  }
}

export type OwnerProfile = {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  postalCode: string
  city: string
  billingName: string
  siret: string
}

export const EMPTY_OWNER_PROFILE: OwnerProfile = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  billingName: '',
  siret: '',
}

type StoredBooking = Omit<OwnerBooking, 'day'> & { day: string }

type StoredOwner = {
  profile: OwnerProfile
  places: OwnerPlace[]
  bookings: StoredBooking[]
}

export function pricingForOwnerSpecialty(
  place: OwnerPlace,
  specialty: CategoryLabel | 'all',
): PricingGrid {
  if (specialty !== 'all' && place.pricingBySpecialty[specialty]) {
    return place.pricingBySpecialty[specialty]!
  }
  return place.pricing
}

type OwnerAccountContextValue = {
  profile: OwnerProfile
  updateProfile: (patch: Partial<OwnerProfile>) => void
  places: OwnerPlace[]
  bookings: OwnerBooking[]
  getPlace: (id: string) => OwnerPlace | undefined
  bookingsForPlace: (placeId: string) => OwnerBooking[]
  updateBooking: (id: string, patch: Partial<OwnerBooking>) => void
  setBookingStatus: (id: string, status: OwnerBookingStatus) => void
  createBooking: (
    input: Omit<OwnerBooking, 'id' | 'accessCode' | 'accessKind' | 'placeName'> & {
      accessKind?: 'code' | 'qr'
    },
  ) => string
  regenerateAccess: (id: string) => void
  createPlace: (
    input: Omit<
      OwnerPlace,
      | 'id'
      | 'createdAt'
      | 'image'
      | 'slotExceptions'
      | 'events'
      | 'postBookingMessageBySpecialty'
    > & {
      image?: string
      slotExceptions?: SlotException[]
      events?: OwnerEvent[]
      postBookingMessageBySpecialty?: OwnerPlace['postBookingMessageBySpecialty']
    },
  ) => string
  updatePlace: (id: string, patch: Partial<OwnerPlace>) => void
  removePlace: (placeId: string) => void
  resetAccount: () => void
}

const OwnerAccountContext = createContext<OwnerAccountContextValue | null>(null)

function endsAt(b: OwnerBooking) {
  return startOfDay(b.day).getTime() + (b.startMinutes + b.durationMin) * 60_000
}

export function formatOwnerBookingDate(day: Date) {
  return day.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatOwnerBookingTime(start: number, duration: number) {
  return `${formatMinutes(start)} – ${formatMinutes(start + duration)}`
}

export function generateAccessCode(seed?: string): string {
  const base = (seed ?? `${Date.now()}-${Math.random()}`)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
  const chunk = (base + 'FEELSTUDIO').slice(0, 8)
  return `${chunk.slice(0, 4)}-${chunk.slice(4, 8)}`
}

export function bookingCoversMinutes(
  booking: Pick<OwnerBooking, 'startMinutes' | 'durationMin'>,
  minutes: number,
): boolean {
  return (
    minutes >= booking.startMinutes &&
    minutes < booking.startMinutes + booking.durationMin
  )
}

const DEMO_CLIENTS = [
  'Camille Martin',
  'Alex Dupont',
  'Sophie Bernard',
  'Jules Renard',
  'Léa Moreau',
  'Nina Petit',
  'Hugo Laurent',
  'Emma Rousseau',
  'Paul Girard',
  'Clara Fontaine',
] as const

const DEMO_DURATIONS = [60, 90, 120, 60, 180, 60, 120, 90, 60, 120] as const

/** Jours cibles : 2 RDV le 1er jour ouvert, puis un RDV par jour espacé */
const DEMO_DAY_OFFSETS = [1, 1, 3, 5, 7, 9, 12, 15, 18, 22] as const

function isDemoBooking(b: Pick<OwnerBooking, 'id'>): boolean {
  return b.id.startsWith('demo-')
}

function slotsForOwnerSpecialty(
  place: OwnerPlace,
  specialty: CategoryLabel,
): AvailSlot[] {
  const specific = place.slotsBySpecialty[specialty]
  // Tableau vide ≠ absent (spécialité ajoutée après sans horaires)
  return specific && specific.length > 0 ? specific : place.slots
}

function openMinutesForDemo(
  place: OwnerPlace,
  specialty: CategoryLabel,
  day: Date,
): number[] {
  const weekly = weeklyMinutesOnDate(
    slotsForOwnerSpecialty(place, specialty),
    day,
  )
  return weekly.filter(
    (minutes) =>
      !exceptionForSlot(place.slotExceptions, day, minutes, specialty) &&
      !exceptionForSlot(place.slotExceptions, day, minutes, 'all'),
  )
}

function demoPriceFor(
  place: OwnerPlace,
  specialty: CategoryLabel,
  durationMin: number,
): number {
  const grid = place.pricingBySpecialty[specialty] ?? place.pricing
  const hours = durationMin / 60
  if (hours >= 3) return grid.hours3 ?? grid.hours2 ?? grid.hour * 3
  if (hours >= 2) return grid.hours2 ?? grid.hour * 2
  return grid.hour ?? 40
}

function demoRangeFree(
  openSet: Set<number>,
  start: number,
  durationMin: number,
  taken: Set<string>,
  dayKey: string,
  specialty: string,
): boolean {
  for (let m = start; m < start + durationMin; m += 30) {
    if (!openSet.has(m)) return false
    if (taken.has(`${dayKey}|${specialty}|${m}`)) return false
  }
  return true
}

function markDemoTaken(
  taken: Set<string>,
  dayKey: string,
  specialty: string,
  start: number,
  durationMin: number,
) {
  for (let m = start; m < start + durationMin; m += 30) {
    taken.add(`${dayKey}|${specialty}|${m}`)
  }
}

type DemoCandidate = {
  day: Date
  dayKey: string
  specialty: CategoryLabel
  startMinutes: number
  durationMin: number
}

function demoDayKey(day: Date): string {
  return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
}

/** Cherche un créneau libre autour d’un jour cible (jamais sur un blocage) */
function findDemoSlot(
  place: OwnerPlace,
  specialty: CategoryLabel,
  today: Date,
  dayOffset: number,
  durationMin: number,
  taken: Set<string>,
  preferStart?: number,
): DemoCandidate | null {
  for (let drift = 0; drift <= 4; drift += 1) {
    const day = new Date(today)
    day.setDate(day.getDate() + dayOffset + drift)
    const dayKey = demoDayKey(day)
    const open = openMinutesForDemo(place, specialty, day)
    if (open.length === 0) continue
    const openSet = new Set(open)
    const starts =
      preferStart != null && open.includes(preferStart)
        ? [preferStart, ...open.filter((m) => m !== preferStart)]
        : open
    for (const start of starts) {
      for (const dur of [durationMin, 90, 60]) {
        if (demoRangeFree(openSet, start, dur, taken, dayKey, specialty)) {
          return {
            day,
            dayKey,
            specialty,
            startMinutes: start,
            durationMin: dur,
          }
        }
      }
    }
  }
  return null
}

/** Créneau libre un jour calendaire précis (ex. novembre) */
function findDemoSlotOnCalendarDay(
  place: OwnerPlace,
  specialty: CategoryLabel,
  day: Date,
  durationMin: number,
  taken: Set<string>,
  preferStart?: number,
): DemoCandidate | null {
  if (day < startOfDay(new Date())) return null
  const dayKey = demoDayKey(day)
  const open = openMinutesForDemo(place, specialty, day)
  if (open.length === 0) return null
  const openSet = new Set(open)
  const starts =
    preferStart != null && open.includes(preferStart)
      ? [preferStart, ...open.filter((m) => m !== preferStart)]
      : open
  for (const start of starts) {
    for (const dur of [durationMin, 90, 60]) {
      if (demoRangeFree(openSet, start, dur, taken, dayKey, specialty)) {
        return {
          day: startOfDay(day),
          dayKey,
          specialty,
          startMinutes: start,
          durationMin: dur,
        }
      }
    }
  }
  return null
}

/** 2 Coiffeur + 2 Épilation répartis en novembre (jours ouverts uniquement) */
function pickNovemberDemos(
  place: OwnerPlace,
  taken: Set<string>,
): DemoCandidate[] {
  const now = new Date()
  // Prochain novembre à venir (ou novembre en cours)
  const year =
    now.getMonth() > 10 ? now.getFullYear() + 1 : now.getFullYear()
  const month = 10 // novembre (0-index)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const plan: {
    specialty: CategoryLabel
    preferDays: number[]
    startHour: number
    durationMin: number
  }[] = [
    {
      specialty: 'Coiffeur',
      preferDays: [5, 6, 4, 7, 3, ...allDays],
      startHour: 10,
      durationMin: 120,
    },
    {
      specialty: 'Coiffeur',
      preferDays: [18, 19, 17, 20, 21, ...allDays],
      startHour: 14,
      durationMin: 60,
    },
    {
      specialty: 'Épilation',
      preferDays: [12, 13, 11, 14, 10, ...allDays],
      startHour: 11,
      durationMin: 90,
    },
    {
      specialty: 'Épilation',
      preferDays: [25, 26, 24, 27, 28, ...allDays],
      startHour: 15,
      durationMin: 60,
    },
  ]
  const out: DemoCandidate[] = []

  for (const item of plan) {
    if (!place.specialties.includes(item.specialty)) continue
    let slot: DemoCandidate | null = null
    const seen = new Set<number>()
    for (const d of item.preferDays) {
      if (seen.has(d) || d < 1 || d > daysInMonth) continue
      seen.add(d)
      slot = findDemoSlotOnCalendarDay(
        place,
        item.specialty,
        new Date(year, month, d),
        item.durationMin,
        taken,
        item.startHour * 60,
      )
      if (slot) break
    }
    if (!slot) continue
    markDemoTaken(
      taken,
      slot.dayKey,
      slot.specialty,
      slot.startMinutes,
      slot.durationMin,
    )
    out.push(slot)
  }
  return out
}

/** RDV démo / lieu : étalés + 4 ciblés en novembre (Coiffeur / Épilation) */
function buildDemoBookings(places: OwnerPlace[]): OwnerBooking[] {
  const today = startOfDay(new Date())
  const out: OwnerBooking[] = []

  for (const place of places) {
    const specs = place.specialties
    if (specs.length === 0) continue
    const placeName = place.name.trim() || 'Lieu'
    const taken = new Set<string>()
    const picked: DemoCandidate[] = []
    const preferredStarts = [
      11 * 60, 15 * 60, 9 * 60, 14 * 60, 10 * 60, 16 * 60, 11 * 60, 13 * 60,
      9 * 60, 15 * 60,
    ]

    for (let i = 0; i < DEMO_DAY_OFFSETS.length; i += 1) {
      const specialty = specs[i % specs.length]!
      const durationMin = DEMO_DURATIONS[i % DEMO_DURATIONS.length]!
      const slot = findDemoSlot(
        place,
        specialty,
        today,
        DEMO_DAY_OFFSETS[i]!,
        durationMin,
        taken,
        preferredStarts[i],
      )
      if (!slot) continue
      markDemoTaken(
        taken,
        slot.dayKey,
        slot.specialty,
        slot.startMinutes,
        slot.durationMin,
      )
      picked.push(slot)
    }

    const baseCount = picked.length
    const novemberPicks = pickNovemberDemos(place, taken)
    picked.push(...novemberPicks)

    const novNames = [
      'Inès Lefèvre',
      'Thomas Caron',
      'Chloé Mercier',
      'Antoine Vidal',
    ]

    picked.forEach((c, i) => {
      const novIndex = i - baseCount
      const proName =
        novIndex >= 0
          ? novNames[novIndex % novNames.length]!
          : DEMO_CLIENTS[i % DEMO_CLIENTS.length]!
      const bookingId = `demo-${place.id}-${i + 1}`
      out.push({
        id: bookingId,
        placeId: place.id,
        placeName,
        proName,
        proEmail: demoEmailFromName(proName),
        specialty: c.specialty,
        day: c.day,
        startMinutes: c.startMinutes,
        durationMin: c.durationMin,
        price: demoPriceFor(place, c.specialty, c.durationMin),
        status: i % 3 === 1 ? 'pending' : 'confirmed',
        accessCode: generateAccessCode(bookingId),
        accessKind: i % 2 === 0 ? 'qr' : 'code',
      })
    })
  }

  return out
}

function demoEmailFromName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
  return `${slug || 'pro'}@studio-pro.fr`
}

function normalizeProfile(
  raw:
    | (Partial<OwnerProfile> & {
        billingAddress?: string
        billingStreet?: string
      })
    | undefined,
): OwnerProfile {
  const legacyStreet =
    raw?.street?.trim() ||
    raw?.billingStreet?.trim() ||
    raw?.billingAddress?.trim() ||
    ''
  return {
    ...EMPTY_OWNER_PROFILE,
    firstName: raw?.firstName ?? '',
    lastName: raw?.lastName ?? '',
    email: raw?.email ?? '',
    phone: formatFrenchPhone(raw?.phone ?? ''),
    street: legacyStreet,
    postalCode: (raw?.postalCode ?? '').replace(/\D/g, '').slice(0, 5),
    city: raw?.city ?? '',
    billingName: raw?.billingName ?? '',
    siret: raw?.siret ?? '',
  }
}

function loadStored(): StoredOwner {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.removeItem('feel-owner-v1')
      return { profile: EMPTY_OWNER_PROFILE, places: [], bookings: [] }
    }
    const parsed = JSON.parse(raw) as Partial<StoredOwner>
    return {
      profile: normalizeProfile(parsed.profile),
      places: Array.isArray(parsed.places)
        ? parsed.places.map((p) =>
            normalizePlace(p as OwnerPlace & { address?: string }),
          )
        : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
    }
  } catch {
    return { profile: EMPTY_OWNER_PROFILE, places: [], bookings: [] }
  }
}

function normalizeBookingStatus(raw: unknown): OwnerBookingStatus {
  if (raw === 'pending') return 'pending'
  if (raw === 'no_show') return 'no_show'
  if (raw === 'cancelled') return 'cancelled'
  return 'confirmed'
}

function toBookings(stored: StoredBooking[]): OwnerBooking[] {
  return stored.map((b) => ({
    ...b,
    day: startOfDay(new Date(b.day)),
    status: normalizeBookingStatus(b.status),
    accessCode: b.accessCode?.trim() || generateAccessCode(b.id),
    accessKind: b.accessKind === 'qr' ? 'qr' : 'code',
  }))
}

export function OwnerAccountProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadStored(), [])
  const [profile, setProfile] = useState<OwnerProfile>(initial.profile)
  const [places, setPlaces] = useState<OwnerPlace[]>(initial.places)
  const [bookings, setBookings] = useState<OwnerBooking[]>(() => {
    const existing = toBookings(initial.bookings)
    const real = existing.filter((b) => !isDemoBooking(b))
    const demos = buildDemoBookings(initial.places)
    return [...real, ...demos].sort((a, b) => endsAt(a) - endsAt(b))
  })

  const demoSeedKey = places
    .map((p) => `${p.id}:${[...p.specialties].sort().join(',')}`)
    .join('|')

  // Régénère les RDV démo si les spécialités du lieu changent (ex. Coiffeur ajouté après)
  useEffect(() => {
    setBookings((list) => {
      const real = list.filter((b) => !isDemoBooking(b))
      const demos = buildDemoBookings(places)
      return [...real, ...demos].sort((a, b) => endsAt(a) - endsAt(b))
    })
    // places lu au moment où les spécialités changent (demoSeedKey)
  }, [demoSeedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const payload: StoredOwner = {
      profile,
      places,
      bookings: bookings.map((b) => ({
        ...b,
        day: startOfDay(b.day).toISOString(),
      })),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [profile, places, bookings])

  const updateProfile = useCallback((patch: Partial<OwnerProfile>) => {
    setProfile((p) => ({ ...p, ...patch }))
  }, [])

  const getPlace = useCallback(
    (id: string) => places.find((p) => p.id === id),
    [places],
  )

  const bookingsForPlace = useCallback(
    (placeId: string) =>
      bookings
        .filter((b) => b.placeId === placeId)
        .sort((a, b) => endsAt(a) - endsAt(b)),
    [bookings],
  )

  const updateBooking = useCallback(
    (id: string, patch: Partial<OwnerBooking>) => {
      setBookings((list) =>
        list.map((b) => (b.id === id ? { ...b, ...patch, id: b.id } : b)),
      )
    },
    [],
  )

  const setBookingStatus = useCallback(
    (id: string, status: OwnerBookingStatus) => {
      setBookings((list) =>
        list.map((b) => (b.id === id ? { ...b, status } : b)),
      )
    },
    [],
  )

  const createBooking = useCallback(
    (
      input: Omit<
        OwnerBooking,
        'id' | 'accessCode' | 'accessKind' | 'placeName'
      > & {
        accessKind?: 'code' | 'qr'
      },
    ) => {
      const place = places.find((p) => p.id === input.placeId)
      const id = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const booking: OwnerBooking = {
        id,
        placeId: input.placeId,
        placeName: place?.name.trim() || 'Lieu',
        proName: input.proName.trim(),
        proEmail: input.proEmail?.trim() || undefined,
        specialty: input.specialty,
        day: startOfDay(input.day),
        startMinutes: input.startMinutes,
        durationMin: input.durationMin,
        price: input.price,
        status: input.status,
        accessCode: generateAccessCode(id),
        accessKind: input.accessKind ?? 'code',
      }
      setBookings((list) =>
        [...list, booking].sort((a, b) => endsAt(a) - endsAt(b)),
      )
      return id
    },
    [places],
  )

  const regenerateAccess = useCallback((id: string) => {
    setBookings((list) =>
      list.map((b) =>
        b.id === id
          ? {
              ...b,
              accessCode: generateAccessCode(`${id}-${Date.now()}`),
            }
          : b,
      ),
    )
  }, [])

  const createPlace = useCallback(
    (
      input: Omit<
        OwnerPlace,
        | 'id'
        | 'createdAt'
        | 'image'
        | 'slotExceptions'
        | 'events'
        | 'postBookingMessageBySpecialty'
      > & {
        image?: string
        slotExceptions?: SlotException[]
        events?: OwnerEvent[]
        postBookingMessageBySpecialty?: OwnerPlace['postBookingMessageBySpecialty']
      },
    ) => {
      const id = `owner-place-${Date.now()}`
      const pricing = input.pricing ?? defaultPricing()
      const pricingBySpecialty: Partial<Record<CategoryLabel, PricingGrid>> = {
        ...input.pricingBySpecialty,
      }
      for (const spec of input.specialties) {
        if (!pricingBySpecialty[spec]) pricingBySpecialty[spec] = { ...pricing }
      }
      const media =
        input.media?.length > 0
          ? input.media
          : [{ id: `${id}-cover`, src: input.image ?? DEFAULT_IMAGE }]
      const place: OwnerPlace = {
        id,
        name: input.name.trim(),
        street: input.street.trim(),
        postalCode: input.postalCode.trim(),
        city: input.city.trim(),
        email: input.email.trim(),
        phone: formatFrenchPhone(input.phone),
        emailVisible: Boolean(input.emailVisible),
        phoneVisible: Boolean(input.phoneVisible),
        description: input.description.trim(),
        specialties: input.specialties,
        descriptionBySpecialty: input.descriptionBySpecialty ?? {},
        postBookingMessageBySpecialty:
          input.postBookingMessageBySpecialty ?? {},
        pricing,
        pricingBySpecialty,
        media,
        slots: input.slots?.length ? input.slots : defaultSlotsForOwnerPlace(),
        slotsBySpecialty: input.slotsBySpecialty ?? {},
        slotExceptions: input.slotExceptions ?? [],
        events: input.events ?? [],
        image: media[0]?.src ?? DEFAULT_IMAGE,
        createdAt: new Date().toISOString(),
      }
      setPlaces((list) => [...list, place])
      setBookings((list) =>
        [...list, ...buildDemoBookings([place])].sort(
          (a, b) => endsAt(a) - endsAt(b),
        ),
      )
      return id
    },
    [],
  )

  const updatePlace = useCallback((id: string, patch: Partial<OwnerPlace>) => {
    setPlaces((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  }, [])

  const removePlace = useCallback((placeId: string) => {
    setPlaces((list) => list.filter((p) => p.id !== placeId))
    setBookings((list) => list.filter((b) => b.placeId !== placeId))
  }, [])

  const resetAccount = useCallback(() => {
    setProfile(EMPTY_OWNER_PROFILE)
    setPlaces([])
    setBookings([])
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('feel-owner-v1')
  }, [])

  const value = useMemo(
    () => ({
      profile,
      updateProfile,
      places,
      bookings,
      getPlace,
      bookingsForPlace,
      updateBooking,
      setBookingStatus,
      createBooking,
      regenerateAccess,
      createPlace,
      updatePlace,
      removePlace,
      resetAccount,
    }),
    [
      profile,
      updateProfile,
      places,
      bookings,
      getPlace,
      bookingsForPlace,
      updateBooking,
      setBookingStatus,
      createBooking,
      regenerateAccess,
      createPlace,
      updatePlace,
      removePlace,
      resetAccount,
    ],
  )

  return (
    <OwnerAccountContext.Provider value={value}>
      {children}
    </OwnerAccountContext.Provider>
  )
}

export function useOwnerAccount() {
  const ctx = useContext(OwnerAccountContext)
  if (!ctx) {
    throw new Error('useOwnerAccount must be used within OwnerAccountProvider')
  }
  return ctx
}
