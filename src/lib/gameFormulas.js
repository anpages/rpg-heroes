/**
 * Fórmulas de juego compartidas entre frontend y backend.
 * ÚNICA fuente de verdad — importar desde aquí, nunca duplicar.
 *
 * Backend: import desde '../../src/lib/gameFormulas.js'
 * Frontend: import desde '../lib/gameFormulas.js'
 */
import { computeClassLevelBonuses } from './gameConstants.js'

/**
 * Calcula las stats efectivas del héroe en el frontend, con la misma lógica exacta
 * que api/_stats.js. Función pura — sin llamadas async ni Supabase.
 *
 * @param {object} hero            — fila de heroes (attack, defense, strength, agility, intelligence, max_hp)
 * @param {Array}  items           — inventory_items con item_catalog, current_durability, equipped_slot, enchantments
 * @param {Array}  tactics         — hero_tactics con tactic_catalog, level, slot_index
 * @param {object} researchBonuses — resultado de computeResearchBonuses() de gameConstants.js
 * @returns {{ attack, defense, strength, agility, intelligence, max_hp, totalWeight, weightPenalty }}
 */
export function computeEffectiveStats(hero, items = [], tactics = [], researchBonuses = {}) {
  if (!hero) return null

  const stats = {
    attack:       hero.attack       ?? 0,
    defense:      hero.defense      ?? 0,
    strength:     hero.strength     ?? 0,
    agility:      hero.agility      ?? 0,
    intelligence: hero.intelligence ?? 0,
    max_hp:       hero.max_hp       ?? 0,
  }

  // Bonos de nivel de clase (encima del nivel 1)
  const classBonuses = computeClassLevelBonuses(hero.class, hero.class_level ?? 1)
  for (const [stat, val] of Object.entries(classBonuses)) {
    if (stat in stats) stats[stat] += val
  }

  const STAT_MAP = { attack: 'attack', defense: 'defense', max_hp: 'max_hp', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }

  let totalWeight = 0

  for (const item of items) {
    if (!item.equipped_slot || item.current_durability <= 0) continue
    const c = item.item_catalog
    totalWeight += c.weight ?? 0
    const durPct = c.max_durability > 0 ? item.current_durability / c.max_durability : 1

    stats.attack       += Math.round((c.attack_bonus       ?? 0) * durPct)
    stats.defense      += Math.round((c.defense_bonus      ?? 0) * durPct)
    stats.max_hp       += Math.round((c.hp_bonus           ?? 0) * durPct)
    stats.strength     += Math.round((c.strength_bonus     ?? 0) * durPct)
    stats.agility      += Math.round((c.agility_bonus      ?? 0) * durPct)
    stats.intelligence += Math.round((c.intelligence_bonus ?? 0) * durPct)

    const enc = item.enchantments ?? {}
    if (enc.attack_bonus)       stats.attack       += Math.round(enc.attack_bonus       * durPct)
    if (enc.defense_bonus)      stats.defense      += Math.round(enc.defense_bonus      * durPct)
    if (enc.hp_bonus)           stats.max_hp       += Math.round(enc.hp_bonus           * durPct)
    if (enc.strength_bonus)     stats.strength     += Math.round(enc.strength_bonus     * durPct)
    if (enc.agility_bonus)      stats.agility      += Math.round(enc.agility_bonus      * durPct)
    if (enc.intelligence_bonus) stats.intelligence += Math.round(enc.intelligence_bonus * durPct)
  }

  // Bonos de tácticas equipadas (slot_index != null), escalados por nivel
  const equippedTactics = tactics.filter(t => t.slot_index != null)
  for (const t of equippedTactics) {
    const cat = t.tactic_catalog
    for (const { stat, value } of cat?.stat_bonuses ?? []) {
      if (stat in STAT_MAP) {
        stats[STAT_MAP[stat]] += Math.round((value ?? 0) * (t.level ?? 1))
      }
    }
  }

  // Bonos de investigación
  const rb = researchBonuses ?? {}
  if (rb.attack_pct > 0)       stats.attack       = Math.round(stats.attack       * (1 + rb.attack_pct))
  if (rb.defense_pct > 0)      stats.defense      = Math.round(stats.defense      * (1 + rb.defense_pct))
  if (rb.intelligence_pct > 0) stats.intelligence = Math.round(stats.intelligence * (1 + rb.intelligence_pct))

  // Amplificación de tácticas por investigación
  if (rb.tactic_bonus_pct > 0) {
    for (const t of equippedTactics) {
      const cat = t.tactic_catalog
      for (const { stat, value } of cat?.stat_bonuses ?? []) {
        if (stat in STAT_MAP) {
          stats[STAT_MAP[stat]] += Math.round((value ?? 0) * (t.level ?? 1) * rb.tactic_bonus_pct)
        }
      }
    }
  }

  // Penalización de agilidad por peso
  const weightPenalty = Math.floor(totalWeight / 4)
  stats.agility = Math.max(0, stats.agility - weightPenalty)

  return { ...stats, totalWeight, weightPenalty }
}

