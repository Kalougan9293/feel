import {
  exceptionForSlot,
  weeklyMinutesOnDate,
  type AvailSlot,
} from '../../data/availability'
import type { CategoryLabel } from '../../data/categories'
import type {
  OwnerBooking,
  OwnerBookingStatus,
  OwnerPlace,
} from './OwnerAccountContext'

export type ReportFilters = {
  placeId: string | 'all'
  specialty: CategoryLabel | 'all'
  /** YYYY-MM ou all */
  month: string | 'all'
  status: 'all' | OwnerBookingStatus
  /** Si une spécialité est choisie : clients qui n’ont booké QUE celle-ci */
  specialtyExclusive?: boolean
}

export type ClientRow = {
  key: string
  name: string
  email: string
  visits: number
  specialties: string[]
  totalSpent: number
  lastVisit: Date
  placeNames: string[]
}

export type SpecialtyFill = {
  specialty: string
  available: number
  booked: number
  rate: number
}

export type MonthSpecialtyFill = {
  month: string
  specialty: string
  available: number
  booked: number
  rate: number
}

export type ReportSummary = {
  bookingCount: number
  confirmedCount: number
  pendingCount: number
  revenue: number
  revenueConfirmed: number
  clientCount: number
  fillRate: number
}

function slotsForSpec(place: OwnerPlace, specialty: CategoryLabel): AvailSlot[] {
  const specific = place.slotsBySpecialty[specialty]
  return specific && specific.length > 0 ? specific : place.slots
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFr(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y!, (m ?? 1) - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function listReportMonths(bookings: OwnerBooking[]): string[] {
  const set = new Set<string>()
  const now = new Date()
  set.add(monthKey(now))
  for (let i = 1; i <= 5; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    set.add(monthKey(d))
  }
  for (const b of bookings) set.add(monthKey(b.day))
  return Array.from(set).sort()
}

export function filterBookings(
  bookings: OwnerBooking[],
  filters: ReportFilters,
): OwnerBooking[] {
  return bookings.filter((b) => {
    if (filters.placeId !== 'all' && b.placeId !== filters.placeId) return false
    if (filters.specialty !== 'all' && b.specialty !== filters.specialty) {
      return false
    }
    if (filters.status !== 'all' && b.status !== filters.status) return false
    // Par défaut : hors CA / remplissage on ignore les annulées
    if (filters.status === 'all' && b.status === 'cancelled') return false
    if (filters.month !== 'all' && monthKey(b.day) !== filters.month) return false
    return true
  })
}

export function buildClientRows(
  bookings: OwnerBooking[],
  options?: { specialtyExclusive?: string | null },
): ClientRow[] {
  const map = new Map<string, ClientRow>()
  for (const b of bookings) {
    const email =
      b.proEmail?.trim() ||
      `${b.proName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()
        .replace(/\s+/g, '.')}@studio-pro.fr`
    const key = `${b.proName.trim().toLowerCase()}|${email.toLowerCase()}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        name: b.proName,
        email,
        visits: 1,
        specialties: [String(b.specialty)],
        totalSpent: b.price,
        lastVisit: b.day,
        placeNames: [b.placeName],
      })
      continue
    }
    existing.visits += 1
    existing.totalSpent += b.price
    if (!existing.specialties.includes(String(b.specialty))) {
      existing.specialties.push(String(b.specialty))
    }
    if (!existing.placeNames.includes(b.placeName)) {
      existing.placeNames.push(b.placeName)
    }
    if (b.day.getTime() > existing.lastVisit.getTime()) {
      existing.lastVisit = b.day
    }
  }
  let rows = Array.from(map.values())
  const only = options?.specialtyExclusive
  if (only) {
    rows = rows.filter(
      (c) => c.specialties.length === 1 && c.specialties[0] === only,
    )
  }
  return rows.sort((a, b) => b.visits - a.visits)
}

function availableHalfHoursInMonth(
  place: OwnerPlace,
  specialty: CategoryLabel,
  year: number,
  monthIndex: number,
): number {
  const days = new Date(year, monthIndex + 1, 0).getDate()
  const weekly = slotsForSpec(place, specialty)
  let count = 0
  for (let d = 1; d <= days; d += 1) {
    const day = new Date(year, monthIndex, d)
    const open = weeklyMinutesOnDate(weekly, day)
    for (const minutes of open) {
      const blocked =
        exceptionForSlot(place.slotExceptions, day, minutes, specialty) ||
        exceptionForSlot(place.slotExceptions, day, minutes, 'all')
      if (!blocked) count += 1
    }
  }
  return count
}

function bookedHalfHoursInMonth(
  bookings: OwnerBooking[],
  specialty: string,
  year: number,
  monthIndex: number,
): number {
  let count = 0
  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    if (b.specialty !== specialty) continue
    if (b.day.getFullYear() !== year || b.day.getMonth() !== monthIndex) continue
    count += Math.max(1, Math.round(b.durationMin / 30))
  }
  return count
}

/** Studios sous le seuil de remplissage (ex. 40 %) */
export function buildUnderfillAlerts(
  fillRows: SpecialtyFill[],
  threshold = 40,
): SpecialtyFill[] {
  return fillRows
    .filter((r) => r.available > 0 && r.rate < threshold)
    .sort((a, b) => a.rate - b.rate)
}

export function buildSpecialtyFill(
  places: OwnerPlace[],
  bookings: OwnerBooking[],
  filters: ReportFilters,
): SpecialtyFill[] {
  const scopedPlaces =
    filters.placeId === 'all'
      ? places
      : places.filter((p) => p.id === filters.placeId)
  const specs = new Set<string>()
  for (const p of scopedPlaces) {
    for (const s of p.specialties) {
      if (filters.specialty === 'all' || filters.specialty === s) specs.add(s)
    }
  }

  const months: { year: number; month: number }[] = []
  if (filters.month !== 'all') {
    const [y, m] = filters.month.split('-').map(Number)
    months.push({ year: y!, month: (m ?? 1) - 1 })
  } else {
    const now = new Date()
    for (let i = 0; i < 3; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ year: d.getFullYear(), month: d.getMonth() })
    }
  }

  const rows: SpecialtyFill[] = []
  for (const specialty of Array.from(specs).sort()) {
    let available = 0
    let booked = 0
    for (const place of scopedPlaces) {
      if (!place.specialties.includes(specialty as CategoryLabel)) continue
      for (const { year, month } of months) {
        available += availableHalfHoursInMonth(
          place,
          specialty as CategoryLabel,
          year,
          month,
        )
        booked += bookedHalfHoursInMonth(
          bookings.filter((b) => b.placeId === place.id),
          specialty,
          year,
          month,
        )
      }
    }
    rows.push({
      specialty,
      available,
      booked,
      rate: available > 0 ? Math.round((booked / available) * 1000) / 10 : 0,
    })
  }
  return rows
}

export function buildMonthSpecialtyFill(
  places: OwnerPlace[],
  bookings: OwnerBooking[],
  filters: ReportFilters,
): MonthSpecialtyFill[] {
  const scopedPlaces =
    filters.placeId === 'all'
      ? places
      : places.filter((p) => p.id === filters.placeId)

  const monthKeys =
    filters.month !== 'all'
      ? [filters.month]
      : listReportMonths(bookings).slice(-6)

  const rows: MonthSpecialtyFill[] = []
  for (const mk of monthKeys) {
    const [y, m] = mk.split('-').map(Number)
    const year = y!
    const monthIndex = (m ?? 1) - 1
    const specs = new Set<string>()
    for (const p of scopedPlaces) {
      for (const s of p.specialties) {
        if (filters.specialty === 'all' || filters.specialty === s) specs.add(s)
      }
    }
    for (const specialty of Array.from(specs).sort()) {
      let available = 0
      let booked = 0
      for (const place of scopedPlaces) {
        if (!place.specialties.includes(specialty as CategoryLabel)) continue
        available += availableHalfHoursInMonth(
          place,
          specialty as CategoryLabel,
          year,
          monthIndex,
        )
        booked += bookedHalfHoursInMonth(
          bookings.filter((b) => b.placeId === place.id),
          specialty,
          year,
          monthIndex,
        )
      }
      rows.push({
        month: monthLabelFr(mk),
        specialty,
        available,
        booked,
        rate: available > 0 ? Math.round((booked / available) * 1000) / 10 : 0,
      })
    }
  }
  return rows
}

export function buildSummary(
  bookings: OwnerBooking[],
  fillRows: SpecialtyFill[],
): ReportSummary {
  const active = bookings.filter((b) => b.status !== 'cancelled')
  const revenue = active.reduce((s, b) => s + b.price, 0)
  const confirmed = active.filter((b) => b.status === 'confirmed')
  const pending = active.filter((b) => b.status === 'pending')
  const available = fillRows.reduce((s, r) => s + r.available, 0)
  const booked = fillRows.reduce((s, r) => s + r.booked, 0)
  return {
    bookingCount: active.length,
    confirmedCount: confirmed.length,
    pendingCount: pending.length,
    revenue,
    revenueConfirmed: confirmed.reduce((s, b) => s + b.price, 0),
    clientCount: buildClientRows(active).length,
    fillRate: available > 0 ? Math.round((booked / available) * 1000) / 10 : 0,
  }
}

export function escapeCsvCell(value: string | number): string {
  const s = String(value)
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows.map((r) => r.map(escapeCsvCell).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + body], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function formatEuro(n: number): string {
  return `${n.toLocaleString('fr-FR')}€`
}

export { monthLabelFr }
