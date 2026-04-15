import { computeBaseLevel } from '../../lib/gameConstants.js'
import { BASE_TIERS } from './constants.js'

export function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export function fmtHours(h) {
  if (h <= 0) return ''
  const totalMins = Math.ceil(h * 60)
  const hh = Math.floor(totalMins / 60)
  const mm = totalMins % 60
  if (hh > 0 && mm > 0) return `${hh}h ${mm}m`
  if (hh > 0) return `${hh}h`
  return `${mm}m`
}

export function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

export function fmtCountdown(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return '¡Listo!'
  const totalSecs = Math.ceil(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function baseLevelFromMap(byType, trainingRooms = []) {
  return computeBaseLevel(Object.values(byType), trainingRooms)
}

export function getBaseTier(level) {
  let tier = BASE_TIERS[0]
  for (const t of BASE_TIERS) { if (level >= t.minLevel) tier = t }
  return tier
}
