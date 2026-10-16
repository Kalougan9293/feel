import { useMemo, useState, type CSSProperties } from 'react'
import { colorOf } from '../../data/categories'
import { useOwnerAccount, type OwnerPlace } from './OwnerAccountContext'
import { OwnerOnboardingWizard } from './OwnerOnboardingWizard'
import { ownerPlaceToPlace } from './ownerPlaceToPlace'
import '../pro/ProAccueil.css'
import './Owner.css'

type Props = {
  onOpenPlace: (placeId: string) => void
}

export function OwnerAccueil({ onOpenPlace }: Props) {
  const { places, resetAccount, removePlace } = useOwnerAccount()
  const [wizardOpen, setWizardOpen] = useState(false)

  const cards = useMemo(
    () => places.map((p) => ({ owner: p, view: ownerPlaceToPlace(p) })),
    [places],
  )

  function confirmRemove(owner: OwnerPlace) {
    const label = owner.name.trim() || 'cette fiche'
    if (
      !window.confirm(
        `Supprimer « ${label} » ? Cette action est locale et irréversible.`,
      )
    ) {
      return
    }
    removePlace(owner.id)
  }

  return (
    <div className="pro-home owner-home--pro">
      <header className="owner-home__pro-head">
        <p className="owner-home__kicker">Espace propriétaire</p>
        <h1 className="owner-home__title">Mes fiches</h1>
      </header>

      <div className="pro-home__layout owner-home__layout">
        <div className="pro-home__list-pane">
          {cards.length === 0 ? (
            <div className="owner-home__blank">
              <p>Aucun lieu pour l’instant.</p>
              <p className="owner-home__blank-hint">
                Un court questionnaire, puis votre fiche s’affiche comme pour un
                professionnel.
              </p>
              <button
                type="button"
                className="owner-home__blank-cta"
                onClick={() => setWizardOpen(true)}
              >
                Créer un lieu
              </button>
            </div>
          ) : (
            <ul className="owner-home__tiles" aria-label="Mes lieux">
              {cards.map(({ owner, view }) => (
                <li key={owner.id}>
                  <OwnerPlaceCard
                    owner={owner}
                    name={view.name}
                    area={view.address}
                    image={view.image}
                    specialties={view.specialties}
                    onOpen={() => onOpenPlace(owner.id)}
                    onDelete={() => confirmRemove(owner)}
                  />
                </li>
              ))}
              <li className="owner-home__tile-add">
                <button
                  type="button"
                  className="owner-home__new-place"
                  onClick={() => setWizardOpen(true)}
                >
                  <span aria-hidden>+</span>
                  Nouveau lieu
                </button>
              </li>
            </ul>
          )}

          {places.length > 0 && (
            <p className="owner-home__reset-wrap">
              <button
                type="button"
                className="owner-home__reset"
                onClick={() => {
                  if (
                    window.confirm(
                      'Remettre le compte propriétaire à zéro sur cet appareil ?',
                    )
                  ) {
                    resetAccount()
                  }
                }}
              >
                Réinitialiser (local)
              </button>
            </p>
          )}
        </div>
      </div>

      <OwnerOnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={onOpenPlace}
      />
    </div>
  )
}

function OwnerPlaceCard({
  owner,
  name,
  area,
  image,
  specialties,
  onOpen,
  onDelete,
}: {
  owner: OwnerPlace
  name: string
  area: string
  image: string
  specialties: OwnerPlace['specialties']
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <div className="owner-tile">
      <button
        type="button"
        className="owner-tile__open"
        onClick={onOpen}
        aria-label={`Ouvrir ${name}`}
      >
        <div
          className="owner-tile__media"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="owner-tile__body">
          <h2 className="owner-tile__name">{name}</h2>
          <p className="owner-tile__area">{area}</p>
          <ul className="owner-tile__specs" aria-label="Spécialités">
            {specialties.map((spec) => (
              <li
                key={spec}
                className="pro-spec"
                style={
                  {
                    ['--spec-color' as string]: colorOf(spec),
                  } as CSSProperties
                }
              >
                {spec}
              </li>
            ))}
          </ul>
          <p className="owner-tile__meta">
            {owner.specialties.length} studio
            {owner.specialties.length > 1 ? 's' : ''}
          </p>
        </div>
      </button>
      <button
        type="button"
        className="owner-place-card__trash"
        aria-label={`Supprimer ${name}`}
        title="Supprimer"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 7h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M9.5 7V5.8A1.8 1.8 0 0 1 11.3 4h1.4A1.8 1.8 0 0 1 14.5 5.8V7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M7.5 7v11.2A1.8 1.8 0 0 0 9.3 20h5.4a1.8 1.8 0 0 0 1.8-1.8V7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M10.2 11v5.2M13.8 11v5.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