/**
 * Coste de HP de una expedición.
 * - Base: 20% del max_hp por hora (proporcional a la duración).
 * - Peligro escala el coste (hasta +45% en dificultad 9).
 * - Fuerza lo reduce (hasta −40% con fuerza 100).
 */
export function expeditionHpCost(maxHp, durationMinutes, difficulty = 0, strength = 0) {
  const base             = (maxHp ?? 100) * durationMinutes / 300
  const dangerMult       = 1 + (difficulty ?? 0) * 0.05
  const strengthReduct   = Math.max(0.6, 1 - (strength ?? 0) * 0.004)
  return Math.max(1, Math.floor(base * dangerMult * strengthReduct))
}

/**
 * Reducción de duración por agilidad (hasta −25%).
 */
export function agilityDurationFactor(agility) {
  return 1 - Math.min(0.25, (agility ?? 0) * 0.003)
}

/**
 * Multiplicador de oro y XP por ataque (hasta +100%).
 * Usado en expedition-collect y en el display de DungeonCard.
 */
export function attackMultiplier(attack) {
  return 1 + Math.min(1.0, (attack ?? 0) * 0.008)
}

/**
 * Stats del enemigo de un piso de la torre.
 */
export function floorEnemyStats(floor) {
  // Pisos 1-25: crecimiento lineal normal.
  // Pisos 26+: crecimiento a mitad de ritmo para que el late-game sea alcanzable.
  const cap = 25
  const slow = Math.max(0, floor - cap)
  const fast = Math.min(floor, cap)
  return {
    max_hp:      100 + fast * 22 + slow * 12,
    attack:       8  + fast * 3  + slow * 2,
    defense:      4  + fast * 2  + slow * 1,
    strength:     3  + fast * 1  + Math.floor(slow * 0.5),
    agility:      3  + Math.floor(fast * 0.6) + Math.floor(slow * 0.3),
    intelligence: 2  + Math.floor(fast * 0.5) + Math.floor(slow * 0.25),
  }
}

/**
 * XP necesaria para subir del nivel `level` al `level + 1`.
 * Fuente de verdad única — usada en frontend y en todos los endpoints de API.
 */
export function xpRequiredForLevel(level) {
  return level * level * 100
}

/**
 * Recompensas por superar un piso de la torre.
 * Las recompensas dejan de escalar a partir del piso 100 (soft-cap).
 */
export function floorRewards(floor) {
  const milestone = floor % 5 === 0
  const effectiveFloor = Math.min(floor, 100)
  return {
    gold:       Math.round((30 + effectiveFloor * 15) * (milestone ? 2 : 1)),
    experience: Math.round((20 + effectiveFloor * 10) * (milestone ? 2 : 1)),
    milestone,
  }
}

/**
 * Nombre del enemigo para un piso de la torre.
 * Determinista: mismo piso → mismo nombre.
 */
