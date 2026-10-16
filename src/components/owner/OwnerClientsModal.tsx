import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { type CategoryLabel } from '../../data/categories'
import { useOwnerAccount } from './OwnerAccountContext'
import {
  buildClientRows,
  downloadCsv,
  filterBookings,
  formatEuro,
  type ReportFilters,
} from './ownerReport'
import './Owner.css'

type Props = {
  open: boolean
  onClose: () => void
  initialPlaceId?: string | null
}

export function OwnerClientsModal({ open, onClose, initialPlaceId }: Props) {
  const { places, bookings } = useOwnerAccount()
  const [filters, setFilters] = useState<ReportFilters>({
    placeId: 'all',
    specialty: 'all',
    month: 'all',
    status: 'all',
    specialtyExclusive: false,
  })
  const [mailsCopied, setMailsCopied] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setFilters({
      placeId: initialPlaceId ?? 'all',
      specialty: 'all',
      month: 'all',
      status: 'all',
      specialtyExclusive: false,
    })
    setQuery('')
    setMailsCopied(false)
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
      filters.placeId === 'all'
        ? places
        : places.filter((p) => p.id === filters.placeId)
    const set = new Set<CategoryLabel>()
    for (const p of scoped) for (const s of p.specialties) set.add(s)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [places, filters.placeId])

  const filteredBookings = useMemo(
    () => filterBookings(bookings, filters),
    [bookings, filters],
  )

  const clients = useMemo(() => {
    const rows = buildClientRows(filteredBookings, {
      specialtyExclusive:
        filters.specialtyExclusive && filters.specialty !== 'all'
          ? filters.specialty
          : null,
    })
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.specialties.some((s) => s.toLowerCase().includes(q)) ||
        c.placeNames.some((p) => p.toLowerCase().includes(q)),
    )
  }, [filteredBookings, filters.specialtyExclusive, filters.specialty, query])

  function downloadClients() {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`clients-studio-${stamp}.csv`, [
      ['Client', 'E-mail', 'Visites', 'Spécialités', 'Lieux', 'CA', 'Dernière visite'],
      ...clients.map((c) => [
        c.name,
        c.email,
        c.visits,
        c.specialties.join(' · '),
        c.placeNames.join(' · '),
        c.totalSpent,
        c.lastVisit.toLocaleDateString('fr-FR'),
      ]),
    ])
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="owner-cockpit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-clients-title"
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
                <h2 id="owner-clients-title">Clients</h2>
              </div>
              <button
                type="button"
                className="owner-cockpit__close"
                onClick={onClose}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <div className="owner-cockpit__body">
              <div className="owner-cockpit__filters">
                <label>
                  Lieu
                  <select
                    value={filters.placeId}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        placeId: e.target.value,
                        specialty: 'all',
                      }))
                    }
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
                    value={filters.specialty}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        specialty: e.target.value as CategoryLabel | 'all',
                      }))
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
                  Recherche
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nom, e-mail, studio…"
                  />
                </label>
                {filters.specialty !== 'all' && (
                  <label className="owner-report__check">
                    <input
                      type="checkbox"
                      checked={Boolean(filters.specialtyExclusive)}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          specialtyExclusive: e.target.checked,
                        }))
                      }
                    />
                    <span>Exclusifs à {filters.specialty}</span>
                  </label>
                )}
              </div>

              <div className="owner-cockpit__actions">
                <button
                  type="button"
                  className="owner-report__dl"
                  onClick={downloadClients}
                  disabled={clients.length === 0}
                >
                  Exporter CSV
                </button>
                <button
                  type="button"
                  className="owner-report__dl is-primary"
                  disabled={clients.length === 0}
                  onClick={async () => {
                    const mails = clients.map((c) => c.email).join('; ')
                    try {
                      await navigator.clipboard.writeText(mails)
                      setMailsCopied(true)
                      window.setTimeout(() => setMailsCopied(false), 2000)
                    } catch {
                      window.prompt('Copiez les e-mails :', mails)
                    }
                  }}
                >
                  {mailsCopied
                    ? 'E-mails copiés'
                    : `Copier les e-mails (${clients.length})`}
                </button>
              </div>

              {clients.length === 0 ? (
                <p className="owner-cockpit__empty">Aucun client trouvé.</p>
              ) : (
                <div className="owner-report__table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>E-mail</th>
                        <th>Visites</th>
                        <th>Spécialités</th>
                        <th>Lieux</th>
                        <th>CA</th>
                        <th>Dernière visite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr key={c.key}>
                          <td>{c.name}</td>
                          <td>{c.email}</td>
                          <td>{c.visits}</td>
                          <td>{c.specialties.join(', ')}</td>
                          <td>{c.placeNames.join(', ')}</td>
                          <td>{formatEuro(c.totalSpent)}</td>
                          <td>
                            {c.lastVisit.toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
