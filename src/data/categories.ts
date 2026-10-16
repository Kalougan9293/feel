/**
 * Teintes métier — une famille de teinte par métier,
 * assez saturées pour se distinguer (agenda, chips, pastilles).
 */
export const CATEGORIES = [
  { label: 'Coiffeur', color: '#E07080' }, // rose
  { label: 'Esthétique', color: '#7A68C9' }, // violet
  { label: 'Massage', color: '#E09050' }, // orange
  { label: 'Onglerie', color: '#D4AE2A' }, // or
  { label: 'Fitness', color: '#3D8FD9' }, // bleu
  { label: 'Épilation', color: '#C44890' }, // magenta
  { label: 'Ostéopathie', color: '#2A9B8C' }, // teal
  { label: 'Head spa', color: '#6BBF7A' }, // vert
  { label: 'Formation', color: '#A08060' }, // brun
] as const

export type CategoryLabel = (typeof CATEGORIES)[number]['label']

export function colorOf(label: CategoryLabel | null): string {
  if (!label) return '#9a7b55'
  return CATEGORIES.find((c) => c.label === label)?.color ?? '#9a7b55'
}
