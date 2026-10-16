import {
  formatNextSlot,
  type AvailSlot,
  type SlotException,
  type WeekDay,
} from './availability'
import { CATEGORIES, type CategoryLabel } from './categories'
import { formatFrenchPhone, phoneToTelHref } from './phone'
import { SPOTS, type Spot } from './spots'

export type PlaceContact = {
  email: string
  phone: string
  phoneHref: string
  mailHref: string
  /** Afficher le bouton e-mail sur la fiche (défaut : true) */
  emailVisible?: boolean
  /** Afficher le bouton téléphone sur la fiche (défaut : true) */
  phoneVisible?: boolean
}

export type Formation = {
  title: string
  status: 'open' | 'soon'
  description?: string
}

export type PricingGrid = {
  /** Forfait 1 h */
  hour: number
  /** Forfait 2 h (souvent dégressif) */
  hours2: number
  /** Forfait 3 h */
  hours3: number
  /** Forfait 4 h */
  hours4: number
  /** À partir de — demi-journée (0 = non affiché) */
  halfDay: number
  /** À partir de — journée */
  day: number
  /** À partir de — semaine */
  week: number
  /** À partir de — mois */
  month: number
  /** À partir de — trimestre */
  quarter: number
  /** À partir de — semestre */
  semester: number
  /** À partir de — année */
  year: number
}

/** Complète une grille (migration / démo) */
export function normalizePricing(
  raw: Partial<PricingGrid> | undefined,
): PricingGrid {
  const hour = raw?.hour ?? 40
  return {
    hour,
    hours2: raw?.hours2 ?? Math.round(hour * 1.85),
    hours3: raw?.hours3 ?? Math.round(hour * 2.6),
    hours4: raw?.hours4 ?? Math.round(hour * 3.2),
    halfDay: raw?.halfDay ?? 0,
    day: raw?.day ?? 0,
    week: raw?.week ?? 0,
    month: raw?.month ?? 0,
    quarter: raw?.quarter ?? 0,
    semester: raw?.semester ?? 0,
    year: raw?.year ?? 0,
  }
}

/** Prix selon durée réservée (1–4 h) */
export function priceForDuration(
  grid: PricingGrid,
  durationMin: number,
): number {
  const g = normalizePricing(grid)
  if (durationMin <= 60) return g.hour
  if (durationMin <= 120) return g.hours2
  if (durationMin <= 180) return g.hours3
  if (durationMin <= 240) return g.hours4
  return Math.round((g.hour * durationMin) / 60)
}

export type PlaceMedia = {
  id: string
  kind: 'image' | 'video'
  /** URL image, ou poster si vidéo */
  src: string
  /** URL vidéo (optionnel, démo) */
  videoSrc?: string
  alt?: string
  /** Si défini : espace métier (sinon couloir / entrée / accueil) */
  specialty?: CategoryLabel
}

export type Place = Omit<Spot, 'availability'> & {
  center: string
  address: string
  contact: PlaceContact
  /** Galerie média (photos + vidéos à venir) */
  media: PlaceMedia[]
  /** Toutes les spécialités / espaces du hub */
  specialties: CategoryLabel[]
  formations: Formation[]
  /** Affichage court « X€ / h » (souvent le mini du hub) */
  priceFrom: string
  /** Grille par défaut (mini hub) — fallback */
  pricing: PricingGrid
  /** Tarifs par spécialité / type d’espace */
  pricingBySpecialty: Partial<Record<CategoryLabel, PricingGrid>>
  /** Description générale du lieu (tous publics) */
  description: string
  /** Description rédigée par le proprio pour chaque espace / spécialité */
  descriptionBySpecialty: Partial<Record<CategoryLabel, string>>
  lat: number
  lng: number
  /** Motif hebdo « agrégé » (mini hub / fallback) */
  slots: AvailSlot[]
  /** Un calendrier par espace / spécialité — futur back-office proprio */
  slotsBySpecialty: Partial<Record<CategoryLabel, AvailSlot[]>>
  /** Blocages ponctuels (travaux, visite hors agenda…) */
  slotExceptions?: SlotException[]
  /** Libellé dispo de secours — la liste recalcule en live */
  availability: string
}

const GALLERY_POOL = [
  '/inspiration-cabine.jpg',
  '/hero-salon.jpg',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80',
]

