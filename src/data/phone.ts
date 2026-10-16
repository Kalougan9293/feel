/** Format national FR : 0X XX XX XX XX (10 chiffres) */

export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('0033')) d = d.slice(4)
  else if (d.startsWith('33') && d.length >= 11) d = d.slice(2)
  if (d.length === 9 && !d.startsWith('0')) d = `0${d}`
  return d.slice(0, 10)
}

/** Affichage harmonisé : « 01 42 89 11 43 » */
export function formatFrenchPhone(raw: string): string {
  const d = phoneDigits(raw)
  if (!d) return ''
  const parts: string[] = []
  for (let i = 0; i < d.length; i += 2) {
    parts.push(d.slice(i, i + 2))
  }
  return parts.join(' ')
}

export function phoneToTelHref(raw: string): string {
  const d = phoneDigits(raw)
  if (!d) return ''
  if (d.length === 10 && d.startsWith('0')) {
    return `tel:+33${d.slice(1)}`
  }
  return `tel:${d}`
}

export function isValidFrenchPhone(raw: string): boolean {
  return phoneDigits(raw).length === 10
}
