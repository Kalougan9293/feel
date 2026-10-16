import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import './RoleModal.css'

export type UserRole = 'proprietaire' | 'professionnel'

type Props = {
  open: boolean
  onClose: () => void
  onSelect?: (role: UserRole) => void
}

const CHOICES = [
  {
    id: 'professionnel' as const,
    label: 'Professionnel',
    hint: 'Je cherche un espace pour exercer',
  },
  {
    id: 'proprietaire' as const,
    label: 'Propriétaire',
    hint: 'Je gère mes studios et mon planning',
  },
]

export function RoleModal({ open, onClose, onSelect }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="role-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            className="role-modal__backdrop"
            aria-label="Fermer"
            onClick={onClose}
          />

          <motion.div
            className="role-modal__panel"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              className="role-modal__close"
              onClick={onClose}
              aria-label="Fermer"
            >
              ×
            </button>

            <p className="role-modal__eyebrow">STUDIØ</p>
            <h2 id="role-modal-title" className="role-modal__title">
              Vous êtes ?
            </h2>
            <p className="role-modal__lead">
              Choisissez votre profil pour continuer.
            </p>

            <div className="role-modal__choices">
              {CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className="role-modal__choice"
                  onClick={() => {
                    onSelect?.(choice.id)
                    onClose()
                  }}
                >
                  <span className="role-modal__choice-label">
                    {choice.label}
                  </span>
                  <span className="role-modal__choice-hint">{choice.hint}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
