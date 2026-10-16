import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { type CategoryLabel } from '../../data/categories'
import {
  formatOwnerBookingDate,
  formatOwnerBookingTime,
  ownerBookingStatusLabel,
  useOwnerAccount,
  type OwnerBooking,
  type OwnerBookingStatus,
} from './OwnerAccountContext'
import { OwnerBookingEditor } from './OwnerBookingEditor'
import './Owner.css'

type Props = {
  open: boolean
  onClose: () => void
  initialPlaceId?: string | null
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const STATUS_FILTERS: Array<'all' | OwnerBookingStatus> = [
  'all',
  'confirmed',
  'pending',
  'no_show',
  'cancelled',
]

export function OwnerAgendaModal({ open, onClose, initialPlaceId }: Props) {
  const { places, bookings } = useOwnerAccount()
  const [placeId, setPlaceId] = useState<string | 'all'>('all')
  const [specialty, setSpecialty] = useState<CategoryLabel | 'all'>('all')
  const [status, setStatus] = useState<'all' | OwnerBookingStatus>('all')
  const [editor, setEditor] = useState<OwnerBooking | 'new' | null>(null)

  useEffect(() => {
    if (!open) return
    setPlaceId(initialPlaceId ?? 'all')
    setSpecialty('all')
    setStatus('all')
    setEditor(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, initialPlaceId])

  const specialties = useMemo(() => {
    const scoped =
      placeId === 'all' ? places : places.filter((p) => p.id === placeId)
    const set = new Set<CategoryLabel>()
    for (const p of scoped) for (const s of p.specialties) set.add(s)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [places, placeId])

  const filtered = useMemo(() => {
    const now = Date.now()
    return bookings
      .filter((b) => {
        if (placeId !== 'all' && b.placeId !== placeId) return false
        if (specialty !== 'all' && b.specialty !== specialty) return false
        if (status !== 'all' && b.status !== status) return false
        if (status === 'all' && b.status === 'cancelled') return false
        const end =
          b.day.getTime() + (b.startMinutes + b.durationMin) * 60_000
        if (status === 'all' || status === 'confirmed' || status === 'pending') {
          if (end < now && b.status !== 'no_show') return false
        }
        return true
      })
      .sort(
        (a, b) =>
          a.day.getTime() +
          a.startMinutes * 60_000 -
          (b.day.getTime() + b.startMinutes * 60_000),
      )
  }, [bookings, placeId, specialty, status])

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: OwnerBooking[] }>()
    for (const b of filtered) {
      const key = dayKey(b.day)
      const existing = map.get(key)
      if (existing) existing.items.push(b)
      else {
        map.set(key, {
          label: formatOwnerBookingDate(b.day),
          items: [b],
        })
      }
    }
    return Array.from(map.values())
  }, [filtered])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="owner-cockpit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-agenda-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            className="owner-cockpit__backdrop"
            aria-label="Fermer"
            onClick={onClose}
          />
          <motion.div
            className="owner-cockpit__panel owner-cockpit__panel--wide"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <header className="owner-cockpit__head">
              <div>
                <p className="owner-cockpit__kicker">Cockpit</p>
                <h2 id="owner-agenda-title">Agenda</h2>
              </div>
              <div className="owner-cockpit__head-actions">
                <button
                  type="button"
                  className="owner-report__dl is-primary"
                  onClick={() => setEditor('new')}
                  disabled={places.length === 0}
                >
                  + Réservation
                </button>
                <button
                  type="button"
                  className="owner-cockpit__close"
                  onClick={onClose}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="owner-cockpit__body">
              {editor ? (
                <OwnerBookingEditor
                  initial={editor === 'new' ? null : editor}
                  defaultPlaceId={
                    placeId !== 'all' ? placeId : initialPlaceId
                  }
                  onClose={() => setEditor(null)}
                  onSaved={() => setEditor(null)}
                />
              ) : (
                <>
                  <div className="owner-cockpit__filters">
                    <label>
                      Lieu
                      <select
                        value={placeId}
                        onChange={(e) => {
                          setPlaceId(e.target.value)
                          setSpecialty('all')
                        }}
                      >
                        <option value="all">Tous les lieux</option>
                        {places.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name.trim() || 'Sans nom'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Spécialité
                      <select
                        value={specialty}
                        onChange={(e) =>
                          setSpecialty(e.target.value as CategoryLabel | 'all')
                        }
                      >
                        <option value="all">Toutes</option>
                        {specialties.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Statut
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as typeof status)
                        }
                      >
                        {STATUS_FILTERS.map((s) => (
                          <option key={s} value={s}>
                            {s === 'all'
                              ? 'Actives'
                              : ownerBookingStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="owner-cockpit__count">
                    {filtered.length} réservation
                    {filtered.length > 1 ? 's' : ''}
                  </p>

                  {grouped.length === 0 ? (
                    <p className="owner-cockpit__empty">
                      Aucune réservation. Créez-en une avec « + Réservation ».
                    </p>
                  ) : (
                    <div className="owner-agenda__days">
                      {grouped.map((g) => (
                        <section key={g.label} className="owner-agenda__day">
                          <h3>{g.label}</h3>
                          <ul className="owner-agenda__list">
                            {g.items.map((b) => (
                              <li key={b.id}>
                                <div className="owner-agenda__main">
                                  <strong>{b.proName}</strong>
                                  <span>
                                    {formatOwnerBookingTime(
                                      b.startMinutes,
                                      b.durationMin,
                                    )}{' '}
                                    · {b.specialty}
                                    {placeId === 'all' ? ` · ${b.placeName}` : ''}
                                  </span>
                                  <span
                                    className={`owner-agenda__status is-${b.status}`}
                                  >
                                    {ownerBookingStatusLabel(b.status)}
                                  </span>
                                </div>
                                <div className="owner-agenda__side">
                                  <em>{b.price}€</em>
                                  <button
                                    type="button"
                                    className="owner-cockpit__mini-btn"
                                    onClick={() => setEditor(b)}
                                  >
                                    Modifier
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
