import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { type CategoryLabel } from '../../data/categories'
import { useOwnerAccount } from './OwnerAccountContext'
import { ownerBookingStatusLabel } from './OwnerAccountContext'
import {
  buildMonthSpecialtyFill,
  buildSpecialtyFill,
  buildSummary,
  buildUnderfillAlerts,
  downloadCsv,
  filterBookings,
  formatEuro,
  listReportMonths,
  monthLabelFr,
  type ReportFilters,
} from './ownerReport'
import './Owner.css'

type Props = {
  open: boolean
  onClose: () => void
  /** Lieu préselectionné (fiche ouverte) */
  initialPlaceId?: string | null
}

export function OwnerReportModal({ open, onClose, initialPlaceId }: Props) {
  const { places, bookings } = useOwnerAccount()
  const [filters, setFilters] = useState<ReportFilters>({
    placeId: 'all',
    specialty: 'all',
    month: 'all',
    status: 'all',
  })

  useEffect(() => {
    if (!open) return
    setFilters({
      placeId: initialPlaceId ?? 'all',
      specialty: 'all',
      month: 'all',
      status: 'all',
    })
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

  const months = useMemo(() => listReportMonths(bookings), [bookings])

  const specialties = useMemo(() => {
    const scoped =
      filters.placeId === 'all'
        ? places
        : places.filter((p) => p.id === filters.placeId)
    const set = new Set<CategoryLabel>()
    for (const p of scoped) for (const s of p.specialties) set.add(s)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [places, filters.placeId])

  const filtered = useMemo(
    () => filterBookings(bookings, filters),
    [bookings, filters],
  )
  const fillBySpec = useMemo(
    () => buildSpecialtyFill(places, filtered, filters),
    [places, filtered, filters],
  )
  const fillByMonth = useMemo(
    () => buildMonthSpecialtyFill(places, filtered, filters),
    [places, filtered, filters],
  )
  const summary = useMemo(
    () => buildSummary(filtered, fillBySpec),
    [filtered, fillBySpec],
  )
  const underfill = useMemo(
    () => buildUnderfillAlerts(fillBySpec, 40),
    [fillBySpec],
  )

  const placeLabel =
    filters.placeId === 'all'
      ? 'Tous les lieux'
      : (places.find((p) => p.id === filters.placeId)?.name.trim() || 'Lieu')

  function downloadFiltered() {
    const stamp = new Date().toISOString().slice(0, 10)
    const rows: (string | number)[][] = [
      ['Rapport STUDIØ — vue filtrée'],
      ['Lieu', placeLabel],
      [
        'Spécialité',
        filters.specialty === 'all' ? 'Toutes' : filters.specialty,
      ],
      [
        'Période',
        filters.month === 'all' ? 'Toutes' : monthLabelFr(filters.month),
      ],
      ['Statut', filters.status === 'all' ? 'Tous' : filters.status],
      [],
      ['Synthèse'],
      ['CA total', summary.revenue],
      ['CA confirmé', summary.revenueConfirmed],
      ['Réservations', summary.bookingCount],
      ['Clients uniques', summary.clientCount],
      ['Taux de remplissage (%)', summary.fillRate],
      [],
      ['Remplissage par spécialité'],
      ['Spécialité', 'Créneaux dispo', 'Créneaux bookés', 'Taux (%)'],
      ...fillBySpec.map((r) => [r.specialty, r.available, r.booked, r.rate]),
      [],
      ['Remplissage par mois et spécialité'],
      ['Mois', 'Spécialité', 'Créneaux dispo', 'Créneaux bookés', 'Taux (%)'],
      ...fillByMonth.map((r) => [
        r.month,
        r.specialty,
        r.available,
        r.booked,
        r.rate,
      ]),
      [],
      ['Réservations'],
      [
        'Date',
        'Début',
        'Durée (min)',
        'Client',
        'E-mail',
        'Spécialité',
        'Lieu',
        'Prix',
        'Statut',
      ],
      ...filtered
        .slice()
        .sort((a, b) => a.day.getTime() - b.day.getTime())
        .map((b) => [
          b.day.toLocaleDateString('fr-FR'),
          `${Math.floor(b.startMinutes / 60)}h${String(b.startMinutes % 60).padStart(2, '0')}`,
          b.durationMin,
          b.proName,
          b.proEmail ?? '',
          b.specialty,
          b.placeName,
          b.price,
          b.status,
        ]),
    ]
    downloadCsv(`rapport-studio-filtre-${stamp}.csv`, rows)
  }

  function downloadFull() {
    const stamp = new Date().toISOString().slice(0, 10)
    const allFilters: ReportFilters = {
      placeId: 'all',
      specialty: 'all',
      month: 'all',
      status: 'all',
    }
    const allBookings = filterBookings(bookings, allFilters)
    const allFill = buildSpecialtyFill(places, allBookings, allFilters)
    const allMonth = buildMonthSpecialtyFill(places, allBookings, allFilters)
    const allSummary = buildSummary(allBookings, allFill)

    const rows: (string | number)[][] = [
      ['Rapport général STUDIØ'],
      ['Exporté le', new Date().toLocaleString('fr-FR')],
      [],
      ['Synthèse globale'],
      ['CA total', allSummary.revenue],
      ['CA confirmé', allSummary.revenueConfirmed],
      ['Réservations', allSummary.bookingCount],
      ['Dont confirmées', allSummary.confirmedCount],
      ['Dont en attente', allSummary.pendingCount],
      ['Clients uniques', allSummary.clientCount],
      ['Taux de remplissage (%)', allSummary.fillRate],
      [],
      ['Remplissage par spécialité'],
      ['Spécialité', 'Créneaux dispo', 'Créneaux bookés', 'Taux (%)'],
      ...allFill.map((r) => [r.specialty, r.available, r.booked, r.rate]),
      [],
      ['Remplissage par mois et spécialité'],
      ['Mois', 'Spécialité', 'Créneaux dispo', 'Créneaux bookés', 'Taux (%)'],
      ...allMonth.map((r) => [
        r.month,
        r.specialty,
        r.available,
        r.booked,
        r.rate,
      ]),
      [],
      ['Toutes les réservations'],
      [
        'Date',
        'Début',
        'Durée (min)',
        'Client',
        'E-mail',
        'Spécialité',
        'Lieu',
        'Prix',
        'Statut',
      ],
      ...allBookings
        .slice()
        .sort((a, b) => a.day.getTime() - b.day.getTime())
        .map((b) => [
          b.day.toLocaleDateString('fr-FR'),
          `${Math.floor(b.startMinutes / 60)}h${String(b.startMinutes % 60).padStart(2, '0')}`,
          b.durationMin,
          b.proName,
          b.proEmail ?? '',
          b.specialty,
          b.placeName,
          b.price,
          b.status,
        ]),
    ]
    downloadCsv(`rapport-studio-complet-${stamp}.csv`, rows)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="owner-report"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-report-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            className="owner-report__backdrop"
            aria-label="Fermer"
            onClick={onClose}
          />
          <motion.div
            className="owner-report__panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <header className="owner-report__head">
              <div>
                <p className="owner-cockpit__kicker">Cockpit</p>
                <h2 id="owner-report-title">Rapport</h2>
              </div>
              <button
                type="button"
                className="owner-report__close"
                onClick={onClose}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <div className="owner-report__body">
              <div className="owner-report__filters">
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
                  Mois
                  <select
                    value={filters.month}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, month: e.target.value }))
                    }
                  >
                    <option value="all">Tous</option>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {monthLabelFr(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Statut
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        status: e.target.value as ReportFilters['status'],
                      }))
                    }
                  >
                    <option value="all">Actives</option>
                    <option value="confirmed">
                      {ownerBookingStatusLabel('confirmed')}
                    </option>
                    <option value="pending">
                      {ownerBookingStatusLabel('pending')}
                    </option>
                    <option value="no_show">
                      {ownerBookingStatusLabel('no_show')}
                    </option>
                    <option value="cancelled">
                      {ownerBookingStatusLabel('cancelled')}
                    </option>
                  </select>
                </label>
              </div>

              <div className="owner-report__actions">
                <button
                  type="button"
                  className="owner-report__dl"
                  onClick={downloadFiltered}
                >
                  Télécharger la vue filtrée
                </button>
                <button
                  type="button"
                  className="owner-report__dl is-primary"
                  onClick={downloadFull}
                >
                  Télécharger le rapport complet
                </button>
              </div>

              <section className="owner-report__section">
                <h3>Synthèse</h3>
                <ul className="owner-report__stats">
                  <li>
                    <strong>{formatEuro(summary.revenue)}</strong>
                    <span>CA (filtre)</span>
                  </li>
                  <li>
                    <strong>{formatEuro(summary.revenueConfirmed)}</strong>
                    <span>CA confirmé</span>
                  </li>
                  <li>
                    <strong>{summary.bookingCount}</strong>
                    <span>Réservations</span>
                  </li>
                  <li>
                    <strong>{summary.clientCount}</strong>
                    <span>Clients</span>
                  </li>
                  <li>
                    <strong>{summary.fillRate}%</strong>
                    <span>Remplissage</span>
                  </li>
                </ul>
              </section>

              <section className="owner-report__section">
                <h3>Alertes sous-remplissage</h3>
                <p className="owner-report__hint">
                  Studios sous 40 % de remplissage sur la période filtrée.
                </p>
                {underfill.length === 0 ? (
                  <p className="owner-report__empty">
                    Aucune alerte — tout est au-dessus du seuil.
                  </p>
                ) : (
                  <ul className="owner-report__alerts">
                    {underfill.map((r) => (
                      <li key={r.specialty}>
                        <strong>{r.specialty}</strong>
                        <span>
                          {r.rate}% · {r.booked}/{r.available} créneaux
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="owner-report__section">
                <h3>Remplissage par spécialité</h3>
                {fillBySpec.length === 0 ? (
                  <p className="owner-report__empty">Aucune donnée.</p>
                ) : (
                  <div className="owner-report__table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Spécialité</th>
                          <th>Dispo</th>
                          <th>Booké</th>
                          <th>Taux</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fillBySpec.map((r) => (
                          <tr key={r.specialty}>
                            <td>{r.specialty}</td>
                            <td>{r.available}</td>
                            <td>{r.booked}</td>
                            <td>{r.rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="owner-report__section">
                <h3>Remplissage par mois</h3>
                {fillByMonth.length === 0 ? (
                  <p className="owner-report__empty">Aucune donnée.</p>
                ) : (
                  <div className="owner-report__table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mois</th>
                          <th>Spécialité</th>
                          <th>Dispo</th>
                          <th>Booké</th>
                          <th>Taux</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fillByMonth.map((r) => (
                          <tr key={`${r.month}-${r.specialty}`}>
                            <td style={{ textTransform: 'capitalize' }}>
                              {r.month}
                            </td>
                            <td>{r.specialty}</td>
                            <td>{r.available}</td>
                            <td>{r.booked}</td>
                            <td>{r.rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
