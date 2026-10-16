import { CATEGORIES, type CategoryLabel } from './categories'

/**
 * Landing rule: chaque studio n’affiche que son *prochain* créneau /
 * espace disponible (pas tout le calendrier). Au branchement API,
 * `availability` = prochain slot uniquement.
 */
export type Spot = {
  id: string
  name: string
  area: string
  /** Spécialité principale (affichage / couleur) */
  type: CategoryLabel
  /** Toutes les activités du lieu (multi-spé possible) */
  specialties: CategoryLabel[]
  /** Prochain créneau / espace dispo uniquement */
  availability: string
  image: string
  x: number
  y: number
}

const MIN_PINS_PER_CATEGORY = 3

const NAMES_BY_TYPE: Record<CategoryLabel, string[]> = {
  Coiffeur: ['Cabine Opéra', 'Atelier Coupe', 'Studio Rivoli', 'Loft Brush'],
  Esthétique: ['Maison Soft', 'Cabine Éclat', 'Studio Nuage', 'Atelier Peau'],
  Massage: ['Loft Horizon', 'Cabine Soft', 'Espace Zen', 'Studio Pulse'],
  Onglerie: ['Atelier Nail', 'Cabine Dorée', 'Studio Vernis', 'Espace Miroir'],
  Fitness: ['Loft Quai', 'Studio Move', 'Espace Bois', 'Atelier Force'],
  Épilation: ['Cabine Lac', 'Atelier Vert', 'Studio Clair', 'Espace Douceur'],
  Ostéopathie: [
    'Cabinet Haussmann',
    'Studio Ostéo Marais',
    'Espace Align',
    'Atelier Posture',
  ],
  'Head spa': [
    'Head Spa Seine',
    'Cabine Ritual',
    'Studio Scalp',
    'Espace Cocoon',
  ],
  Formation: [
    'Salle Infinity',
    'Atelier Endosphères',
    'Studio Academy',
    'Espace Masterclass',
  ],
}

const AREAS = [
  'Paris 9e · 75009',
  'Boulogne · 92100',
  'Saint-Denis · 93200',
  'Vincennes · 94300',
  'Versailles · 78000',
  'Créteil · 94000',
  'Paris 3e · 75003',
  'Nanterre · 92000',
  'Montreuil · 93100',
  'Issy · 92130',
  'La Défense · 92400',
  'Paris 11e · 75011',
  'Saint-Cloud · 92210',
  'Ivry · 94200',
  'Asnières · 92600',
  'Paris 16e · 75016',
  'Neuilly · 92200',
  'Pantin · 93500',
  'Paris 8e · 75008',
  'Levallois · 92300',
  'Paris 17e · 75017',
  'Clichy · 92110',
]

const AVAIL = [
  'Prochain créneau · demain 9h',
  'Prochain créneau · jeudi 14h',
  'Prochain créneau · aujourd’hui 18h',
  'Prochain créneau · samedi 10h',
  'Prochain créneau · lundi 8h30',
  'Prochain créneau · vendredi 16h',
  'Prochain créneau · ce soir 19h',
  'Prochain créneau · demain 11h',
  'Prochain créneau · mercredi 15h',
  'Prochain créneau · mardi 10h30',
]

const IMAGES = [
  '/inspiration-cabine.jpg',
  '/hero-salon.jpg',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=400&q=80',
]

const ALL_TYPES: CategoryLabel[] = CATEGORIES.map((c) => c.label)

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function pickName(type: CategoryLabel, i: number) {
  const list = NAMES_BY_TYPE[type]
  return list[i % list.length]
}

/** 1 à 3 activités, en partant de la spé principale */
function buildSpecialties(
  primary: CategoryLabel,
  seed: number,
): CategoryLabel[] {
  const extraCount = Math.floor(seeded(seed) * 3) // 0, 1 ou 2 extras → total 1–3
  const pool = ALL_TYPES.filter((t) => t !== primary)
  const extras: CategoryLabel[] = []

  for (let n = 0; n < pool.length && extras.length < extraCount; n += 1) {
    const pick = pool[Math.floor(seeded(seed + n * 13) * pool.length)]
    if (!extras.includes(pick)) extras.push(pick)
  }

  return [primary, ...extras]
}

