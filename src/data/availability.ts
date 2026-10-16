/** Jours ISO-like : 0 = dimanche … 6 = samedi (comme Date.getDay()) */
export type WeekDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'

export type AvailSlot = {
  day: WeekDay
  /** Minutes depuis minuit, par pas de 30 */
  minutes: number
}

/** Exception ponctuelle : créneau bloqué un jour calendaire (travaux, visite…) */
export type SlotException = {
  /** YYYY-MM-DD (jour local) */
  date: string
  minutes: number
  /** Studio concerné — obligatoire pour les nouveaux blocages */
  specialty?: string
  /** Mémo propriétaire (ex. « Travaux », « Mme Martin 06… ») */
  note?: string
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Tous les créneaux du motif hebdo pour ce jour calendaire */
export function weeklyMinutesOnDate(
  weeklySlots: AvailSlot[],
  date: Date,
): number[] {
  const weekday = weekDayFromDate(date)
  const seen = new Set<number>()
  const out: number[] = []
  for (const s of weeklySlots) {
    if (s.day !== weekday || seen.has(s.minutes)) continue
    seen.add(s.minutes)
    out.push(s.minutes)
  }
  out.sort((a, b) => a - b)
  return out
}

/**
 * Exceptions qui bloquent un studio :
 * - `all` → blocages centre entier (sans specialty)
 * - studio → blocages de ce studio + blocages centre
 */
export function filterExceptionsForSpecialty(
  exceptions: SlotException[] | undefined,
  specialty: string | 'all',
): SlotException[] {
  if (!exceptions?.length) return []
  if (specialty === 'all') {
    return exceptions.filter((e) => e.specialty == null)
  }
  return exceptions.filter(
    (e) => e.specialty === specialty || e.specialty == null,
  )
}

/** Blocage propre à un studio (pas le centre entier) */
export function exceptionMatchesSpecialty(
  exception: SlotException,
  specialty: string,
): boolean {
  return exception.specialty === specialty
}

export function exceptionForSlot(
  exceptions: SlotException[] | undefined,
  date: Date | string,
  minutes: number,
  specialty?: string | null | 'all',
): SlotException | undefined {
  const key = typeof date === 'string' ? date : toDateKey(date)
  const scoped = filterExceptionsForSpecialty(
    exceptions,
    specialty === null || specialty === undefined ? 'all' : specialty,
  )
  return scoped.find((e) => e.date === key && e.minutes === minutes)
}

/** Fin de journée (pour le curseur) — affichée 23h59 */
export const DAY_END_MINUTES = 24 * 60

/** Pas du curseur horaire */
export const TIME_STEP_MINUTES = 30

/** Horizon de réservation affiché sur la fiche */
export const AVAIL_HORIZON_MONTHS = 12

export const WEEK_DAYS: { value: WeekDay; label: string; short: string }[] = [
  { value: 'monday', label: 'Lundi', short: 'Lun' },
  { value: 'tuesday', label: 'Mardi', short: 'Mar' },
  { value: 'wednesday', label: 'Mercredi', short: 'Mer' },
  { value: 'thursday', label: 'Jeudi', short: 'Jeu' },
  { value: 'friday', label: 'Vendredi', short: 'Ven' },
  { value: 'saturday', label: 'Samedi', short: 'Sam' },
  { value: 'sunday', label: 'Dimanche', short: 'Dim' },
]

/** Créneaux démo possibles sur 24h, pas de 30 min */
export const HALF_HOUR_OPTIONS: number[] = (() => {
  const out: number[] = []
  for (let m = 0; m < DAY_END_MINUTES; m += TIME_STEP_MINUTES) out.push(m)
  return out
})()

const DAY_BY_INDEX: WeekDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export function weekDayFromDate(date: Date = new Date()): WeekDay {
  return DAY_BY_INDEX[date.getDay()]
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatMinutes(minutes: number): string {
  if (minutes >= DAY_END_MINUTES) return '23h59'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hh = String(h).padStart(2, '0')
  return m === 0 ? `${hh}h00` : `${hh}h${String(m).padStart(2, '0')}`
}

export function isFullDayRange(start: number, end: number): boolean {
  return start <= 0 && end >= DAY_END_MINUTES
}

export function formatNextSlot(slot: AvailSlot): string {
  const today = weekDayFromDate()
  const tomorrow = weekDayFromDate(addDays(new Date(), 1))
  const hourLabel = formatMinutes(slot.minutes)

  let when: string
  if (slot.day === today) {
    when = slot.minutes >= 18 * 60 ? 'ce soir' : 'aujourd’hui'
  } else if (slot.day === tomorrow) {
    when = 'demain'
  } else {
    when =
      WEEK_DAYS.find((d) => d.value === slot.day)?.label.toLowerCase() ?? slot.day
  }

  return `Prochain créneau · ${when} ${hourLabel}`
}

function dateSeed(placeId: string, date: Date, minutes: number) {
  const key = `${placeId}-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${minutes}`
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

export type OpenSlotsOptions = {
  exceptions?: SlotException[]
  /** Filtre les exceptions sur ce studio (`all` = ignore les blocages studio) */
  specialty?: string | 'all'
  /** Si true, ignore le motif « déjà réservé » démo */
  skipLiveDemo?: boolean
}

/** Créneaux encore libres un jour donné (motif hebdo − exceptions − réservations fictives) */
export function openSlotsOnDate(
  placeId: string,
  weeklySlots: AvailSlot[],
  date: Date,
  now: Date = new Date(),
  options: OpenSlotsOptions = {},
): number[] {
  const dayStart = startOfDay(date)
  const today = startOfDay(now)
  const horizon = new Date(today)
  horizon.setMonth(horizon.getMonth() + AVAIL_HORIZON_MONTHS)

  if (dayStart < today || dayStart > horizon) return []

  const candidates = weeklyMinutesOnDate(weeklySlots, date)
  const dateKey = toDateKey(date)
  const scopedExceptions = filterExceptionsForSpecialty(
    options.exceptions,
    options.specialty ?? 'all',
  )
  const blocked = new Set(
    scopedExceptions.filter((e) => e.date === dateKey).map((e) => e.minutes),
  )

  const isToday = sameDay(date, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return candidates.filter((minutes) => {
    if (blocked.has(minutes)) return false
    if (isToday && minutes <= nowMinutes) return false
    if (options.skipLiveDemo) return true
    // ~18 % des créneaux déjà pris (démo « live » — plus de vert)
    return dateSeed(placeId, date, minutes) > 0.18
  })
}

export function dayAvailabilityLevel(
  placeId: string,
  weeklySlots: AvailSlot[],
  date: Date,
  now: Date = new Date(),
  options: OpenSlotsOptions = {},
): 'none' | 'low' | 'high' {
  const open = openSlotsOnDate(placeId, weeklySlots, date, now, options)
  if (open.length === 0) return 'none'
  if (open.length <= 2) return 'low'
  return 'high'
}

export type NextOpenSlot = {
  date: Date
  minutes: number
  /** Instant pour tri chronologique */
  at: number
}

/**
 * Prochain créneau réellement libre (horizon live),
 * optionnellement restreint à un jour de semaine / une plage / N jours.
 */
export function nextOpenSlot(
  placeId: string,
  weeklySlots: AvailSlot[],
  {
    weekday,
    weekdays,
    onlyDate,
    withinDays,
    rangeStart = 0,
    rangeEnd = DAY_END_MINUTES,
    now = new Date(),
    exceptions,
    specialty = 'all',
    skipLiveDemo,
  }: {
    weekday?: WeekDay | 'any'
    /** Plusieurs jours de semaine (ex. lun + mer + ven) */
    weekdays?: WeekDay[]
    /** Si défini, ne scanne que ce jour calendaire */
    onlyDate?: Date
    /** Nombre de jours inclusifs à partir d’aujourd’hui (0 = aujourd’hui seul) */
    withinDays?: number
    rangeStart?: number
    rangeEnd?: number
    now?: Date
    exceptions?: SlotException[]
    specialty?: string | 'all'
    skipLiveDemo?: boolean
  } = {},
): NextOpenSlot | null {
  const today = startOfDay(now)
  const horizon = new Date(today)
  horizon.setMonth(horizon.getMonth() + AVAIL_HORIZON_MONTHS)

  let from = today
  let to = horizon

  if (onlyDate) {
    from = startOfDay(onlyDate)
    to = from
  } else if (withinDays != null) {
    to = addDays(today, withinDays)
  }

  if (from > horizon || to < today) return null
  if (from < today) from = today
  if (to > horizon) to = horizon

  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const wd = weekDayFromDate(d)
    if (weekdays && weekdays.length > 0) {
      if (!weekdays.includes(wd)) continue
    } else if (weekday && weekday !== 'any' && wd !== weekday) {
      continue
    }

    const open = openSlotsOnDate(placeId, weeklySlots, d, now, {
      exceptions,
      specialty,
      skipLiveDemo,
    }).filter((m) => m >= rangeStart && m <= rangeEnd)
    if (open.length === 0) continue

    const minutes = open[0]
    const day = startOfDay(d)
    return {
      date: day,
      minutes,
      at: day.getTime() + minutes * 60_000,
    }
  }

  return null
}

/** Libellé carte : « Prochain créneau · mardi 21 oct. 10h00 » */
export function formatNextOpenSlot(slot: NextOpenSlot, now: Date = new Date()): string {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const hourLabel = formatMinutes(slot.minutes)

  let when: string
  if (sameDay(slot.date, today)) {
    when = slot.minutes >= 18 * 60 ? 'ce soir' : 'aujourd’hui'
  } else if (sameDay(slot.date, tomorrow)) {
    when = 'demain'
  } else {
    const dayName =
      WEEK_DAYS.find((d) => d.value === weekDayFromDate(slot.date))?.label.toLowerCase() ??
      ''
    const datePart = slot.date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    })
    when = `${dayName} ${datePart}`
  }

  return `Prochain créneau · ${when} ${hourLabel}`
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Lundi = 0 … Dimanche = 6
  const startPad = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, month, d))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
