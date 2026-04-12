import { INVENTORY_BASE_LIMIT, BAG_SLOTS_PER_UPGRADE } from './_constants.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Returns true if s is a well-formed UUID v4. */
export function isUUID(s) {
  return typeof s === 'string' && UUID_RE.test(s)
}

/**
 * Elapsed time in HOURS, capped at 24 h to prevent absurd resource accumulation.
 * Use this for resource interpolation — rates are stored as units/hour.
 */
export function safeHours(lastCollectedAt, nowMs = Date.now()) {
  const elapsed = (nowMs - new Date(lastCollectedAt).getTime()) / 3_600_000
  return Math.max(0, Math.min(elapsed, 24))
}

/** @deprecated Use safeHours. Kept only for callers not yet migrated. */
export function safeMinutes(lastCollectedAt, nowMs = Date.now()) {
  return safeHours(lastCollectedAt, nowMs) * 60
}

/**
 * Effective bag limit = base + extras from upgrades.
 * `bagExtraSlots` comes from resources.bag_extra_slots.
 */
export function effectiveBagLimit(bagExtraSlots = 0) {
  return INVENTORY_BASE_LIMIT + bagExtraSlots * BAG_SLOTS_PER_UPGRADE
}

/**
 * Snapshot de recursos para transacciones. Sin interpolación pasiva —
 * la producción idle se acumula en edificios y se recolecta manualmente.
 * CAS: incluir `prevCollectedAt` en .eq() para evitar sobreescrituras concurrentes.
 */
export function snapshotResources(resources, nowMs = Date.now()) {
  return {
    gold:        Math.floor(resources.gold),
    iron:        Math.floor(resources.iron),
    wood:        Math.floor(resources.wood),
    mana:        Math.floor(resources.mana),
    fragments:   resources.fragments   ?? 0,
    essence:     resources.essence     ?? 0,
    coal:        resources.coal        ?? 0,
    fiber:       resources.fiber       ?? 0,
    arcane_dust: resources.arcane_dust ?? 0,
    herbs:       resources.herbs       ?? 0,
    flowers:     resources.flowers     ?? 0,
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
    prevCollectedAt: resources.last_collected_at,
  }
}