/** Garantit ≥ min pins qui proposent chaque catégorie (multi-spé inclus) */
function ensureMinPinsPerCategory(spots: Spot[], min: number) {
  for (const cat of ALL_TYPES) {
    let holders = spots.filter((s) => s.specialties.includes(cat))

    while (holders.length < min) {
      const candidate = [...spots]
        .filter((s) => !s.specialties.includes(cat))
        .sort((a, b) => a.specialties.length - b.specialties.length)[0]

      if (!candidate) break

      candidate.specialties = [...candidate.specialties, cat]
      holders = spots.filter((s) => s.specialties.includes(cat))
    }
  }
}

function positionOnRing(idx: number, total: number, seed: number) {
  const angle = (idx / total) * Math.PI * 2 + seeded(seed) * 0.35
  const radius = 16 + seeded(seed + 3) * 12
  const x = 50 + Math.cos(angle) * radius + (seeded(seed + 8) - 0.5) * 5
  const y =
    48 + Math.sin(angle) * (radius * 0.7) + (seeded(seed + 12) - 0.5) * 4
  return {
    x: Math.min(78, Math.max(18, x)),
    y: Math.min(72, Math.max(24, y)),
  }
}

function positionOnGrid(i: number, col: number, row: number, cols: number, rows: number) {
  const jx = (seeded(i + 1) - 0.5) * 8
  const jy = (seeded(i + 40) - 0.5) * 7
  const x = 20 + (col + 0.5) * (58 / cols) + jx
  const y = 26 + (row + 0.5) * (44 / rows) + jy
  return {
    x: Math.min(78, Math.max(18, x)),
    y: Math.min(72, Math.max(24, y)),
  }
}

/**
 * Pins multi-activités : certains hubs cumulent plusieurs spés.
 * Chaque catégorie apparaît sur au moins {@link MIN_PINS_PER_CATEGORY} pins.
 */
function buildSpots(): Spot[] {
  const spots: Spot[] = []
  let i = 0

  // 1) 1 pin « ancre » par catégorie (réparti en anneau)
  ALL_TYPES.forEach((type, idx) => {
    const { x, y } = positionOnRing(idx, ALL_TYPES.length, idx + 2)
    const specialties = buildSpecialties(type, idx + 17)

    spots.push({
      id: `spot-${i}`,
      name: pickName(type, idx),
      area: AREAS[i % AREAS.length],
      type,
      specialties,
      availability: AVAIL[i % AVAIL.length],
      image: IMAGES[i % IMAGES.length],
      x,
      y,
    })
    i += 1
  })

  // 2) Vague grille — primaires décalées + multi-spé
  const cols = 4
  const rows = 3
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const type = ALL_TYPES[(i * 5 + 3) % ALL_TYPES.length]
      const { x, y } = positionOnGrid(i, col, row, cols, rows)
      const specialties = buildSpecialties(type, i + 41)

      spots.push({
        id: `spot-${i}`,
        name: pickName(type, i + 2),
        area: AREAS[i % AREAS.length],
        type,
        specialties,
        availability: AVAIL[i % AVAIL.length],
        image: IMAGES[i % IMAGES.length],
        x,
        y,
      })
      i += 1
    }
  }

  // 3) Hubs centraux multi-activités (nouveaux métiers mis en avant)
  const hubs: Omit<Spot, 'id'>[] = [
    {
      name: 'Feel Haussmann Hub',
      area: 'Paris 8e · 75008',
      type: 'Esthétique',
      specialties: [
        'Esthétique',
        'Coiffeur',
        'Onglerie',
        'Head spa',
        'Formation',
      ],
      availability: 'Prochain créneau · demain 9h',
      image: IMAGES[0],
      x: 49,
      y: 46,
    },
    {
      name: 'Studio Ostéo & Spa',
      area: 'Paris 3e · 75003',
      type: 'Ostéopathie',
      specialties: ['Ostéopathie', 'Head spa', 'Massage'],
      availability: 'Prochain créneau · samedi 11h',
      image: IMAGES[2],
      x: 53,
      y: 44,
    },
    {
      name: 'Academy Rivoli',
      area: 'Paris 1er · 75001',
      type: 'Formation',
      specialties: ['Formation', 'Esthétique', 'Fitness'],
      availability: 'Prochain créneau · mercredi 14h',
      image: IMAGES[1],
      x: 46,
      y: 49,
    },
  ]

  hubs.forEach((hub) => {
    spots.push({ ...hub, id: `spot-${i}` })
    i += 1
  })

  ensureMinPinsPerCategory(spots, MIN_PINS_PER_CATEGORY)

  return spots
}

export const SPOTS = buildSpots()
