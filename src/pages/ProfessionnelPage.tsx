import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProAccueil } from '../components/pro/ProAccueil'
import { ProAccountProvider } from '../components/pro/ProAccountContext'
import { ProProfileModal } from '../components/pro/ProProfileModal'
import './ProfessionnelPage.css'

export function ProfessionnelPage() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null)

  const handleOpenPlaceHandled = useCallback(() => {
    setOpenPlaceId(null)
  }, [])

  return (
    <ProAccountProvider>
      <div className="pro-page">
        <header className="pro-page__header">
          <Link className="pro-page__brand" to="/">
            STUDIØ
          </Link>
          <button
            type="button"
            className={`pro-page__profile${profileOpen ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen(true)}
          >
            <span>Profil</span>
            <span className="pro-page__profile-icon" aria-hidden>
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="8.5"
                  r="3.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M5 19.5c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
        </header>

        <main className="pro-page__main">
          <ProAccueil
            openPlaceId={openPlaceId}
            onOpenPlaceHandled={handleOpenPlaceHandled}
          />
        </main>

        <ProProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onSelectPlace={(placeId) => {
            setProfileOpen(false)
            setOpenPlaceId(placeId)
          }}
        />
      </div>
    </ProAccountProvider>
  )
}
