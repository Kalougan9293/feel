import { AnimatePresence, motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  DAY_END_MINUTES,
  TIME_STEP_MINUTES,
  WEEK_DAYS,
  addDays,
  formatMinutes,
  isFullDayRange,
  sameDay,
  startOfDay,
  weekDayFromDate,
  type WeekDay,
} from '../../data/availability'

export type DayQuickFilter = 'all' | 'today' | 'tomorrow' | 'week'
/** Un raccourci exclusif, ou plusieurs jours de semaine */
export type DayFilter = DayQuickFilter | WeekDay[]

export type TimeRange = { start: number; end: number }

export const FULL_DAY: TimeRange = { start: 0, end: DAY_END_MINUTES }

export const QUICK_DAYS: {
  value: Exclude<DayQuickFilter, 'all'>
  label: string
  short: string
}[] = [
  { value: 'today', label: 'Aujourd’hui', short: 'Auj.' },
  { value: 'tomorrow', label: 'Demain', short: 'Dem.' },
  { value: 'week', label: 'Cette semaine', short: 'Sem.' },
]

export function isWeekdaysFilter(day: DayFilter): day is WeekDay[] {
  return Array.isArray(day)
}

function orderedWeekdays(days: WeekDay[]): WeekDay[] {
  return WEEK_DAYS.map((d) => d.value).filter((v) => days.includes(v))
}

export function toggleWeekday(prev: DayFilter, value: WeekDay): DayFilter {
  const current = isWeekdaysFilter(prev) ? prev : []
  const next = current.includes(value)
    ? current.filter((d) => d !== value)
    : [...current, value]
  return next.length === 0 ? 'all' : orderedWeekdays(next)
}

export function availSummary(day: DayFilter, range: TimeRange, compact: boolean) {
  const fullTime = isFullDayRange(range.start, range.end)

  if (day === 'all' && fullTime) {
    return compact ? 'Dispo' : 'Toutes les dispos'
  }

  let dayLabel: string | null = null
  if (day === 'all') {
    dayLabel = null
  } else if (isWeekdaysFilter(day)) {
    const labels = WEEK_DAYS.filter((d) => day.includes(d.value)).map((d) =>
      compact ? d.short : d.label,
    )
    dayLabel =
      labels.length <= 3
        ? labels.join(', ')
        : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  } else {
    dayLabel =
      QUICK_DAYS.find((q) => q.value === day)?.[compact ? 'short' : 'label'] ??
      null
  }

  const timeLabel = fullTime
    ? null
    : `${formatMinutes(range.start)}–${formatMinutes(range.end)}`

  if (dayLabel && timeLabel) return `${dayLabel} · ${timeLabel}`
  if (dayLabel) return dayLabel
  if (timeLabel) return timeLabel
  return compact ? 'Dispo' : 'Toutes les dispos'
}

export function isAvailActive(day: DayFilter, range: TimeRange) {
  if (isWeekdaysFilter(day)) return day.length > 0
  return day !== 'all' || !isFullDayRange(range.start, range.end)
}

/** Le jour calendaire est-il dans le filtre dispo ? */
export function dateMatchesDayFilter(
  date: Date,
  day: DayFilter,
  now: Date = new Date(),
): boolean {
  if (day === 'all') return true
  if (isWeekdaysFilter(day)) {
    if (day.length === 0) return true
    return day.includes(weekDayFromDate(date))
  }
  if (day === 'today') return sameDay(date, now)
  if (day === 'tomorrow') return sameDay(date, addDays(now, 1))
  if (day === 'week') {
    const today = startOfDay(now)
    const end = addDays(today, 6)
    const d = startOfDay(date)
    return d >= today && d <= end
  }
  return false
}

export function filterSlotsByRange(minutes: number[], range: TimeRange) {
  if (isFullDayRange(range.start, range.end)) return minutes
  return minutes.filter((m) => m >= range.start && m <= range.end)
}

/** Durées de réservation proposées */
export const DURATION_OPTIONS = [
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 180, label: '3 h' },
  { minutes: 240, label: '4 h' },
] as const

export const DEFAULT_DURATION_MINUTES = 60

/**
 * Heures de début possibles pour un bloc continu de `durationMinutes`
 * entièrement libre dans la plage.
 */
