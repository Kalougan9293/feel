import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { PLACES } from '../../data/places'
import {
  formatBookingDate,
  formatBookingTime,
  useProAccount,
  type ProBooking,
} from './ProAccountContext'
import './ProProfileModal.css'

export type ProfileSection =
  | 'infos'
  | 'favoris'
  | 'reservations'
  | 'historique'

type Props = {
  open: boolean
  onClose: () => void
  initialSection?: ProfileSection
  onSelectPlace?: (placeId: string) => void
}

const SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: 'infos', label: 'Mes infos' },
  { id: 'favoris', label: 'Favoris' },
  { id: 'reservations', label: 'À venir' },
  { id: 'historique', label: 'Passé' },
]

const BOOKING_RULES = [
  'Arrivez 10 minutes avant le début du créneau. Accès autonome via le digicode envoyé après paiement.',
  'Laissez l’espace propre : ranger le matériel, jeter les consommables, éteindre lumières et appareils.',
  'Annulation gratuite jusqu’à 24 h avant le créneau. Au-delà, le montant peut être retenu.',
  'En cas de problème sur place, contactez l’accueil du hub via les coordonnées indiquées sur la fiche.',
]

function BookingMeta({ booking }: { booking: ProBooking }) {
  return (
    <dl className="pro-profile__book-meta">
      <div>
        <dt>Spécialité</dt>
        <dd>{booking.specialty}</dd>
      </div>
      <div>
        <dt>Lieu</dt>
        <dd>{booking.placeName}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{formatBookingDate(booking.day)}</dd>
      </div>
      <div>
        <dt>Horaire</dt>
        <dd>{formatBookingTime(booking.startMinutes, booking.durationMin)}</dd>
      </div>
      <div>
        <dt>Prix</dt>
        <dd>{booking.price}€</dd>
      </div>
    </dl>
  )
}

