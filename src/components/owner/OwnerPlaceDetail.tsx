import { useMemo, useState } from 'react'
import type { CategoryLabel } from '../../data/categories'
import { PlaceDetail } from '../pro/PlaceDetail'
import '../pro/ProAccueil.css'
import {
  isDemoPlace,
  useOwnerAccount,
  type OwnerPlace,
} from './OwnerAccountContext'
import {
  OwnerPlaceEditSheet,
  ReglagesButton,
  type OwnerEditSection,
} from './OwnerPlaceEditSheet'
import { ownerPlaceToPlace } from './ownerPlaceToPlace'
import './Owner.css'

type Props = {
  place: OwnerPlace
  onBack: () => void
}

export function OwnerPlaceDetail({ place, onBack }: Props) {
  const { removePlace, updatePlace, bookingsForPlace } = useOwnerAccount()
  const view = useMemo(() => ownerPlaceToPlace(place), [place])
  const bookings = useMemo(
    () => bookingsForPlace(place.id),
    [bookingsForPlace, place.id],
  )
  const [edit, setEdit] = useState<OwnerEditSection | null>(null)
  const [editSpec, setEditSpec] = useState<CategoryLabel | null>(null)

  function handleRemove() {
    if (
      !window.confirm(
        `Supprimer « ${place.name || 'ce lieu'} » ? Cette action est définitive.`,
      )
    ) {
      return
    }
    removePlace(place.id)
    onBack()
  }

  function openEdit(
    section: OwnerEditSection,
    specialty: CategoryLabel | null = null,
  ) {
    setEditSpec(specialty)
    setEdit(section)
  }

  return (
    <div className="pro-home owner-place-view">
      <div className="pro-home__layout is-detail">
        <div className="pro-home__list-pane">
          <div className="pro-home__detail">
            <div className="owner-detail__toolbar">
              <span className="owner-detail__toolbar-spacer" aria-hidden />
              {!isDemoPlace(place) ? (
                <button
                  type="button"
                  className="owner-detail__delete-quiet"
                  onClick={handleRemove}
                >
                  Supprimer
                </button>
              ) : null}
            </div>

            <PlaceDetail
              place={view}
              onBack={onBack}
              preview
              hideFavorite
              backLabel="← Mes lieux"
              onSlotExceptionsChange={(slotExceptions) =>
                updatePlace(place.id, { slotExceptions })
              }
              bookings={bookings}
              events={place.events ?? []}
              onEventsChange={(events) => updatePlace(place.id, { events })}
              sectionActions={{
                gallery: (
                  <ReglagesButton
                    label="Photos"
                    onClick={() => openEdit('media')}
                  />
                ),
                identity: (
                  <ReglagesButton
                    label="Identité"
                    onClick={() => openEdit('identity')}
                  />
                ),
                contact: (
                  <ReglagesButton
                    label="Contact"
                    onClick={() => openEdit('contact')}
                  />
                ),
                calendar: (
                  <ReglagesButton
                    label="Horaires"
                    onClick={() => openEdit('slots')}
                  />
                ),
                description: (
                  <ReglagesButton
                    label="Description"
                    onClick={() => openEdit('description')}
                  />
                ),
                specialty: (
                  <ReglagesButton
                    label="Spécialité"
                    onClick={() => openEdit('studios')}
                  />
                ),
                pricing: (
                  <ReglagesButton
                    label="Tarifs"
                    onClick={() => openEdit('pricing')}
                  />
                ),
              }}
            />
          </div>
        </div>
      </div>

      <OwnerPlaceEditSheet
        open={edit != null}
        section={edit}
        place={place}
        initialSpecialty={editSpec}
        onClose={() => setEdit(null)}
        onSave={(patch) => updatePlace(place.id, patch)}
      />
    </div>
  )
}