const COMMON_SPACE_ALTS = ['Entrée', 'Accueil', 'Couloir', 'Espaces communs']

/** Cap galerie fiche lieu (MVP) */
export const PLACE_MEDIA_MAX = 15

function buildMedia(
  cover: string,
  seed: number,
  specialties: CategoryLabel[] = [],
): PlaceMedia[] {
  const count = Math.min(
    PLACE_MEDIA_MAX,
    3 + Math.floor(seeded(seed) * 2), // démo : 3–4 items
  )
  const items: PlaceMedia[] = [
    {
      id: `media-${seed}-0`,
      kind: 'image',
      src: cover,
      alt: 'Vue principale',
      // couverture = souvent vue générale, pas de bulle
    },
  ]

  for (let n = 1; n < count; n += 1) {
    const src =
      GALLERY_POOL[Math.floor(seeded(seed + n * 9) * GALLERY_POOL.length)]
    const asVideo = n === count - 1 && seeded(seed + n) > 0.45
    // ~60 % des vues suivantes taguées métier, le reste = commun
    const tagSpecialty =
      !asVideo &&
      specialties.length > 0 &&
      seeded(seed + n * 5) > 0.4
        ? specialties[
            Math.floor(seeded(seed + n * 17) * specialties.length)
          ]
        : undefined
    const commonAlt =
      COMMON_SPACE_ALTS[
        Math.floor(seeded(seed + n * 3) * COMMON_SPACE_ALTS.length)
      ]

    items.push({
      id: `media-${seed}-${n}`,
      kind: asVideo ? 'video' : 'image',
      src,
      specialty: tagSpecialty,
      alt: asVideo
        ? 'Visite vidéo'
        : tagSpecialty
          ? `Espace ${tagSpecialty}`
          : commonAlt,
    })
  }

  return items
}

const CENTERS = [
  'Feel Haussmann',
  'Studio Rivoli Collective',
  'Maison Vertu',
  'Atelier du Parc',
  'Lumina Spaces',
  'Cabines République',
]

/** Hub phare — inspiré Feelgood Haussmann (démo) */
const HAUSSMANN_SPECIALTIES: CategoryLabel[] = [
  'Esthétique',
  'Coiffeur',
  'Onglerie',
  'Fitness',
  'Ostéopathie',
  'Head spa',
  'Formation',
]

const FORMATIONS_POOL: Formation[][] = [
  [
    { title: 'Infinity', status: 'open' },
    { title: 'Endosphères', status: 'open' },
    { title: 'Nouvelle formation', status: 'soon' },
  ],
  [
    { title: 'Protocoles visage avancés', status: 'open' },
    { title: 'Nouvelle formation', status: 'soon' },
  ],
  [
    { title: 'Head spa initiation', status: 'open' },
    { title: 'Business indépendant', status: 'soon' },
  ],
  [
    { title: 'Cut & color studio', status: 'open' },
    { title: 'Nouvelle formation', status: 'soon' },
  ],
]

/** Description générale du hub (commune à toutes les spécialités) */
const DESCS = [
  `Adresse premium au cœur de Paris, pensée pour les indépendants beauté & bien-être. Accès autonome, ambiance soignée et espaces communs pour croiser d’autres pros.

- Wifi fibre & Bluetooth audio
- Accès 7j/7, accueil possible 15 min avant le créneau
- Serviettes, climatisation, casier sécurisé
- Espaces communs pour favoriser les échanges entre pros`,

  `Hub lumineux en ville, conçu pour enchaîner les rendez-vous. Accès flexible, ambiance calme, lounge partagé entre les clients.

- Wifi, parking et accueil sur place
- Café & thé, enceinte Bluetooth, lumière naturelle
- Lounge partagé pour les temps morts entre clients`,

  `Maison confidentielle proche transports et commerces, avec une vraie attention aux détails du quotidien et un lounge ouvert aux indépendants du hub.

- Wifi, casier, douche et produits fournis
- Bluetooth pour playlists personnalisées
- Tablette d’accueil à l’entrée`,

  `Atelier flexible et élégant, réservation simple à l’heure ou au mois. Réseau local d’experts et collaborations croisées entre métiers.

- Wifi, accès autonome et musique d’ambiance
- Lumière réglable, Bluetooth, coin détente
- Salle de formation disponible sur créneaux dédiés`,
]

