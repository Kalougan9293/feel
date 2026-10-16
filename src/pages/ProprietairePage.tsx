import { useState } from 'react'
import { Link } from 'react-router-dom'
import { OwnerAccueil } from '../components/owner/OwnerAccueil'
import {
  OwnerAccountProvider,
  useOwnerAccount,
} from '../components/owner/OwnerAccountContext'
import { OwnerAgendaModal } from '../components/owner/OwnerAgendaModal'
import { OwnerClientsModal } from '../components/owner/OwnerClientsModal'
import { OwnerPlaceDetail } from '../components/owner/OwnerPlaceDetail'
import { OwnerProfileModal } from '../components/owner/OwnerProfileModal'
import { OwnerReportModal } from '../components/owner/OwnerReportModal'
import './ProfessionnelPage.css'

function ProprietaireInner() {
  const { getPlace } = useOwnerAccount()
  const [profileOpen, setProfileOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [clientsOpen, setClientsOpen] = useState(false)
  const [managePlaceId, setManagePlaceId] = useState<string | null>(null)
  const managePlace =
    managePlaceId != null ? (getPlace(managePlaceId) ?? null) : null

  function openOnly(
    which: 'agenda' | 'clients' | 'report' | 'profile' | null,
  ) {
    setAgendaOpen(which === 'agenda')
    setClientsOpen(which === 'clients')
    setReportOpen(which === 'report')
    setProfileOpen(which === 'profile')
  }

  return (
    <div className="pro-page">
      <header className="pro-page__header">
        <Link className="pro-page__brand" to="/">
          STUDIØ
        </Link>
        <nav className="pro-page__header-actions" aria-label="Cockpit">
          <button
            type="button"
            className={`pro-page__nav-btn${agendaOpen ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={agendaOpen}
            onClick={() => openOnly(agendaOpen ? null : 'agenda')}
          >
            Agenda
          </button>
          <button
            type="button"
            className={`pro-page__nav-btn${clientsOpen ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={clientsOpen}
            onClick={() => openOnly(clientsOpen ? null : 'clients')}
          >
            Clients
          </button>
          <button
            type="button"
            className={`pro-page__nav-btn${reportOpen ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={reportOpen}
            onClick={() => openOnly(reportOpen ? null : 'report')}
          >
            Rapport
          </button>
          <button
            type="button"
            className={`pro-page__profile${profileOpen ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            onClick={() => openOnly(profileOpen ? null : 'profile')}
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
        </nav>
      </header>

      <main className="pro-page__main">
        {managePlace ? (
          <OwnerPlaceDetail
            place={managePlace}
            onBack={() => setManagePlaceId(null)}
          />
        ) : (
          <OwnerAccueil onOpenPlace={setManagePlaceId} />
        )}
      </main>

      <OwnerProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <OwnerAgendaModal
        open={agendaOpen}
        onClose={() => setAgendaOpen(false)}
        initialPlaceId={managePlaceId}
      />
      <OwnerClientsModal
        open={clientsOpen}
        onClose={() => setClientsOpen(false)}
        initialPlaceId={managePlaceId}
      />
      <OwnerReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        initialPlaceId={managePlaceId}
      />
    </div>
  )
}

export function ProprietairePage() {
  return (
    <OwnerAccountProvider>
      <ProprietaireInner />
    </OwnerAccountProvider>
  )
}