const ENEMY_POOLS = [
  { max:  5, names: [
    // Espíritus y criaturas menores griegas
    'Keres', 'Stryx', 'Lamia', 'Harpia', 'Empusa', 'Mormo', 'Aello',
    'Celaeno', 'Ocípete', 'Stheno', 'Euryale', 'Draco', 'Erinys',
    // Criaturas menores nórdicas
    'Draugr', 'Huldra', 'Nökken', 'Rusalka', 'Strigoi', 'Vetala',
    // Demonios menores mesopotámicos
    'Gallu', 'Utukku', 'Rabisu', 'Namtar', 'Asag', 'Lilu',
    // Espíritus eslavo/asiáticos
    'Domovoi', 'Leshy', 'Kikimora', 'Tengu', 'Oni', 'Gashadokuro',
  ]},
  { max: 10, names: [
    // Monstruos griegos
    'Argos', 'Ladon', 'Equidna', 'Caribdis', 'Escila', 'Gerión', 'Esfinge',
    'Ortro', 'Ceto', 'Forcis', 'Kampe', 'Briareo', 'Cottus', 'Giges', 'Lestrigón',
    // Criaturas nórdicas
    'Utgard', 'Hrungnir', 'Thiazi', 'Thrym', 'Hymir', 'Skrýmir',
    // Criaturas egipcias
    'Ammit', 'Sobek', 'Anubis', 'Sekhmet', 'Apep',
    // Criaturas mesopotámicas
    'Humbaba', 'Pazuzu', 'Lamashtu', 'Anzu', 'Kingu',
    // Criaturas asiáticas
    'Raijin', 'Fujin', 'Yamata', 'Orochi', 'Rahovart', 'Taotie',
  ]},
  { max: 20, names: [
    // Monstruos épicos griegos
    'Medusa', 'Minotauro', 'Cerbero', 'Hidra', 'Polifemo', 'Quimera', 'Pitón',
    // Titanes griegos
    'Hiperión', 'Coeo', 'Crio', 'Epimeteo', 'Atlas', 'Prometeo',
    // Nórdicos
    'Fenrir', 'Jörmungandr', 'Garm', 'Nidhogg', 'Fafnir', 'Surtr', 'Hati', 'Sköll',
    // Celtas
    'Balor', 'Tethra', 'Indech', 'Elatha', 'Sreng', 'Cailleach',
    // Hindúes
    'Vritra', 'Ravana', 'Kali', 'Mahisha', 'Hiranyakashipu', 'Namuci',
    // Aztecas/mayas
    'Cipactli', 'Xolotl', 'Camazotz', 'Vucub', 'Zipacna',
  ]},
  { max: 50, names: [
    // Dioses oscuros griegos/romanos
    'Cronos', 'Tifón', 'Ares', 'Hades', 'Hécate', 'Érebo', 'Nix',
    // Dioses oscuros egipcios
    'Set', 'Osiris', 'Sobek', 'Sekhmet', 'Nehebkau', 'Apophis',
    // Dioses nórdicos oscuros
    'Loki', 'Hel', 'Ymir', 'Aegir', 'Rán',
    // Dioses cananeos/semitas
    'Moloch', 'Baal', 'Dagon', 'Mot', 'Yam', 'Lotan',
    // Dioses mesopotámicos oscuros
    'Nergal', 'Enlil', 'Ereshkigal', 'Tiamat', 'Nammu',
    // Persas
    'Angra', 'Ahriman', 'Aeshma', 'Druj', 'Saurva',
    // Celtas
    'Morrigan', 'Crom', 'Cernunnos', 'Arawn', 'Cromm',
    // Hindúes/budistas
    'Mara', 'Yama', 'Varuna', 'Nirrti', 'Kaliya',
  ]},
  { max: Infinity, names: [
    // Ars Goetia — los 72 demonios
    'Bael', 'Agares', 'Vassago', 'Marbas', 'Valefor', 'Amon', 'Barbatos',
    'Paimon', 'Buer', 'Gusion', 'Sitri', 'Beleth', 'Leraje', 'Eligos',
    'Zepar', 'Botis', 'Bathin', 'Sallos', 'Purson', 'Morax', 'Ipos',
    'Naberius', 'Glasya', 'Berith', 'Astaroth', 'Foras', 'Asmodeo',
    'Gaap', 'Furfur', 'Marchosias', 'Stolas', 'Phenex', 'Malphas',
    'Focalor', 'Vepar', 'Sabnock', 'Shax', 'Bifrons', 'Haagenti',
    'Furcas', 'Balam', 'Alloces', 'Caim', 'Murmur', 'Orobas',
    'Ose', 'Andromalius', 'Vapula', 'Zagan', 'Andras', 'Flauros',
    'Amdusias', 'Decarabia', 'Dantalion',
    // Entidades del fin
    'Abadón', 'Azazel', 'Samael', 'Leviatán', 'Behemot', 'Belial',
    'Asmodeo', 'Beelzebub', 'Mammon', 'Belphegor', 'Ahriman', 'Ragnarök',
  ]},
]

export function floorEnemyName(floor) {
  const pool = ENEMY_POOLS.find(p => floor <= p.max)?.names ?? ENEMY_POOLS[ENEMY_POOLS.length - 1].names
  return pool[floor % pool.length]
}

/* ─── Arquetipos de enemigos ────────────────────────────────────────────────── */