/** Textes proprio par métier — adaptés à l’espace réservé */
const SPECIALTY_DESC_POOL: Record<CategoryLabel, string[]> = {
  Coiffeur: [
    `Poste coiffure dédié avec bac, miroir XXL et rangements produits. Idéal colorations et coupes : lumière neutre réglable, prise sèche-cheveux et coin d’attente client à proximité.`,
    `Espace coiffure calme, bac confortable et plan de travail large. Parfait pour enchaîner les rendez-vous sans transporter votre matériel lourd.`,
  ],
  Esthétique: [
    `Cabine esthétique isolée, table de soin électrique et point d’eau. Ambiance feutrée, stérilisateur à disposition et rangements pour consommables.`,
    `Cabine soin visage / corps prête à l’emploi : lumière douce, tabouret réglable et linge fourni. Pensée pour les protocoles premium.`,
  ],
  Massage: [
    `Salle massage acoustiquement isolée, table professionnelle et huiles de base fournies. Température maîtrisable, playlist Bluetooth possible.`,
    `Espace massage dimmable, table large et coin détente post-séance. Idéal pour les protocoles longs sans interruption.`,
  ],
  Onglerie: [
    `Poste onglerie avec aspiration, lampe UV/LED et assise client confortable. Plan de travail stable, rangements vernis et accès eau à proximité.`,
    `Espace manucure / pédicure calibré : fauteuil client, table basse réglable et lumière froide pour un rendu couleur fidèle.`,
  ],
  Fitness: [
    `Studio ouvert avec sol adapté, miroirs muraux et rangement matériel. Capacité petite séance ou coaching 1:1 — aération et sonorisation Bluetooth.`,
    `Salle mouvement claire, idéal coaching, stretching ou reformer mobile. Prises murales et espace de circulation généreux.`,
  ],
  Épilation: [
    `Cabine épilation discrète, table haute et point d’eau. Hygiène soignée, linge fourni et rangement produits chauffants.`,
    `Espace épilation prêt à l’emploi : table stable, éclairage ciblé et ventilation discrète pour le confort client.`,
  ],
  Ostéopathie: [
    `Salle consultation / ostéo avec table spécifique et silence relatif. Idéal anamnèse + séance, sans passage dans l’espace.`,
    `Cabinet clair pour ostéo ou thérapies manuelles : table professionnelle, chaise accompagnant et ambiance apaisante.`,
  ],
  'Head spa': [
    `Espace head spa avec bac dédié, fauteuil inclinable et produits rituels. Lumière tamisée et isolation pour une vraie expérience sensorielle.`,
    `Cabine head spa clé en main : bac shampoing premium, tabouret thérapeute et linens fournis pour les protocoles longs.`,
  ],
  Formation: [
    `Salle formation modulable (jusqu’à 8 places), écran / support visuel et tables mobiles. Idéal workshops et démonstrations produit.`,
    `Espace formation avec disposition îlot ou rangée, wifi stable et coin pause. Parfait pour demi-journées pédagogiques.`,
  ],
}

const COORDS: { lat: number; lng: number }[] = [
  { lat: 48.8738, lng: 2.332 }, // Haussmann / Opéra
  { lat: 48.8355, lng: 2.241 },
  { lat: 48.9356, lng: 2.353 },
  { lat: 48.847, lng: 2.438 },
  { lat: 48.8049, lng: 2.1204 },
  { lat: 48.7904, lng: 2.4556 },
  { lat: 48.8606, lng: 2.3622 },
  { lat: 48.892, lng: 2.207 },
  { lat: 48.8638, lng: 2.448 },
  { lat: 48.824, lng: 2.273 },
]

const DAYS: WeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function buildContact(i: number): PlaceContact {
  if (i === 0) {
    const phone = formatFrenchPhone('0142891143')
    return {
      email: 'haussmann@feel.studio',
      phone,
      phoneHref: phoneToTelHref(phone),
      mailHref: 'mailto:haussmann@feel.studio',
    }
  }
  // 10 chiffres : 0X + 8 chiffres dérivés du seed
  const raw = `0${1 + (i % 5)}${String(40 + i).padStart(2, '0')}${String(10 + i).padStart(2, '0')}${String(20 + i).padStart(2, '0')}${String(30 + (i % 50)).padStart(2, '0')}`.slice(0, 10)
  const phone = formatFrenchPhone(raw)
  return {
    email: `resa.${i}@feel.studio`,
    phone,
    phoneHref: phoneToTelHref(phone),
    mailHref: `mailto:resa.${i}@feel.studio`,
  }
}

