import { formatFrenchPhone } from './phone'

/** Contact plateforme (ajout de métiers, support propriétaire). */
export const SUPPORT_EMAIL = 'contact@feel.studio'
export const SUPPORT_PHONE_RAW = '0662288656'
export const SUPPORT_PHONE_DISPLAY = formatFrenchPhone(SUPPORT_PHONE_RAW)