/**
 * Arquetipos que dan personalidad a los enemigos PvE.
 * Cada arquetipo modifica las stats base manteniéndose dentro del presupuesto
 * del piso/nivel — se intercambia poder de un stat a otro.
 *
 * Berserker → glass cannon (mucho daño, frágil)
 * Tanque    → muralla (mucho HP/def, golpea poco)
 * Asesino   → veloz y crítico (muchos críticos, frágil)
 * Místico   → daño mágico que ignora defensa
 */
export const ENEMY_ARCHETYPES = {
  berserker: {
    label: 'Berserker',
    color: '#dc2626',
    description: 'Ataques brutales pero defensa frágil',
    apply: (s) => ({
      ...s,
      max_hp:   Math.max(1, Math.round(s.max_hp  * 0.95)),
      attack:   Math.max(1, Math.round(s.attack  * 1.40)),
      defense:  Math.max(1, Math.round(s.defense * 0.70)),
      strength: Math.max(1, Math.round(s.strength * 1.25)),
    }),
  },
  tank: {
    label: 'Tanque',
    color: '#0369a1',
    description: 'Muralla con mucho HP y defensa, pero lento',
    apply: (s) => ({
      ...s,
      max_hp:  Math.max(1, Math.round(s.max_hp  * 1.40)),
      defense: Math.max(1, Math.round(s.defense * 1.50)),
      attack:  Math.max(1, Math.round(s.attack  * 0.80)),
      agility: Math.max(1, Math.round(s.agility * 0.85)),
    }),
  },
  assassin: {
    label: 'Asesino',
    color: '#7c3aed',
    description: 'Veloz y letal, muchos críticos pero frágil',
    apply: (s) => ({
      ...s,
      max_hp:  Math.max(1, Math.round(s.max_hp  * 0.85)),
      attack:  Math.max(1, Math.round(s.attack  * 1.20)),
      defense: Math.max(1, Math.round(s.defense * 0.70)),
      agility: Math.max(1, Math.round(s.agility * 1.60)),
    }),
  },
  mage: {
    label: 'Místico',
    color: '#a855f7',
    description: 'Daño mágico que ignora defensa',
    apply: (s) => ({
      ...s,
      max_hp:       Math.max(1, Math.round(s.max_hp  * 0.90)),
      defense:      Math.max(1, Math.round(s.defense * 0.75)),
      attack:       Math.max(1, Math.round(s.attack  * 1.10)),
      intelligence: Math.max(1, Math.round((s.intelligence ?? 0) * 1.50)),
    }),
  },
}

export const ARCHETYPE_KEYS = ['berserker', 'tank', 'assassin', 'mage']

/** Aplica las modificaciones del arquetipo a unas stats base. */
export function applyArchetype(stats, archetypeKey) {
  const arch = ENEMY_ARCHETYPES[archetypeKey]
  return arch ? arch.apply(stats) : stats
}

/** Decora el nombre del enemigo con el arquetipo. */
export function decoratedEnemyName(baseName, archetypeKey) {
  const arch = ENEMY_ARCHETYPES[archetypeKey]
  return arch ? `${arch.label} · ${baseName}` : baseName
}

/**
 * Arquetipo determinista del enemigo de un piso de la torre.
 * Mismo piso → mismo arquetipo, para que el progreso sea reproducible.
 * Pisos múltiplos de 10 garantizan Tanque (mini-jefes), múltiplos de 25 son Místicos (jefes).
 */
export function floorEnemyArchetype(floor) {
  if (floor % 25 === 0) return 'mage'
  if (floor % 10 === 0) return 'tank'
  // Distribución pseudo-aleatoria pero determinista por piso
  const idx = (floor * 7 + 3) % ARCHETYPE_KEYS.length
  return ARCHETYPE_KEYS[idx]
}

/** Arquetipo aleatorio para combate rápido / práctica. */
export function randomArchetype() {
  return ARCHETYPE_KEYS[Math.floor(Math.random() * ARCHETYPE_KEYS.length)]
}

/* ─── Combate rápido / Práctica ──────────────────────────────────────────────── */

/**
 * Stats del enemigo de práctica según nivel del héroe.
 * Escalado ~70-80% de un enemigo de torre equivalente para que sea accesible.
 * Añade variación aleatoria ±15% para que cada combate se sienta distinto.
 */