function buildPricing(seed: number): PricingGrid {
  const hour = 28 + Math.floor(seeded(seed) * 40)
  return normalizePricing({
    hour,
    hours2: Math.round(hour * 1.85),
    hours3: Math.round(hour * 2.6),
    hours4: Math.round(hour * 3.2),
    halfDay: Math.round(hour * 3.5),
    day: Math.round(hour * 5.5),
    week: Math.round(hour * 22),
    month: Math.round(hour * 70),
    quarter: Math.round(hour * 190),
    semester: Math.round(hour * 360),
    year: Math.round(hour * 650),
  })
}

function buildPricingBySpecialty(
  specialties: CategoryLabel[],
  seed: number,
): Partial<Record<CategoryLabel, PricingGrid>> {
  const out: Partial<Record<CategoryLabel, PricingGrid>> = {}
  specialties.forEach((spec, n) => {
    const catIndex = CATEGORIES.findIndex((c) => c.label === spec)
    out[spec] = buildPricing(seed + n * 19 + Math.max(0, catIndex) * 7)
  })
  return out
}

/** Grille affichée pour une spécialité (ou le mini hub si « toutes ») */
export function pricingForSpecialty(
  place: Place,
  specialty: CategoryLabel | 'all',
): PricingGrid {
  if (specialty !== 'all') {
    return normalizePricing(
      place.pricingBySpecialty[specialty] ?? place.pricing,
    )
  }
  return normalizePricing(place.pricing)
}

export function priceFromLabel(
  place: Place,
  specialty: CategoryLabel | 'all',
): string {
  const grid = pricingForSpecialty(place, specialty)
  if (specialty === 'all' && place.specialties.length > 1) {
    return `à partir de ${grid.hour}€ / h`
  }
  return `${grid.hour}€ / h`
}

function buildDescriptionBySpecialty(
  specialties: CategoryLabel[],
  seed: number,
): Partial<Record<CategoryLabel, string>> {
  const out: Partial<Record<CategoryLabel, string>> = {}
  specialties.forEach((spec, n) => {
    const pool = SPECIALTY_DESC_POOL[spec]
    const pick = pool[Math.floor(seeded(seed + n * 13) * pool.length)]
    out[spec] = pick
  })
  return out
}

/** Texte proprio pour l’espace lié à la spécialité (null si « toutes ») */
export function descriptionForSpecialty(
  place: Place,
  specialty: CategoryLabel | 'all',
): string | null {
  if (specialty === 'all') return null
  return place.descriptionBySpecialty[specialty] ?? null
}

function buildSpecialties(
  primary: CategoryLabel,
  seed: number,
  flagship: boolean,
): CategoryLabel[] {
  if (flagship) return [...HAUSSMANN_SPECIALTIES]

  const count = 2 + Math.floor(seeded(seed) * 3) // 2–4
  const pool = CATEGORIES.map((c) => c.label).filter((l) => l !== primary)
  const extras: CategoryLabel[] = []

  for (let n = 0; n < pool.length && extras.length < count - 1; n += 1) {
    const pick = pool[Math.floor(seeded(seed + n * 11) * pool.length)]
    if (!extras.includes(pick)) extras.push(pick)
  }

  return [primary, ...extras]
}

/**
 * Motif hebdo dense (blocs matin/après-midi).
 * `profile` varie volontairement les jours / plages pour différencier
 * les calendriers par spécialité (coiffure ≠ onglerie).
 */
