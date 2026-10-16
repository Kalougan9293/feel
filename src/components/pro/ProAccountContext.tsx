import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { formatMinutes, startOfDay } from '../../data/availability'
import { PLACES } from '../../data/places'
import type { CategoryLabel } from '../../data/categories'

export type ProAccess =
  | { kind: 'qr'; value: string }
  | { kind: 'pin'; value: string }

export type ProBooking = {
  id: string
  placeId: string
  placeName: string
  specialty: CategoryLabel | string
  /** Jour du créneau (minuit local) */
  day: Date
  startMinutes: number
  durationMin: number
  price: number
  access: ProAccess
}

type ProAccountContextValue = {
  favoriteIds: string[]
  isFavorite: (placeId: string) => boolean
  toggleFavorite: (placeId: string) => void
  removeFavorite: (placeId: string) => void
  bookings: ProBooking[]
  upcoming: ProBooking[]
  past: ProBooking[]
  addBooking: (booking: Omit<ProBooking, 'id' | 'access'> & { access?: ProAccess }) => void
}

const ProAccountContext = createContext<ProAccountContextValue | null>(null)

function addDays(d: Date, n: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return startOfDay(out)
}

function makeAccess(seed: string): ProAccess {
  const n = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  if (n % 2 === 0) {
    return { kind: 'qr', value: `FEEL-${seed.slice(0, 8).toUpperCase()}` }
  }
  return { kind: 'pin', value: String(1000 + (n % 9000)) }
}

function seedBookings(): ProBooking[] {
  const today = startOfDay(new Date())
  const p0 = PLACES[0]
  const p1 = PLACES[1]
  const p2 = PLACES[2]
  if (!p0 || !p1 || !p2) return []

  return [
    {
      id: 'seed-up-1',
      placeId: p0.id,
      placeName: p0.name,
      specialty: p0.specialties[0] ?? 'Onglerie',
      day: addDays(today, 8),
      startMinutes: 14 * 60,
      durationMin: 120,
      price: 120,
      access: { kind: 'qr', value: 'FEEL-SEED-UP1' },
    },
    {
      id: 'seed-up-2',
      placeId: p1.id,
      placeName: p1.name,
      specialty: p1.specialties[0] ?? 'Esthétique',
      day: addDays(today, 18),
      startMinutes: 9 * 60,
      durationMin: 120,
      price: 132,
      access: { kind: 'pin', value: '4821' },
    },
    {
      id: 'seed-past-1',
      placeId: p0.id,
      placeName: p0.name,
      specialty: p0.specialties[0] ?? 'Onglerie',
      day: addDays(today, -10),
      startMinutes: 10 * 60,
      durationMin: 120,
      price: 90,
      access: { kind: 'pin', value: '1902' },
    },
    {
      id: 'seed-past-2',
      placeId: p2.id,
      placeName: p2.name,
      specialty: p2.specialties.includes('Coiffeur')
        ? 'Coiffeur'
        : (p2.specialties[0] ?? 'Coiffeur'),
      day: addDays(today, -25),
      startMinutes: 14 * 60,
      durationMin: 180,
      price: 150,
      access: { kind: 'qr', value: 'FEEL-SEED-PAST2' },
    },
  ]
}

function endsAt(b: ProBooking) {
  return startOfDay(b.day).getTime() + (b.startMinutes + b.durationMin) * 60_000
}

export function isBookingPast(b: ProBooking, now = new Date()) {
  return endsAt(b) < now.getTime()
}

export function formatBookingDate(day: Date) {
  return day.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatBookingTime(startMinutes: number, durationMin: number) {
  return `${formatMinutes(startMinutes)} – ${formatMinutes(startMinutes + durationMin)}`
}

export function ProAccountProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    PLACES.slice(0, 3).map((p) => p.id),
  )
  const [bookings, setBookings] = useState<ProBooking[]>(seedBookings)

  const isFavorite = useCallback(
    (placeId: string) => favoriteIds.includes(placeId),
    [favoriteIds],
  )

  const toggleFavorite = useCallback((placeId: string) => {
    setFavoriteIds((ids) =>
      ids.includes(placeId)
        ? ids.filter((id) => id !== placeId)
        : [...ids, placeId],
    )
  }, [])

  const removeFavorite = useCallback((placeId: string) => {
    setFavoriteIds((ids) => ids.filter((id) => id !== placeId))
  }, [])

  const addBooking = useCallback(
    (input: Omit<ProBooking, 'id' | 'access'> & { access?: ProAccess }) => {
      const id = `b-${Date.now()}-${Math.floor(Math.random() * 999)}`
      const access = input.access ?? makeAccess(id)
      setBookings((list) => [
        {
          ...input,
          id,
          access,
          day: startOfDay(input.day),
        },
        ...list,
      ])
    },
    [],
  )

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => !isBookingPast(b))
        .sort((a, b) => endsAt(a) - endsAt(b)),
    [bookings],
  )

  const past = useMemo(
    () =>
      bookings
        .filter((b) => isBookingPast(b))
        .sort((a, b) => endsAt(b) - endsAt(a)),
    [bookings],
  )

  const value = useMemo(
    () => ({
      favoriteIds,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      bookings,
      upcoming,
      past,
      addBooking,
    }),
    [
      favoriteIds,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      bookings,
      upcoming,
      past,
      addBooking,
    ],
  )

  return (
    <ProAccountContext.Provider value={value}>
      {children}
    </ProAccountContext.Provider>
  )
}

export function useProAccount() {
  const ctx = useContext(ProAccountContext)
  if (!ctx) {
    throw new Error('useProAccount must be used within ProAccountProvider')
  }
  return ctx
}