export function trainingEnemyStats(heroLevel) {
  const base = Math.max(1, heroLevel * 1.2)
  const cap  = 25
  const fast = Math.min(base, cap)
  const slow = Math.max(0, base - cap)
  const scale = 0.75  // 75% de dificultad vs torre

  function vary(v) {
    const variance = 0.85 + Math.random() * 0.30  // 0.85 – 1.15
    return Math.max(1, Math.round(v * scale * variance))
  }

  return {
    max_hp:       vary(80  + fast * 15 + slow * 8),
    attack:       vary(5   + fast * 2  + slow * 1),
    defense:      vary(2   + fast * 1  + Math.floor(slow * 0.5)),
    strength:     vary(2   + Math.floor(fast * 0.5) + Math.floor(slow * 0.25)),
    agility:      vary(2   + Math.floor(fast * 0.3) + Math.floor(slow * 0.15)),
    intelligence: vary(1   + Math.floor(fast * 0.3) + Math.floor(slow * 0.15)),
  }
}

/**
 * Stats del enemigo de quick combat anclados al TIER del héroe (virtual level).
 * El enemigo representa "un héroe bien equipado de ese tramo" — independiente
 * del poder real del jugador. Consecuencia: si tu equipo es pobre para el tier
 * en el que estás, pierdes; ese es precisamente el empujón hacia expediciones,
 * expediciones y crafteo/reparar. Gear progression = tier progression.
 *
 * El caller (quick-combat.js) obtiene el virtual level vía `virtualLevelForRating`
 * en _rating.js (Hierro III=1 ... Leyenda=21) y lo pasa aquí.
 *
 * Usa `floorEnemyStats(vl)` como baseline + varianza ±15% por stat.
 */
export function tierAnchoredEnemyStats(virtualLevel) {
  const base = floorEnemyStats(Math.max(1, virtualLevel))
  function vary(v) {
    const variance = 0.85 + Math.random() * 0.30    // 0.85 – 1.15
    return Math.max(1, Math.round((v ?? 0) * variance))
  }
  return {
    max_hp:       vary(base.max_hp),
    attack:       vary(base.attack),
    defense:      vary(base.defense),
    strength:     vary(base.strength),
    agility:      vary(base.agility),
    intelligence: vary(base.intelligence),
  }
}

/**
 * Stats base de cada clase a nivel 1 (espejo de la tabla classes en DB).
 * Fuente de verdad para generar enemigos en combate rápido.
 */
const CLASS_BASE_STATS = {
  caudillo:  { max_hp: 140, attack: 14, defense: 8,  strength: 16, agility: 10, intelligence: 5  },
  sombra:    { max_hp: 80,  attack: 13, defense: 3,  strength: 8,  agility: 18, intelligence: 8  },
  arcanista: { max_hp: 70,  attack: 18, defense: 2,  strength: 5,  agility: 8,  intelligence: 18 },
  domador:   { max_hp: 110, attack: 11, defense: 6,  strength: 10, agility: 10, intelligence: 12 },
  universal: { max_hp: 105, attack: 12, defense: 5,  strength: 11, agility: 11, intelligence: 11 },
}

/**
 * Arquetipo de enemigo que corresponde a cada clase de héroe.
 * Usado para el pool de tácticas y la estrategia de combate del rival.
 * Las stats se generan por nivel, no por arquetipo — este mapa es solo
 * para coherencia temática (tácticas, estrategia, nombre decorado).
 */
export const CLASS_TO_ARCHETYPE = {
  caudillo:  'tank',
  sombra:    'assassin',
  arcanista: 'mage',
  domador:   'berserker',
  universal: 'tank',
}

/**
 * Genera las stats del enemigo en combate rápido basándose en la clase
 * del héroe y su nivel virtual (VL 1-21).
 *
 * El enemigo es siempre de la misma clase que el héroe — combate espejo.
 * Sus stats parten de CLASS_BASE_STATS escaladas por VL con ±10% de varianza,
 * de modo que el resultado del combate depende del equipamiento, tácticas y
 * consumibles del héroe, no de una ventaja de clase fija.
 *
 * Escala: VL 1 → ×1.1  |  VL 21 → ×4.5 (aprox.)
 *
 * @param {string} heroClass  — clase del héroe (caudillo, sombra, …)
 * @param {number} vl         — nivel virtual del héroe (1-21)
 * @param {Function} [rng]    — función random (para tests deterministas)
 */
