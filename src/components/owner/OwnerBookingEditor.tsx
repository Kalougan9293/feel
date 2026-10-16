import { useEffect, useMemo, useState } from 'react'
import {
  HALF_HOUR_OPTIONS,
  formatMinutes,
  startOfDay,
  toDateKey,
} from '../../data/availability'
import { type CategoryLabel } from '../../data/categories'
import {
  generateAccessCode,
  ownerBookingStatusLabel,
  pricingForOwnerSpecialty,
  useOwnerAccount,
  type OwnerBooking,
  type OwnerBookingStatus,
} from './OwnerAccountContext'

type Props = {
  initial?: OwnerBooking | null
  defaultPlaceId?: string | null
  onClose: () => void
  onSaved: () => void
}

const DURATIONS = [60, 90, 120, 180] as const
const STATUSES: OwnerBookingStatus[] = [
  'confirmed',
  'pending',
  'no_show',
  'cancelled',
]

function priceForDuration(
  hour: number,
  hours2: number,
  hours3: number,
  durationMin: number,
): number {
  const h = durationMin / 60
  if (h >= 3) return hours3 || hour * 3
  if (h >= 2) return hours2 || hour * 2
  return hour
}

export function OwnerBookingEditor({
  initial,
  defaultPlaceId,
  onClose,
  onSaved,
}: Props) {
  const { places, createBooking, updateBooking } = useOwnerAccount()
  const [placeId, setPlaceId] = useState(
    initial?.placeId ?? defaultPlaceId ?? places[0]?.id ?? '',
  )
  const place = places.find((p) => p.id === placeId)
  const [specialty, setSpecialty] = useState<CategoryLabel | ''>(
    (initial?.specialty as CategoryLabel) ||
      place?.specialties[0] ||
      '',
  )
  const [proName, setProName] = useState(initial?.proName ?? '')
  const [proEmail, setProEmail] = useState(initial?.proEmail ?? '')
  const [day, setDay] = useState(
    initial ? toDateKey(initial.day) : toDateKey(new Date()),
  )
  const [startMinutes, setStartMinutes] = useState(
    initial?.startMinutes ?? 10 * 60,
  )
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 60)
  const [price, setPrice] = useState(initial?.price ?? 40)
  const [status, setStatus] = useState<OwnerBookingStatus>(
    initial?.status ?? 'confirmed',
  )
  const [accessKind, setAccessKind] = useState<'code' | 'qr'>(
    initial?.accessKind ?? 'code',
  )

  useEffect(() => {
    if (!place) return
    if (!specialty || !place.specialties.includes(specialty as CategoryLabel)) {
      setSpecialty(place.specialties[0] ?? '')
    }
  }, [place, specialty])

  const suggestedPrice = useMemo(() => {
    if (!place || !specialty) return 40
    const grid = pricingForOwnerSpecialty(place, specialty as CategoryLabel)
    return priceForDuration(grid.hour, grid.hours2, grid.hours3, durationMin)
  }, [place, specialty, durationMin])

  useEffect(() => {
    if (!initial) setPrice(suggestedPrice)
  }, [suggestedPrice, initial])

  const canSave =
    Boolean(placeId) &&
    Boolean(specialty) &&
    proName.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(day)

  function save() {
    if (!canSave || !specialty) return
    const dayDate = startOfDay(new Date(`${day}T12:00:00`))
    if (initial) {
      updateBooking(initial.id, {
        placeId,
        placeName: place?.name.trim() || initial.placeName,
        specialty,
        proName: proName.trim(),
        proEmail: proEmail.trim() || undefined,
        day: dayDate,
        startMinutes,
        durationMin,
        price,
        status,
        accessKind,
      })
    } else {
      createBooking({
        placeId,
        specialty,
        proName: proName.trim(),
        proEmail: proEmail.trim() || undefined,
        day: dayDate,
        startMinutes,
        durationMin,
        price,
        status,
        accessKind,
      })
    }
    onSaved()
  }

  return (
    <div className="owner-booking-editor">
      <div className="owner-booking-editor__head">
        <h3>{initial ? 'Modifier la réservation' : 'Nouvelle réservation'}</h3>
        <button type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>
      <div className="owner-booking-editor__form">
        <label>
          Lieu
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            disabled={Boolean(initial)}
          >
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.trim() || 'Sans nom'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Studio
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value as CategoryLabel)}
          >
            {(place?.specialties ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Client / pro
          <input
            value={proName}
            onChange={(e) => setProName(e.target.value)}
            placeholder="Prénom Nom"
            autoFocus
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            value={proEmail}
            onChange={(e) => setProEmail(e.target.value)}
            placeholder="optionnel"
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label>
          Début
          <select
            value={startMinutes}
            onChange={(e) => setStartMinutes(Number(e.target.value))}
          >
            {HALF_HOUR_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Durée
          <select
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <label>
          Prix (€)
          <input
            type="number"
            min={0}
            value={price || ''}
            onChange={(e) =>
              setPrice(Number(e.target.value.replace(/\D/g, '')) || 0)
            }
          />
        </label>
        <label>
          Statut
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as OwnerBookingStatus)
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ownerBookingStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Accès
          <select
            value={accessKind}
            onChange={(e) =>
              setAccessKind(e.target.value as 'code' | 'qr')
            }
          >
            <option value="code">Code</option>
            <option value="qr">QR</option>
          </select>
        </label>
      </div>
      {initial && (
        <p className="owner-booking-editor__access">
          Code actuel : <code>{initial.accessCode}</code>
          <button
            type="button"
            className="owner-cockpit__mini-btn is-ghost"
            onClick={() =>
              updateBooking(initial.id, {
                accessCode: generateAccessCode(`${initial.id}-${Date.now()}`),
              })
            }
          >
            Régénérer
          </button>
        </p>
      )}
      <div className="owner-booking-editor__actions">
        <button type="button" className="owner-report__dl" onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className="owner-report__dl is-primary"
          disabled={!canSave}
          onClick={save}
        >
          {initial ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  )
}