export function startSlotsForDuration(
  openMinutes: number[],
  durationMinutes: number,
  range: TimeRange,
): number[] {
  const filtered = filterSlotsByRange(openMinutes, range)
  const open = new Set(filtered)
  const endLimit = isFullDayRange(range.start, range.end)
    ? DAY_END_MINUTES
    : range.end
  const steps = Math.max(1, Math.round(durationMinutes / TIME_STEP_MINUTES))
  const starts: number[] = []

  for (const start of filtered) {
    if (start + durationMinutes > endLimit) continue
    let ok = true
    for (let i = 0; i < steps; i += 1) {
      if (!open.has(start + i * TIME_STEP_MINUTES)) {
        ok = false
        break
      }
    }
    if (ok) starts.push(start)
  }

  return starts
}

function snapMinutes(raw: number) {
  const stepped = Math.round(raw / TIME_STEP_MINUTES) * TIME_STEP_MINUTES
  return Math.max(0, Math.min(DAY_END_MINUTES, stepped))
}

export function TimeRangeSlider({
  value,
  onChange,
  onDraggingChange,
}: {
  value: TimeRange
  onChange: (next: TimeRange) => void
  onDraggingChange?: (dragging: boolean) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  const activeRef = useRef<'start' | 'end' | null>(null)
  valueRef.current = value

  const startPct = (value.start / DAY_END_MINUTES) * 100
  const endPct = (value.end / DAY_END_MINUTES) * 100

  const minutesFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const ratio = (clientX - rect.left) / rect.width
    return snapMinutes(ratio * DAY_END_MINUTES)
  }, [])

  const commit = useCallback(
    (thumb: 'start' | 'end', minutes: number) => {
      const { start, end } = valueRef.current
      if (thumb === 'start') {
        onChange({
          start: Math.min(minutes, end - TIME_STEP_MINUTES),
          end,
        })
      } else {
        onChange({
          start,
          end: Math.max(minutes, start + TIME_STEP_MINUTES),
        })
      }
    },
    [onChange],
  )

  const stopDrag = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = null
    onDraggingChange?.(false)
  }, [onDraggingChange])

  const startDrag = (
    thumb: 'start' | 'end',
    e: ReactPointerEvent<HTMLElement>,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    activeRef.current = thumb
    onDraggingChange?.(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    commit(thumb, minutesFromClientX(e.clientX))
  }

  const onThumbMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!activeRef.current) return
    commit(activeRef.current, minutesFromClientX(e.clientX))
  }

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.pro-home__time-range-thumb')) return
    const minutes = minutesFromClientX(e.clientX)
    const { start, end } = valueRef.current
    const distStart = Math.abs(minutes - start)
    const distEnd = Math.abs(minutes - end)
    const thumb = distStart <= distEnd ? 'start' : 'end'
    activeRef.current = thumb
    onDraggingChange?.(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    commit(thumb, minutes)
  }

  const onTrackMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return
    commit(activeRef.current, minutesFromClientX(e.clientX))
  }

  const nudge = (thumb: 'start' | 'end', delta: number) => {
    const current = thumb === 'start' ? value.start : value.end
    commit(thumb, snapMinutes(current + delta))
  }

  return (
    <div className="pro-home__time-range">
      <div className="pro-home__time-range-labels">
        <span>{formatMinutes(value.start)}</span>
        <span>{formatMinutes(value.end)}</span>
      </div>

      <div
        ref={trackRef}
        className="pro-home__time-range-track"
        style={{
          ['--range-start' as string]: `${startPct}%`,
          ['--range-end' as string]: `${endPct}%`,
        }}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="pro-home__time-range-rail" aria-hidden />
        <div className="pro-home__time-range-fill" aria-hidden />

        <button
          type="button"
          className="pro-home__time-range-thumb is-start"
          style={{ left: `${startPct}%` }}
          aria-label="Heure de début"
          aria-valuemin={0}
          aria-valuemax={value.end - TIME_STEP_MINUTES}
          aria-valuenow={value.start}
          aria-valuetext={formatMinutes(value.start)}
          onPointerDown={(e) => startDrag('start', e)}
          onPointerMove={onThumbMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault()
              nudge('start', -TIME_STEP_MINUTES)
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault()
              nudge('start', TIME_STEP_MINUTES)
            }
          }}
        />
        <button
          type="button"
          className="pro-home__time-range-thumb is-end"
          style={{ left: `${endPct}%` }}
          aria-label="Heure de fin"
          aria-valuemin={value.start + TIME_STEP_MINUTES}
          aria-valuemax={DAY_END_MINUTES}
          aria-valuenow={value.end}
          aria-valuetext={formatMinutes(value.end)}
          onPointerDown={(e) => startDrag('end', e)}
          onPointerMove={onThumbMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault()
              nudge('end', -TIME_STEP_MINUTES)
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault()
              nudge('end', TIME_STEP_MINUTES)
            }
          }}
        />
      </div>

      <div className="pro-home__time-range-scale" aria-hidden>
        <span>00h00</span>
        <span>12h00</span>
        <span>23h59</span>
      </div>
    </div>
  )
}