export function enemyStatsForLevel(heroClass, vl, rng = Math.random) {
  const base = CLASS_BASE_STATS[heroClass] ?? CLASS_BASE_STATS.universal
  const scale = 1.15 + (Math.max(1, Math.min(21, vl)) - 1) * 0.17
  function scaled(v) {
    const variance = 0.92 + rng() * 0.16   // ±8% varianza
    return Math.max(1, Math.round((v ?? 1) * scale * variance))
  }
  return {
    max_hp:       scaled(base.max_hp),
    attack:       scaled(base.attack),
    defense:      scaled(base.defense),
    strength:     scaled(base.strength),
    agility:      scaled(base.agility),
    intelligence: scaled(base.intelligence),
  }
}

/**
 * @deprecated Usa enemyStatsForLevel() para combate rápido.
 * Mantenido para la Torre y los Torneos hasta que se migren.
 * @param {{ attack, defense, strength, agility, intelligence, max_hp }} heroStats
 */
export function heroAnchoredEnemyStats(heroStats) {
  function vary(v) {
    const variance = 0.90 + Math.random() * 0.20    // 0.90 – 1.10
    return Math.max(1, Math.round((v ?? 1) * variance))
  }
  return {
    max_hp:       vary(heroStats.max_hp),
    attack:       vary(heroStats.attack),
    defense:      vary(heroStats.defense),
    strength:     vary(heroStats.strength),
    agility:      vary(heroStats.agility),
    intelligence: vary(heroStats.intelligence),
  }
}

const TRAINING_ENEMY_POOLS = [
  { max:  3, names: [
    'Keres', 'Stryx', 'Empusa', 'Mormo', 'Harpia', 'Aello', 'Celaeno',
    'Draco', 'Stheno', 'Ocípete', 'Erinys', 'Lamia',
    'Draugr', 'Huldra', 'Nökken', 'Strigoi', 'Vetala',
    'Gallu', 'Utukku', 'Rabisu', 'Namtar', 'Lilu',
    'Domovoi', 'Leshy', 'Oni', 'Tengu', 'Gashadokuro',
  ]},
  { max:  6, names: [
    'Ladon', 'Argos', 'Equidna', 'Esfinge', 'Caribdis', 'Ortro', 'Escila',
    'Gerión', 'Forcis', 'Lestrigón', 'Kampe', 'Ceto', 'Briareo',
    'Hrungnir', 'Thiazi', 'Thrym', 'Hymir', 'Skrýmir', 'Utgard',
    'Ammit', 'Sekhmet', 'Anubis', 'Apep',
    'Humbaba', 'Pazuzu', 'Lamashtu', 'Anzu',
    'Raijin', 'Orochi', 'Taotie', 'Rahovart',
  ]},
  { max: 10, names: [
    'Medusa', 'Cerbero', 'Minotauro', 'Polifemo', 'Hidra', 'Quimera', 'Pitón',
    'Fenrir', 'Jörmungandr', 'Garm', 'Nidhogg', 'Fafnir', 'Hati', 'Sköll',
    'Hiperión', 'Atlas', 'Coeo', 'Epimeteo',
    'Balor', 'Tethra', 'Cailleach', 'Indech',
    'Vritra', 'Ravana', 'Mahisha', 'Namuci',
    'Cipactli', 'Camazotz', 'Xolotl', 'Zipacna',
  ]},
  { max: 20, names: [
    'Cronos', 'Tifón', 'Ares', 'Hades', 'Hécate', 'Érebo',
    'Loki', 'Hel', 'Ymir', 'Surtr', 'Aegir',
    'Set', 'Sekhmet', 'Apophis', 'Nehebkau',
    'Moloch', 'Baal', 'Dagon', 'Mot', 'Yam', 'Lotan',
    'Nergal', 'Ereshkigal', 'Tiamat', 'Enlil',
    'Angra', 'Ahriman', 'Aeshma', 'Druj',
    'Morrigan', 'Crom', 'Arawn', 'Cernunnos',
    'Mara', 'Yama', 'Varuna', 'Nirrti',
  ]},
  { max: Infinity, names: [
    'Bael', 'Agares', 'Vassago', 'Marbas', 'Valefor', 'Amon', 'Barbatos',
    'Paimon', 'Buer', 'Gusion', 'Sitri', 'Beleth', 'Leraje', 'Eligos',
    'Zepar', 'Botis', 'Bathin', 'Sallos', 'Purson', 'Morax', 'Ipos',
    'Naberius', 'Glasya', 'Berith', 'Astaroth', 'Foras', 'Gaap',
    'Furfur', 'Marchosias', 'Stolas', 'Phenex', 'Malphas', 'Focalor',
    'Vepar', 'Sabnock', 'Bifrons', 'Haagenti', 'Caim', 'Murmur',
    'Orobas', 'Andromalius', 'Vapula', 'Zagan', 'Andras', 'Flauros',
    'Abadón', 'Azazel', 'Samael', 'Leviatán', 'Behemot', 'Belial',
    'Beelzebub', 'Mammon', 'Belphegor', 'Amdusias', 'Dantalion',
  ]},
]