export function ProProfileModal({
  open,
  onClose,
  initialSection = 'infos',
  onSelectPlace,
}: Props) {
  const { favoriteIds, removeFavorite, upcoming, past } = useProAccount()
  const favorites = useMemo(
    () =>
      favoriteIds
        .map((id) => PLACES.find((p) => p.id === id))
        .filter((p): p is (typeof PLACES)[number] => Boolean(p)),
    [favoriteIds],
  )
  const [section, setSection] = useState<ProfileSection>(initialSection)
  const [infos, setInfos] = useState({
    firstName: 'Alex',
    lastName: 'Martin',
    email: 'alex.martin@email.com',
    billingName: 'Alex Martin',
    billingAddress: '12 rue des Ateliers, 75011 Paris',
    siret: '',
  })
  const [saved, setSaved] = useState(false)
  const [openCodeId, setOpenCodeId] = useState<string | null>(null)
  const [openInfoId, setOpenInfoId] = useState<string | null>(null)

  function toggleCode(id: string) {
    setOpenInfoId(null)
    setOpenCodeId((cur) => (cur === id ? null : id))
  }

  function toggleInfo(id: string) {
    setOpenCodeId(null)
    setOpenInfoId((cur) => (cur === id ? null : id))
  }

  useEffect(() => {
    if (!open) return
    setSection(initialSection)
    setOpenCodeId(null)
    setOpenInfoId(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, initialSection])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="pro-profile"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-profile-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            className="pro-profile__backdrop"
            aria-label="Fermer"
            onClick={onClose}
          />

          <motion.div
            className="pro-profile__panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <header className="pro-profile__head">
              <h2 id="pro-profile-title">Profil</h2>
              <button
                type="button"
                className="pro-profile__close"
                onClick={onClose}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <nav className="pro-profile__tabs" aria-label="Sections profil">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pro-profile__tab is-${s.id}${section === s.id ? ' is-active' : ''}`}
                  aria-current={section === s.id ? 'page' : undefined}
                  onClick={() => setSection(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="pro-profile__body">
              {section === 'infos' && (
                <form
                  className="pro-profile__form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setSaved(true)
                    window.setTimeout(() => setSaved(false), 1800)
                  }}
                >
                  <fieldset>
                    <div className="pro-profile__row">
                      <label>
                        Prénom
                        <input
                          value={infos.firstName}
                          onChange={(e) =>
                            setInfos((v) => ({
                              ...v,
                              firstName: e.target.value,
                            }))
                          }
                          autoComplete="given-name"
                        />
                      </label>
                      <label>
                        Nom
                        <input
                          value={infos.lastName}
                          onChange={(e) =>
                            setInfos((v) => ({
                              ...v,
                              lastName: e.target.value,
                            }))
                          }
                          autoComplete="family-name"
                        />
                      </label>
                    </div>
                    <label>
                      E-mail
                      <input
                        type="email"
                        value={infos.email}
                        onChange={(e) =>
                          setInfos((v) => ({ ...v, email: e.target.value }))
                        }
                        autoComplete="email"
                      />
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>Facturation</legend>
                    <label>
                      Nom / raison sociale
                      <input
                        value={infos.billingName}
                        onChange={(e) =>
                          setInfos((v) => ({
                            ...v,
                            billingName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Adresse de facturation
                      <input
                        value={infos.billingAddress}
                        onChange={(e) =>
                          setInfos((v) => ({
                            ...v,
                            billingAddress: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      SIRET (optionnel)
                      <input
                        value={infos.siret}
                        onChange={(e) =>
                          setInfos((v) => ({ ...v, siret: e.target.value }))
                        }
                        placeholder="14 chiffres"
                      />
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>Sécurité</legend>
                    <label>
                      Mot de passe
                      <input
                        type="password"
                        value="········"
                        readOnly
                        aria-describedby="pro-profile-pwd-hint"
                      />
                    </label>
                    <p id="pro-profile-pwd-hint" className="pro-profile__hint">
                      Démo — changement de mot de passe bientôt disponible.
                    </p>
                  </fieldset>

                  <div className="pro-profile__form-actions">
                    <button type="submit" className="pro-profile__primary">
                      {saved ? 'Enregistré' : 'Enregistrer'}
                    </button>
                  </div>

                  <div className="pro-profile__danger">
                    <p>
                      Suppression du compte (RGPD) — vos données personnelles
                      seront effacées sous 30 jours.
                    </p>
                    <button type="button" className="pro-profile__danger-btn">
                      Supprimer mon compte
                    </button>
                  </div>
                </form>
              )}

              {section === 'favoris' && (
                <div className="pro-profile__list-wrap">
                  {favorites.length === 0 ? (
                    <p className="pro-profile__empty">Aucun favori pour l’instant.</p>
                  ) : (
                    <ul className="pro-profile__fav-list">
                      {favorites.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            className="pro-profile__fav-text"
                            onClick={() => onSelectPlace?.(f.id)}
                          >
                            <strong>{f.name}</strong>
                            <span>{f.address}</span>
                          </button>
                          <button
                            type="button"
                            className="pro-profile__heart"
                            aria-label={`Retirer ${f.name} des favoris`}
                            onClick={() => removeFavorite(f.id)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M12 20.2 10.55 18.9C5.4 14.25 2 11.2 2 7.5 2 4.5 4.4 2.2 7.35 2.2c1.7 0 3.35.8 4.4 2.05C12.8 3 14.45 2.2 16.15 2.2 19.1 2.2 21.5 4.5 21.5 7.5c0 3.7-3.4 6.75-8.55 11.4L12 20.2Z"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {section === 'reservations' &&
                (upcoming.length === 0 ? (
                  <p className="pro-profile__empty">Aucune réservation à venir.</p>
                ) : (
                  <ul className="pro-profile__book-list">
                    {upcoming.map((r) => (
                      <li key={r.id} className="pro-profile__book">
                        <BookingMeta booking={r} />

                        <div className="pro-profile__book-actions">
                          <button
                            type="button"
                            className={`pro-profile__chip${openCodeId === r.id ? ' is-on' : ''}`}
                            aria-expanded={openCodeId === r.id}
                            onClick={() => toggleCode(r.id)}
                          >
                            Code
                          </button>
                          <button
                            type="button"
                            className={`pro-profile__chip${openInfoId === r.id ? ' is-on' : ''}`}
                            aria-expanded={openInfoId === r.id}
                            onClick={() => toggleInfo(r.id)}
                          >
                            Info
                          </button>
                        </div>

                        {openCodeId === r.id && (
                          <div
                            className="pro-profile__bubble"
                            role="region"
                            aria-label="Code d’accès"
                          >
                            {r.access.kind === 'qr' ? (
                              <>
                                <p className="pro-profile__bubble-title">
                                  QR code d’accès
                                </p>
                                <div className="pro-profile__qr" aria-hidden />
                                <p className="pro-profile__bubble-hint">
                                  Présentez ce QR à l’entrée · {r.access.value}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="pro-profile__bubble-title">
                                  Mot de passe d’accès
                                </p>
                                <p className="pro-profile__pin">{r.access.value}</p>
                                <p className="pro-profile__bubble-hint">
                                  Digicode porte / cabine
                                </p>
                              </>
                            )}
                          </div>
                        )}

                        {openInfoId === r.id && (
                          <div
                            className="pro-profile__bubble"
                            role="region"
                            aria-label="Instructions"
                          >
                            <p className="pro-profile__bubble-title">
                              Instructions (aussi envoyées par e-mail)
                            </p>
                            <ul className="pro-profile__rules">
                              {BOOKING_RULES.map((rule) => (
                                <li key={rule}>{rule}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ))}

              {section === 'historique' &&
                (past.length === 0 ? (
                  <p className="pro-profile__empty">Aucune réservation passée.</p>
                ) : (
                  <ul className="pro-profile__book-list">
                    {past.map((h) => (
                      <li key={h.id} className="pro-profile__book">
                        <BookingMeta booking={h} />
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
