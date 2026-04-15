/**
 * Sistema de habilidades de combate por clase.
 *
 * Simétrico: tanto héroes como enemigos usan la misma lógica.
 * Los arquetipos de enemigos se mapean a clases de héroe para que
 * el sistema funcione idéntico en PvE y futuro PvP.
 *
 * Cada clase define:
 *   - passive: efecto que se evalúa cada ronda (dodge, reducción, etc.)
 *   - ability: habilidad activa con cooldown (cada N rondas)
 *   - stanceLabel: texto narrativo según rango de HP
 *
 * Compartido entre frontend (UI replay) y backend (simulación).
 */

// ── Mapeo arquetipo → clase ─────────────────────────────────────────────────
export const ARCHETYPE_TO_CLASS = {
  berserker: 'domador',
  tank:      'caudillo',
  assassin:  'sombra',
  mage:      'arcanista',
}

export function resolveClass(heroClassOrArchetype) {
  return ARCHETYPE_TO_CLASS[heroClassOrArchetype] ?? heroClassOrArchetype ?? null
}

// ── Definiciones de clase ───────────────────────────────────────────────────

export const CLASS_ABILITIES = {
  caudillo: {
    passive: {
      key:         'liderazgo',
      label:       'Liderazgo',
      icon:        '🛡️',
      description: 'Reduce un 12% el daño recibido.',
      /** @returns {{ dmgTakenMult: number }} */
      effect:      () => ({ dmgTakenMult: 0.88 }),
    },
    ability: {
      key:      'muro',
      label:    'Muro Inquebrantable',
      icon:     '🏰',
      description: 'Reduce el daño recibido un 50% durante esta ronda.',
      cooldown: 4,
      /** @returns {{ shieldMult: number, duration: number }} */
      effect:   () => ({ shieldMult: 0.50, duration: 1 }),
    },
  },

  arcanista: {
    passive: {
      key:         'pulso_arcano',
      label:       'Pulso Arcano',
      icon:        '✨',
      description: 'Cada 3 rondas lanza un pulso de daño mágico extra.',
      period:      3,
      /** @param {number} intel */
      effect:      (intel) => ({ bonusDmg: Math.floor((intel ?? 0) * 0.40) }),
    },
    ability: {
      key:      'descarga',
      label:    'Descarga Arcana',
      icon:     '⚡',
      description: 'Golpe mágico devastador que ignora toda la defensa.',
      cooldown: 4,
      /** @param {number} intel */
      effect:   (intel) => ({ pureDmg: Math.floor((intel ?? 0) * 0.80) }),
    },
  },

  sombra: {
    passive: {
      key:         'evasion',
      label:       'Evasión',
      icon:        '💨',
      description: '20% de probabilidad de esquivar ataques.',
      dodgeChance: 0.20,
      effect:      () => ({ dodgeChance: 0.20 }),
    },
    ability: {
      key:      'paso_sombra',
      label:    'Paso de Sombra',
      icon:     '🌑',
      description: 'Esquiva el siguiente ataque con certeza.',
      cooldown: 4,
      effect:   () => ({ guaranteedDodge: true, duration: 1 }),
    },
  },

  domador: {
    passive: {
      key:         'primer_golpe',
      label:       'Primer Golpe',
      icon:        '🎯',
      description: 'El primer ataque siempre es crítico.',
      effect:      () => ({ firstStrikeCrit: true }),
    },
    ability: {
      key:      'furia_salvaje',
      label:    'Furia Salvaje',
      icon:     '🔥',
      description: 'ATK ×1.8 esta ronda, pero recibes ×1.3 de daño.',
      cooldown: 4,
      effect:   () => ({ atkMult: 1.8, dmgTakenMult: 1.3, duration: 1 }),
    },
  },

  universal: {
    passive: {
      key:         'versatilidad',
      label:       'Versatilidad',
      icon:        '⚖️',
      description: 'Reduce un 8% el daño recibido.',
      effect:      () => ({ dmgTakenMult: 0.92 }),
    },
    ability: {
      key:      'golpe_maestro',
      label:    'Golpe Maestro',
      icon:     '✦',
      description: 'ATK ×1.4 esta ronda.',
      cooldown: 4,
      effect:   () => ({ atkMult: 1.4, duration: 1 }),
    },
  },
}

// ── Stances (posturas reactivas al HP) ──────────────────────────────────────

/**
 * Devuelve la postura actual y sus modificadores según el % de HP.
 * @param {number} currentHp
 * @param {number} maxHp
 */
export function getStance(currentHp, maxHp) {
  const pct = maxHp > 0 ? currentHp / maxHp : 0
  if (pct > 0.60) {
    return { key: 'aggressive', label: 'Agresivo', dmgMult: 1.10, defMult: 1.00 }
  }
  if (pct > 0.30) {
    return { key: 'balanced', label: 'Equilibrado', dmgMult: 1.00, defMult: 1.00 }
  }
  return { key: 'desperate', label: 'Desesperado', dmgMult: 1.25, defMult: 0.85 }
}

// ── Helpers para el replay ──────────────────────────────────────────────────

export function getClassAbilities(classKey) {
  return CLASS_ABILITIES[classKey] ?? null
}

export function getAbilityInfo(classKey, abilityKey) {
  const cls = CLASS_ABILITIES[classKey]
  if (!cls) return null
  if (cls.passive.key === abilityKey) return cls.passive
  if (cls.ability.key === abilityKey) return cls.ability
  return null
}