type AvailFilterProps = {
  day: DayFilter
  range: TimeRange
  onApply: (day: DayFilter, range: TimeRange) => void
  compact?: boolean
  className?: string
}

/** Filtre Disponibilité (jours + plage horaire) — liste & calendrier fiche */
export function AvailFilter({
  day,
  range,
  onApply,
  compact = false,
  className = '',
}: AvailFilterProps) {
  const [open, setOpen] = useState(false)
  const [draftDay, setDraftDay] = useState(day)
  const [draftRange, setDraftRange] = useState(range)
  const rootRef = useRef<HTMLDivElement>(null)
  const sliderDraggingRef = useRef(false)

  const active = isAvailActive(day, range)
  const draftActive = isAvailActive(draftDay, draftRange)

  useEffect(() => {
    if (!open) {
      setDraftDay(day)
      setDraftRange(range)
    }
  }, [day, range, open])

  useEffect(() => {
    if (!open) return

    const onPointer = (e: PointerEvent) => {
      if (sliderDraggingRef.current) return
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sliderDraggingRef.current) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const apply = () => {
    onApply(draftDay, draftRange)
    setOpen(false)
  }

  return (
    <div
      className={`pro-home__filter pro-home__filter--avail${active ? ' is-set' : ''}${open ? ' is-open' : ''} ${className}`.trim()}
      ref={rootRef}
    >
      <span className="pro-home__filter-label" id="avail-filter-label">
        Disponibilité
      </span>
      <button
        type="button"
        className="pro-home__avail-trigger"
        aria-labelledby="avail-filter-label"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pro-home__avail-trigger-text">
          {availSummary(day, range, compact)}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="pro-home__avail-panel"
            role="dialog"
            aria-label="Filtrer par disponibilité"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
          >
            <div className="pro-home__avail-bar">
              <div className="pro-home__avail-quick" role="group">
                {QUICK_DAYS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`pro-home__avail-chip${draftDay === opt.value ? ' is-active' : ''}`}
                    aria-pressed={draftDay === opt.value}
                    onClick={() =>
                      setDraftDay((prev) =>
                        prev === opt.value ? 'all' : opt.value,
                      )
                    }
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="pro-home__avail-clear"
                disabled={!draftActive}
                onClick={() => {
                  setDraftDay('all')
                  setDraftRange(FULL_DAY)
                }}
              >
                Effacer
              </button>
            </div>

            <div
              className="pro-home__avail-days"
              role="group"
              aria-label="Jours de la semaine (sélection multiple)"
            >
              {WEEK_DAYS.map((d) => {
                const selected =
                  isWeekdaysFilter(draftDay) && draftDay.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    className={`pro-home__avail-day${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    title={d.label}
                    onClick={() =>
                      setDraftDay((prev) => toggleWeekday(prev, d.value))
                    }
                  >
                    {d.short}
                  </button>
                )
              })}
            </div>

            <TimeRangeSlider
              value={draftRange}
              onChange={setDraftRange}
              onDraggingChange={(dragging) => {
                sliderDraggingRef.current = dragging
              }}
            />

            <div className="pro-home__avail-actions">
              <button
                type="button"
                className="pro-home__avail-apply"
                onClick={apply}
              >
                Valider
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
