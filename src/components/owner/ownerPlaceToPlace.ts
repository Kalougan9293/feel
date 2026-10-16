import type { CategoryLabel } from '../../data/categories'
import {
  type Place,
  type PlaceMedia,
  type PricingGrid,
} from '../../data/places'
import { phoneToTelHref } from '../../data/phone'
import {
  defaultSlotsForOwnerPlace,
  formatOwnerAddress,
  type OwnerPlace,
} from './OwnerAccountContext'

/** Convertit un lieu propriétaire en `Place` catalogue (aperçu = vue pro). */
export function ownerPlaceToPlace(owner: OwnerPlace): Place {
  const address = formatOwnerAddress(owner)
  const email = owner.email.trim()
  const phone = owner.phone.trim()
  const slots =
    owner.slots?.length > 0 ? owner.slots : defaultSlotsForOwnerPlace()
  const slotsBySpecialty: Partial<Record<CategoryLabel, typeof slots>> = {
    ...owner.slotsBySpecialty,
  }
  for (const spec of owner.specialties) {
    if (!slotsBySpecialty[spec]?.length) {
      slotsBySpecialty[spec] = slots
    }
  }

  const media: PlaceMedia[] =
    owner.media?.length > 0
      ? owner.media.map((m) => ({
          id: m.id,
          kind: 'image' as const,
          src: m.src,
          alt: m.specialty
            ? `${owner.name || 'Lieu'} · ${m.specialty}`
            : owner.name || 'Vue du lieu',
          specialty: m.specialty,
        }))
      : [
          {
            id: `${owner.id}-cover`,
            kind: 'image',
            src: owner.image,
            alt: owner.name || 'Couverture',
          },
        ]

  const hourPrices = owner.specialties
    .map((s) => owner.pricingBySpecialty[s]?.hour)
    .filter((n): n is number => typeof n === 'number')
  const minHour =
    hourPrices.length > 0
      ? Math.min(...hourPrices, owner.pricing.hour)
      : owner.pricing.hour

  const primaryType: CategoryLabel = owner.specialties[0] ?? 'Esthétique'
  const displayName = owner.name.trim() || 'Nom du lieu'

  return {
    id: owner.id,
    name: displayName,
    area: owner.city || '—',
    type: primaryType,
    image: media[0]?.src ?? owner.image,
    x: 50,
    y: 50,
    center: displayName,
    address: address || 'Adresse à renseigner',
    contact: {
      email: email || '—',
      phone: phone || '—',
      mailHref: email ? `mailto:${email}` : '#',
      phoneHref: phone ? phoneToTelHref(phone) : '#',
      emailVisible: owner.emailVisible && Boolean(email),
      phoneVisible: owner.phoneVisible && Boolean(phone),
    },
    media,
    specialties: owner.specialties,
    formations: (owner.events ?? []).map((e) => ({
      title: e.title,
      description: e.description,
      status: 'open' as const,
    })),
    priceFrom: `${minHour}€ / h`,
    pricing: owner.pricing,
    pricingBySpecialty: owner.pricingBySpecialty,
    description:
      owner.description.trim() ||
      'Description du lieu — visible par les professionnels.',
    descriptionBySpecialty: owner.descriptionBySpecialty,
    lat: 48.8566,
    lng: 2.3522,
    slots,
    slotsBySpecialty,
    slotExceptions: owner.slotExceptions ?? [],
    availability: 'Disponible',
  }
}

export function emptyPricing(): PricingGrid {
  return {
    hour: 40,
    hours2: 74,
    hours3: 105,
    hours4: 128,
    halfDay: 0,
    day: 0,
    week: 0,
    month: 0,
    quarter: 0,
    semester: 0,
    year: 0,
  }
}
