/**
 * Catálogo compartido de modificadores semanales de mazmorras.
 * Importado tanto desde el backend (api/_weeklyModifier.js) como desde el
 * frontend (badge en DungeonCard) para evitar duplicar metadatos.
 */

export const WEEKLY_MODIFIERS = {
  bountiful_loot: {
    name:        'Botín Abundante',
    description: 'Doble probabilidad de drop de objetos',
    color:       '#d97706',  // ámbar
    dropMult:    2.0,
  },
  treasure_hunt: {
    name:        'Caza del Tesoro',
    description: '+150% de oro',
    color:       '#facc15',  // dorado
    goldMult:    2.5,
  },
  swift_travel: {
    name:        'Viaje Veloz',
    description: '-40% de duración',
    color:       '#06b6d4',  // cian
    durationMult: 0.6,
  },
  iron_enemies: {
    name:        'Enemigos Férreos',
    description: '+100% XP pero +30% daño recibido',
    color:       '#dc2626',  // rojo
    xpMult:      2.0,
    hpDamageMult: 1.3,
  },
  rich_materials: {
    name:        'Vena Rica',
    description: '+200% fragmentos y esencia',
    color:       '#7c3aed',  // violeta
    materialMult: 3.0,
  },
}

/**
 * Devuelve el lunes 00:00 UTC de la semana actual como string YYYY-MM-DD.
 * Usado para claves de fila en weekly_dungeon_modifier.
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const dayOfWeek = d.getUTCDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setUTCDate(d.getUTCDate() - daysFromMonday)
  return d.toISOString().slice(0, 10)
}

/**
 * Devuelve los multiplicadores activos para una mazmorra concreta.
 * Si la mazmorra no es la del desafío, devuelve multiplicadores neutros.
 */
export function getModifierForDungeon(activeModifier, dungeonId) {
  if (!activeModifier || activeModifier.dungeon_id !== dungeonId) {
    return { goldMult: 1, xpMult: 1, durationMult: 1, dropMult: 1, materialMult: 1, hpDamageMult: 1 }
  }
  const m = activeModifier.modifier ?? {}
  return {
    goldMult:     m.goldMult     ?? 1,
    xpMult:       m.xpMult       ?? 1,
    durationMult: m.durationMult ?? 1,
    dropMult:     m.dropMult     ?? 1,
    materialMult: m.materialMult ?? 1,
    hpDamageMult: m.hpDamageMult ?? 1,
  }
}
