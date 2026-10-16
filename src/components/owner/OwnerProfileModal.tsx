import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatFrenchPhone } from '../../data/phone'
import {
  useOwnerAccount,
  type OwnerProfile,
} from './OwnerAccountContext'
import './Owner.css'

type Props = {
  open: boolean
  onClose: () => void
}

export function OwnerProfileModal({ open, onClose }: Props) {
  const { profile, updateProfile } = useOwnerAccount()
  const [infos, setInfos] = useState<OwnerProfile>(profile)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setInfos(profile)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, profile])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="owner-profile"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-profile-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            className="owner-profile__backdrop"
            aria-label="Fermer"
            onClick={onClose}
          />
          <motion.div
            className="owner-profile__panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <header className="owner-profile__head">
              <h2 id="owner-profile-title">Mes infos</h2>
              <button
                type="button"
                className="owner-profile__close"
                onClick={onClose}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <div className="owner-profile__body">
              <form
                className="owner-profile__form"
                onSubmit={(e) => {
                  e.preventDefault()
                  updateProfile({
                    ...infos,
                    phone: formatFrenchPhone(infos.phone),
                    postalCode: infos.postalCode.replace(/\D/g, '').slice(0, 5),
                  })
                  setSaved(true)
                  window.setTimeout(() => setSaved(false), 1600)
                }}
              >
                <div className="owner-profile__row">
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
                      placeholder="Votre prénom"
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
                      placeholder="Votre nom"
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
                    placeholder="vous@exemple.fr"
                  />
                </label>
                <label>
                  Téléphone
                  <input
                    type="tel"
                    value={infos.phone}
                    onChange={(e) =>
                      setInfos((v) => ({
                        ...v,
                        phone: formatFrenchPhone(e.target.value),
                      }))
                    }
                    autoComplete="tel"
                    inputMode="numeric"
                    placeholder="06 12 34 56 78"
                  />
                </label>
                <label>
                  Adresse (n° + rue)
                  <input
                    value={infos.street}
                    onChange={(e) =>
                      setInfos((v) => ({ ...v, street: e.target.value }))
                    }
                    autoComplete="street-address"
                    placeholder="Ex. 12 rue des Ateliers"
                  />
                </label>
                <div className="owner-profile__row owner-profile__row--addr">
                  <label>
                    Code postal
                    <input
                      value={infos.postalCode}
                      onChange={(e) =>
                        setInfos((v) => ({
                          ...v,
                          postalCode: e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 5),
                        }))
                      }
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="75011"
                      maxLength={5}
                    />
                  </label>
                  <label>
                    Ville
                    <input
                      value={infos.city}
                      onChange={(e) =>
                        setInfos((v) => ({ ...v, city: e.target.value }))
                      }
                      autoComplete="address-level2"
                      placeholder="Paris"
                    />
                  </label>
                </div>

                <fieldset>
                  <legend>Facturation</legend>
                  <label>
                    Raison sociale
                    <input
                      value={infos.billingName}
                      onChange={(e) =>
                        setInfos((v) => ({
                          ...v,
                          billingName: e.target.value,
                        }))
                      }
                      placeholder="Nom / société"
                    />
                  </label>
                  <label>
                    SIRET
                    <input
                      value={infos.siret}
                      onChange={(e) =>
                        setInfos((v) => ({ ...v, siret: e.target.value }))
                      }
                      placeholder="Optionnel"
                    />
                  </label>
                </fieldset>

                <div className="owner-profile__form-actions">
                  <button type="submit" className="owner-profile__primary">
                    {saved ? 'Enregistré' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