/**
 * Nombre aleatorio del enemigo de práctica según nivel del héroe.
 */
export function trainingEnemyName(heroLevel) {
  const pool = TRAINING_ENEMY_POOLS.find(p => heroLevel <= p.max)?.names ?? TRAINING_ENEMY_POOLS[TRAINING_ENEMY_POOLS.length - 1].names
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Recompensas de combate rápido — ~18% de la torre para piso equivalente.
 */
export function trainingRewards(heroLevel) {
  const equivalentFloor = Math.max(1, Math.round(heroLevel * 1.2))
  const towerR = floorRewards(equivalentFloor)
  return {
    gold:       Math.max(5, Math.round(towerR.gold * 0.18)),
    experience: Math.max(3, Math.round(towerR.experience * 0.18)),
  }
}

/* ─── Expediciones: fórmulas de preview para DungeonCard ────────────────────── */

/**
 * Probabilidad de drop de equipo en una expedición.
 * Replica getDropConfig de _loot.js: chance = 0.10 + difficulty * 0.03
 * @param {number} difficulty  1-10
 * @param {number} dropRateBonus  bonus de equipo/research (itemDropRateBonus)
 * @param {number} lootBoostPct   poción loot_boost (0-1)
 * @returns {number} probabilidad 0-1
 */
export function itemDropChance(difficulty, dropRateBonus = 0, lootBoostPct = 0) {
  const base = 0.10 + Math.max(1, Math.min(10, difficulty)) * 0.03
  return Math.min(1, (base + dropRateBonus) * (1 + lootBoostPct))
}

/**
 * Probabilidad de drop de táctica en una expedición.
 * Base 12% + inteligencia (hasta +20%) + research bonus.
 * @param {number} intelligence  stat de inteligencia del héroe
 * @param {number} researchBonus  tactic_drop_pct de research
 * @returns {number} probabilidad 0-1
 */
export function tacticDropChance(intelligence = 0, researchBonus = 0) {
  const intellBonus = Math.min(0.20, (intelligence ?? 0) * 0.003)
  return Math.min(1, 0.12 + intellBonus + researchBonus)
}

/**
 * Pérdida de durabilidad estimada por expedición.
 * Replica la lógica de expedition-collect.js:
 *   base = 1 + floor(difficulty / 2)
 *   resultado = base - floor(defense / 15) + durabilityMod
 *   clamped a 0+, ajustado por research durability_loss_pct
 *
 * @param {number} difficulty    1-10
 * @param {number} defense       stat de defensa del héroe
 * @param {number} durabilityMod bonus/malus de tácticas equipadas
 * @param {number} researchPct   durability_loss_pct de research (negativo = reducción)
 * @returns {number} puntos de durabilidad perdidos
 */
export function durabilityLoss(difficulty, defense = 0, durabilityMod = 0, researchPct = 0) {
  const dangerBase = 1 + Math.floor((difficulty ?? 1) / 2)
  const raw = dangerBase - Math.floor(defense / 15) + durabilityMod
  return Math.max(0, Math.round(raw * (1 + researchPct)))
}

/**
 * Datos de material drops por nombre de mazmorra.
 * Espejo de MATERIAL_DROP_BY_NAME en api/_loot.js.
 * Usado por el frontend para mostrar probabilidad y cantidad en la card.
 */
export const MATERIAL_DROP_DATA = {
  mine:    { resource: 'fragments', chance: 0.15, min: 1, max: 1 },
  crypt:   { resource: 'fragments', chance: 0.20, min: 1, max: 2 },
  magic:   { resource: 'essence',   chance: 0.10, min: 1, max: 1 },
  ancient: { resource: 'essence',   chance: 0.18, min: 1, max: 2 },
}

/**
 * Perfil de drops por tipo de mazmorra — multiplicadores sobre las probabilidades base.
 * Cada tipo se especializa en cierto tipo de recompensa.
 */
export const DUNGEON_DROP_PROFILE = {
  combat:     { goldMult: 1.3, xpMult: 1.0, itemMult: 1.5, tacticMult: 0.8, focus: 'Equipo' },
  wilderness: { goldMult: 1.2, xpMult: 1.2, itemMult: 0.8, tacticMult: 1.2, focus: 'Experiencia' },
  magic:      { goldMult: 0.8, xpMult: 1.0, itemMult: 0.8, tacticMult: 2.0, focus: 'Tácticas' },
  crypt:      { goldMult: 1.0, xpMult: 1.0, itemMult: 1.3, tacticMult: 1.0, focus: 'Fragmentos' },
  mine:       { goldMult: 1.0, xpMult: 1.0, itemMult: 1.0, tacticMult: 0.8, focus: 'Fragmentos' },
  ancient:    { goldMult: 1.0, xpMult: 1.0, itemMult: 1.0, tacticMult: 1.5, focus: 'Esencia' },
}

/**
 * Slots de equipo primarios por tipo de mazmorra — refleja SLOT_POOL_BY_TYPE de _loot.js.
 * Usado por el frontend para mostrar visualmente qué piezas de equipo prioriza cada mazmorra.
 */
export const DUNGEON_TYPE_SLOTS = {
  combat:     [{ slot: 'main_hand', label: 'Arma' }, { slot: 'off_hand', label: 'Escudo' }, { slot: 'chest', label: 'Pecho' }],
  wilderness: [{ slot: 'legs', label: 'Piernas' }, { slot: 'arms', label: 'Brazos' }, { slot: 'accessory', label: 'Accesorio' }],
  magic:      [{ slot: 'accessory', label: 'Accesorio' }, { slot: 'helmet', label: 'Yelmo' }],
  crypt:      [{ slot: 'off_hand', label: 'Escudo' }, { slot: 'chest', label: 'Pecho' }, { slot: 'helmet', label: 'Yelmo' }],
  mine:       [{ slot: 'arms', label: 'Brazos' }, { slot: 'chest', label: 'Pecho' }, { slot: 'main_hand', label: 'Arma' }],
  ancient:    [{ slot: 'accessory', label: 'Accesorio' }, { slot: 'helmet', label: 'Yelmo' }, { slot: 'chest', label: 'Pecho' }],
}

/**
 * Descripción del loot principal por tipo de mazmorra.
 * El frontend usa esto para mostrar qué slots de equipo prioriza cada tipo.
 */
/**
 * Combat Power (CP) — indicador de fuerza del héroe.
 * Pesos derivados del motor de combate (_combatMath.js):
 *   attack ×4  → multiplicador principal de daño físico
 *   defense ×3 → reducción de daño via def/(def+100)
 *   strength ×2 → contribuye 0.3× al daño + penetración de armadura
 *   agility ×2  → frecuencia de críticos y ataques dobles
 *   intelligence ×2 → daño mágico (ignora defensa)
 *   max_hp ×0.5 → supervivencia (valores más grandes, peso menor)
 *
 * @param {object} stats — { attack, defense, strength, agility, intelligence, max_hp }
 * @returns {number} CP redondeado al entero más cercano
 */
export function computeCP(stats) {
  return Math.round(
    (stats.attack       ?? 0) * 4   +
    (stats.defense      ?? 0) * 3   +
    (stats.strength     ?? 0) * 2   +
    (stats.agility      ?? 0) * 2   +
    (stats.intelligence ?? 0) * 2   +
    (stats.max_hp       ?? 0) * 0.5
  )
}

export const DUNGEON_LOOT_FOCUS = {
  combat:     { label: 'Combate',    slots: ['main_hand', 'off_hand'],             description: 'Armas y escudos' },
  wilderness: { label: 'Naturaleza', slots: ['legs', 'arms', 'accessory'],         description: 'Armadura ligera y accesorios' },
  magic:      { label: 'Arcana',     slots: ['accessory', 'helmet'],               description: 'Accesorios mágicos' },
  crypt:      { label: 'Cripta',     slots: ['off_hand', 'chest', 'helmet'],       description: 'Escudos y armadura pesada' },
  mine:       { label: 'Mina',       slots: ['arms', 'chest', 'main_hand'],        description: 'Armas y armadura de brazos' },
  ancient:    { label: 'Antigua',    slots: ['accessory', 'helmet', 'chest'],      description: 'Accesorios y yelmos antiguos' },
}