function buildSlots(seed: number, profile = 0): AvailSlot[] {
  const slots: AvailSlot[] = []
  const used = new Set<string>()

  const add = (day: WeekDay, minutes: number) => {
    const key = `${day}-${minutes}`
    if (used.has(key)) return
    used.add(key)
    slots.push({ day, minutes })
  }

  // Un jour « plus fermé » par profil (ex. lundi pour l’un, mardi pour l’autre)
  const quietDay = DAYS[profile % DAYS.length]
  const morningOnly = DAYS[(profile + 3) % DAYS.length]

  DAYS.forEach((day, dIdx) => {
    if (day === quietDay && seeded(seed + profile * 7) > 0.35) return

    const morningStart =
      (day === morningOnly ? 10 : 8) * 60 +
      Math.floor(seeded(seed + dIdx * 3 + profile) * 2) * 30
    const morningEnd = day === quietDay ? 11 * 60 : 13 * 60
    for (let m = morningStart; m < morningEnd; m += 30) add(day, m)

    if (day === morningOnly) return

    const afternoonStart = 14 * 60 + (profile % 2) * 30
    const afternoonEnd = 18 * 60 + ((profile + dIdx) % 3) * 60 // jusqu’à 20h
    for (let m = afternoonStart; m < afternoonEnd; m += 30) {
      if (seeded(seed + dIdx * 11 + m + profile * 5) > 0.1) add(day, m)
    }

    if (seeded(seed + dIdx * 19 + profile) > 0.5) {
      for (let m = 20 * 60; m < 22 * 60; m += 30) add(day, m)
    }
  })

  return slots.sort(
    (a, b) =>
      DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.minutes - b.minutes,
  )
}

function buildSlotsBySpecialty(
  specialties: CategoryLabel[],
  seed: number,
): Partial<Record<CategoryLabel, AvailSlot[]>> {
  const out: Partial<Record<CategoryLabel, AvailSlot[]>> = {}
  specialties.forEach((spec, n) => {
    const catIndex = CATEGORIES.findIndex((c) => c.label === spec)
    out[spec] = buildSlots(seed + n * 23, Math.max(0, catIndex) + n)
  })
  return out
}

/** Calendrier de l’espace choisi (ou agrégé si « toutes ») */
export function slotsForSpecialty(
  place: Place,
  specialty: CategoryLabel | 'all',
): AvailSlot[] {
  if (specialty !== 'all') {
    return place.slotsBySpecialty[specialty] ?? place.slots
  }
  return place.slots
}

function nextSlot(slots: AvailSlot[]): AvailSlot {
  return slots[0] ?? { day: 'monday', minutes: 9 * 60 }
}

export const PLACES: Place[] = SPOTS.slice(0, 10).map((spot, i) => {
  const coord = COORDS[i % COORDS.length]
  const flagship = i === 0
  const specialties = flagship
    ? buildSpecialties(spot.type, i + 17, true)
    : spot.specialties
  const slotsBySpecialty = buildSlotsBySpecialty(specialties, i + 1)
  const slots = buildSlots(i + 1, 0)
  const next = nextSlot(slots)
  const pricingBySpecialty = buildPricingBySpecialty(specialties, i + 3)
  const hourPrices = specialties
    .map((s) => pricingBySpecialty[s]?.hour)
    .filter((h): h is number => typeof h === 'number')
  const minHour =
    hourPrices.length > 0 ? Math.min(...hourPrices) : buildPricing(i + 3).hour
  const pricing =
    Object.values(pricingBySpecialty).find((g) => g.hour === minHour) ??
    buildPricing(i + 3)

  return {
    ...spot,
    name: flagship ? 'Feel Haussmann' : spot.name,
    area: flagship ? 'Paris 8e · 75008' : spot.area,
    center: CENTERS[i % CENTERS.length],
    address: flagship
      ? '135, Boulevard Haussmann, Paris 75008'
      : `${12 + i} rue des Ateliers, ${spot.area.split('·')[1]?.trim() ?? '75000'}`,
    contact: buildContact(i),
    media: buildMedia(spot.image, i + 5, specialties),
    specialties,
    formations: FORMATIONS_POOL[i % FORMATIONS_POOL.length],
    pricing,
    pricingBySpecialty,
    priceFrom:
      specialties.length > 1
        ? `à partir de ${minHour}€ / h`
        : `${minHour}€ / h`,
    description: DESCS[i % DESCS.length],
    descriptionBySpecialty: buildDescriptionBySpecialty(specialties, i + 41),
    lat: coord.lat + (seeded(i + 20) - 0.5) * 0.01,
    lng: coord.lng + (seeded(i + 30) - 0.5) * 0.012,
    slots,
    slotsBySpecialty,
    availability: formatNextSlot(next),
  }
})
