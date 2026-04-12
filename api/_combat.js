/**
 * Motor de combate 1v1 con sistema de clases, habilidades y posturas.
 *
 * Determinismo parcial:
 *   - El ORDEN INICIAL de ataque (quién golpea primero) es probabilístico,
 *     escalado por diferencia de agility (ver `rollFirstAttacker`).
 *   - El daño tiene varianza aleatoria de ±15%.
 *   - Esquiva (sombra) y pulso arcano tienen componentes probabilísticos.
 *   - Los crits siguen siendo periódicos (deterministas), basados en agility.
 *   - El sistema de "Momento clave" pausa en mitad del combate cuando
 *     alguno baja del 50% HP, devolviendo estado para decisión externa.
 *
 * Sistema de clases:
 *   Cada combatiente tiene una clase (hero) o arquetipo (enemy → mapeado a clase).
 *   Las clases otorgan:
 *     - Pasiva: efecto constante (reducción, esquiva, primer golpe crit, pulso arcano)
 *     - Habilidad activa: se activa cada N rondas (cooldown)
 *     - Postura: modifica daño/defensa según % de HP (agresivo/equilibrado/desesperado)
 *
 * Log: array de rondas, cada una con array de eventos.
 * Tipos de evento:
 *   - attack:  { type:'attack', actor, damage, crit, hpA, hpB }
 *   - ability: { type:'ability', actor, ability, label, icon, damage?, hpA, hpB }
 *   - dodge:   { type:'dodge',  actor, dodger, hpA, hpB }
 *   - passive: { type:'passive', actor, passive, label, icon, damage?, hpA, hpB }
 *   - stance:  { type:'stance', actor, stance, label, hpA, hpB }
 *   - tactic:  { type:'tactic', actor, tactic, label, effect, hpA, hpB }
 */

import { physDamage, magicDamage, critPeriod, rollFirstAttacker, armorPen, applyVariance } from './_combatMath.js'
import { CLASS_ABILITIES, ARCHETYPE_TO_CLASS, getStance } from '../src/lib/combatAbilities.js'

export { rollFirstAttacker }

/**
 * Resuelve la clase de combate de un combatiente.
 * Para héroes: usa hero.class directamente.
 * Para enemigos: mapea archetype → class.
 */
function resolveCombatClass(fighter) {
  if (fighter.class) {
    return ARCHETYPE_TO_CLASS[fighter.class] ?? fighter.class
  }
  return null
}

/**
 * Simula un combate desde el principio.
 * Ambos tienen: attack, defense, strength, agility, intelligence, max_hp
 * Opcional: class (para habilidades)
 *
 * Opcionales en opts:
 *   - critBonus       (fracción que reduce período de crit de A)
 *   - dmgMultiplier   (multiplicador de daño global del lado A)
 *   - keyMomentEnabled (boolean): pausa al bajar del 50% HP
 *   - rng             (función random, para tests)
 *   - classA          (clase de A, override de a.class)
 *   - classB          (clase de B, override de b.class)
 *   - tacticsA        (array de {name, icon, level, combat_effect} para A)
 *   - tacticsB        (array de {name, icon, level, combat_effect} para B)
 */
export function simulateCombat(a, b, opts = {}) {
  const rng = opts.rng ?? Math.random
  const firstAttacker = rollFirstAttacker(a.agility, b.agility, rng)
  const classA = opts.classA ?? resolveCombatClass(a)
  const classB = opts.classB ?? resolveCombatClass(b)

  const initialState = {
    hpA: a.max_hp,
    hpB: b.max_hp,
    round: 0,
    log: [],
    firstAttacker,
    pauseUsed: false,
    classA,
    classB,
    abilityCdA: 0,
    abilityCdB: 0,
    hasAttackedA: false,
    hasAttackedB: false,
    shieldA: 0,
    shieldB: 0,
    dodgeA: 0,
    dodgeB: 0,
    prevStanceA: null,
    prevStanceB: null,
    tacticTriggeredA: {},
    tacticTriggeredB: {},
    tacticBuffsA: {},
    tacticBuffsB: {},
  }
  return runCombatLoop(a, b, initialState, opts)
}

/**
 * Reanuda un combate previamente pausado por "Momento clave".
 */
export function resumeCombat(a, b, state, opts = {}) {
  return runCombatLoop(a, b, { ...state, pauseUsed: true }, opts)
}

function runCombatLoop(a, b, state, opts) {
  let hpA = state.hpA
  let hpB = state.hpB
  const log = state.log
  const firstAttacker = state.firstAttacker
  const pauseUsed = !!state.pauseUsed
  const rng = opts.rng ?? Math.random

  const classA = state.classA
  const classB = state.classB
  const abilitiesA = classA ? CLASS_ABILITIES[classA] : null
  const abilitiesB = classB ? CLASS_ABILITIES[classB] : null

  let abilityCdA = state.abilityCdA ?? 0
  let abilityCdB = state.abilityCdB ?? 0
  let hasAttackedA = state.hasAttackedA ?? false
  let hasAttackedB = state.hasAttackedB ?? false
  let shieldA = state.shieldA ?? 0
  let shieldB = state.shieldB ?? 0
  let dodgeA = state.dodgeA ?? 0
  let dodgeB = state.dodgeB ?? 0
  let prevStanceA = state.prevStanceA
  let prevStanceB = state.prevStanceB

  // Tactic state
  const tacticsA = opts.tacticsA ?? []
  const tacticsB = opts.tacticsB ?? []
  const tacticTriggeredA = { ...(state.tacticTriggeredA ?? {}) }
  const tacticTriggeredB = { ...(state.tacticTriggeredB ?? {}) }
  // Active tactic buffs: { effect_key: { remainingRounds, value } }
  const tacticBuffsA = { ...(state.tacticBuffsA ?? {}) }
  const tacticBuffsB = { ...(state.tacticBuffsB ?? {}) }

  const dmgMult = 1 + (opts.dmgMultiplier ?? 0)

  // ── Helpers de tácticas ──

  /** Escala el valor de un efecto por nivel: nv1=base, nv5=+60% */
  function scaleTacticValue(base, level) {
    return base * (1 + ((level ?? 1) - 1) * 0.15)
  }

  /**
   * Procesa triggers de tácticas para un bando.
   * Muta buffs, triggered, events, y opcionalmente HP.
   */
  function processTacticTriggers(tactics, buffs, triggered, actor, fighter, opponentHp, maxHp, round, events) {
    for (const t of tactics) {
      const eff = t.combat_effect
      if (!eff?.trigger) continue
      const id = t.name // unique enough for tracking
      const level = t.level ?? 1

      // ── Passive: se aplica una vez en ronda 1 y se mantiene ──
      if (eff.trigger === 'passive') {
        if (round === 1 && !triggered[id + '_passive']) {
          triggered[id + '_passive'] = true
          applyTacticEffect(eff, level, buffs, 999)
          events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: eff.effect, hpA: actor === 'a' ? fighter.hp : opponentHp, hpB: actor === 'a' ? opponentHp : fighter.hp })
        }
        continue
      }

      // ── start_of_combat: solo ronda 1 ──
      if (eff.trigger === 'start_of_combat' && round === 1) {
        applyTacticEffect(eff, level, buffs, eff.duration ?? 1)
        events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: eff.effect, hpA: actor === 'a' ? fighter.hp : opponentHp, hpB: actor === 'a' ? opponentHp : fighter.hp })
        continue
      }

      // ── round_n: se activa en la ronda indicada ──
      if (eff.trigger === 'round_n' && round === (eff.n ?? 3)) {
        applyTacticEffect(eff, level, buffs, eff.duration ?? 1)
        events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: eff.effect, hpA: actor === 'a' ? fighter.hp : opponentHp, hpB: actor === 'a' ? opponentHp : fighter.hp })
        continue
      }

      // ── hp_below_pct: se activa cuando HP baja del umbral ──
      if (eff.trigger === 'hp_below_pct') {
        const below = fighter.hp / maxHp <= (eff.threshold ?? 0.50)
        if (below && (!eff.once || !triggered[id])) {
          triggered[id] = true
          applyTacticEffect(eff, level, buffs, eff.duration ?? 2)
          events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: eff.effect, hpA: actor === 'a' ? fighter.hp : opponentHp, hpB: actor === 'a' ? opponentHp : fighter.hp })
        }
        continue
      }
    }
  }

  /** Registra un buff activo desde un efecto de táctica. */
  function applyTacticEffect(eff, level, buffs, duration) {
    const key = eff.effect
    const val = scaleTacticValue(eff.value ?? 0, level)
    // Acumular o reemplazar
    buffs[key] = { value: val, duration, stat: eff.stat, chance: eff.chance }
  }

  /** Decrementa duración de buffs activos, elimina los caducados. */
  function tickBuffs(buffs) {
    for (const key of Object.keys(buffs)) {
      buffs[key].duration--
      if (buffs[key].duration <= 0) delete buffs[key]
    }
  }

  /** Lee el valor de un buff activo. */
  function getBuff(buffs, key) {
    return buffs[key]?.value ?? 0
  }
  function hasBuff(buffs, key) {
    return key in buffs
  }

  // Períodos de crítico
  const critBonusRounds = Math.floor((opts.critBonus ?? 0) * 100)
  const critPA = Math.max(3, critPeriod(a.agility) - critBonusRounds)
  const critPB = critPeriod(b.agility)

  // Doble ataque: >= 20 puntos de ventaja en agility = +1 ataque extra cada 6 rondas
  const doubleA = Math.max(0, (a.agility ?? 0) - (b.agility ?? 0)) >= 20
  const doubleB = Math.max(0, (b.agility ?? 0) - (a.agility ?? 0)) >= 20

  // Penetración de armadura
  const penA = armorPen(a.strength)
  const penB = armorPen(b.strength)

  for (let round = state.round + 1; round <= 30 && hpA > 0 && hpB > 0; round++) {
    const events = []
    const isDoubleRound = round % 6 === 0
    const isCritA = round % critPA === 1
    const isCritB = round % critPB === (critPB > 1 ? 2 : 0)

    // ── Posturas ──
    const stanceA = getStance(hpA, a.max_hp)
    const stanceB = getStance(hpB, b.max_hp)

    if (stanceA.key !== prevStanceA && round > (state.round + 1)) {
      events.push({ type: 'stance', actor: 'a', stance: stanceA.key, label: stanceA.label, hpA, hpB })
      prevStanceA = stanceA.key
    } else if (prevStanceA === null) {
      prevStanceA = stanceA.key
    }

    if (stanceB.key !== prevStanceB && round > (state.round + 1)) {
      events.push({ type: 'stance', actor: 'b', stance: stanceB.key, label: stanceB.label, hpA, hpB })
      prevStanceB = stanceB.key
    } else if (prevStanceB === null) {
      prevStanceB = stanceB.key
    }

    // ── Tácticas (inicio de ronda, antes de habilidades) ──
    const tacEventsA = []
    const tacEventsB = []
    processTacticTriggers(tacticsA, tacticBuffsA, tacticTriggeredA, 'a', { hp: hpA }, hpB, a.max_hp, round, tacEventsA)
    processTacticTriggers(tacticsB, tacticBuffsB, tacticTriggeredB, 'b', { hp: hpB }, hpA, b.max_hp, round, tacEventsB)
    events.push(...tacEventsA, ...tacEventsB)

    // Absorb shield: genera un escudo temporal basado en % de max_hp
    if (hasBuff(tacticBuffsA, 'absorb_shield') && !tacticBuffsA._shieldA_applied) {
      shieldA = Math.max(shieldA, 1)
      tacticBuffsA._shieldA_applied = true
    }
    if (hasBuff(tacticBuffsB, 'absorb_shield') && !tacticBuffsB._shieldB_applied) {
      shieldB = Math.max(shieldB, 1)
      tacticBuffsB._shieldB_applied = true
    }

    // Guaranteed dodge de tácticas
    if (hasBuff(tacticBuffsA, 'guaranteed_dodge')) dodgeA = Math.max(dodgeA, 1)
    if (hasBuff(tacticBuffsB, 'guaranteed_dodge')) dodgeB = Math.max(dodgeB, 1)

    // Stealth = dodge + guaranteed crit
    if (hasBuff(tacticBuffsA, 'stealth')) { dodgeA = Math.max(dodgeA, 1) }
    if (hasBuff(tacticBuffsB, 'stealth')) { dodgeB = Math.max(dodgeB, 1) }

    // heal_pct de ronda (no de on_crit)
    if (hasBuff(tacticBuffsA, 'heal_pct') && !tacticBuffsA.heal_pct._fromCrit) {
      const healAmt = Math.round(a.max_hp * getBuff(tacticBuffsA, 'heal_pct'))
      hpA = Math.min(a.max_hp, hpA + healAmt)
    }
    if (hasBuff(tacticBuffsB, 'heal_pct') && !tacticBuffsB.heal_pct._fromCrit) {
      const healAmt = Math.round(b.max_hp * getBuff(tacticBuffsB, 'heal_pct'))
      hpB = Math.min(b.max_hp, hpB + healAmt)
    }

    // ── Habilidades activas (inicio de ronda) ──
    let abilityAtkMultA = 1
    let abilityAtkMultB = 1
    let abilityDmgTakenMultA = 1
    let abilityDmgTakenMultB = 1

    // Ability A
    if (abilitiesA?.ability && abilityCdA <= 0 && round > 1) {
      const ab = abilitiesA.ability
      const eff = ab.effect(a.intelligence)
      abilityCdA = ab.cooldown

      if (eff.shieldMult != null) {
        shieldA = eff.duration ?? 1
        abilityDmgTakenMultA *= eff.shieldMult
        events.push({ type: 'ability', actor: 'a', ability: ab.key, label: ab.label, icon: ab.icon, hpA, hpB })
      } else if (eff.atkMult != null) {
        abilityAtkMultA = eff.atkMult
        if (eff.dmgTakenMult) abilityDmgTakenMultA *= eff.dmgTakenMult
        events.push({ type: 'ability', actor: 'a', ability: ab.key, label: ab.label, icon: ab.icon, hpA, hpB })
      } else if (eff.guaranteedDodge) {
        dodgeA = eff.duration ?? 1
        events.push({ type: 'ability', actor: 'a', ability: ab.key, label: ab.label, icon: ab.icon, hpA, hpB })
      } else if (eff.pureDmg != null) {
        const dmg = applyVariance(eff.pureDmg, rng)
        hpB = Math.max(0, hpB - dmg)
        events.push({ type: 'ability', actor: 'a', ability: ab.key, label: ab.label, icon: ab.icon, damage: dmg, hpA, hpB })
      }
    }
    abilityCdA = Math.max(0, abilityCdA - 1)

    // Ability B
    if (abilitiesB?.ability && abilityCdB <= 0 && round > 1) {
      const ab = abilitiesB.ability
      const eff = ab.effect(b.intelligence)
      abilityCdB = ab.cooldown

      if (eff.shieldMult != null) {
        shieldB = eff.duration ?? 1
        abilityDmgTakenMultB *= eff.shieldMult
        events.push({ type: 'ability', actor: 'b', ability: ab.key, label: ab.label, icon: ab.icon, hpA, hpB })
      } else if (eff.atkMult != null) {
        abilityAtkMultB = eff.atkMult
        if (eff.dmgTakenMult) abilityDmgTakenMultB *= eff.dmgTakenMult
        events.push({ type: 'ability', actor: 'b', ability: ab.key, label: ab.label, icon: ab.icon, hpA, hpB })
      } else if (eff.guaranteedDodge) {
        dodgeB = eff.duration ?? 1
        events.push({ type: 'ability', actor: 'b', ability: ab.key, label: ab.label, icon: ab.icon, hpA, hpB })
      } else if (eff.pureDmg != null) {
        const dmg = applyVariance(eff.pureDmg, rng)
        hpA = Math.max(0, hpA - dmg)
        events.push({ type: 'ability', actor: 'b', ability: ab.key, label: ab.label, icon: ab.icon, damage: dmg, hpA, hpB })
      }
    }
    abilityCdB = Math.max(0, abilityCdB - 1)

    // ── Pasiva: Pulso Arcano (cada N rondas) ──
    if (abilitiesA?.passive?.key === 'pulso_arcano' && round % abilitiesA.passive.period === 0 && hpB > 0) {
      const eff = abilitiesA.passive.effect(a.intelligence)
      const dmg = applyVariance(eff.bonusDmg, rng)
      if (dmg > 0) {
        hpB = Math.max(0, hpB - dmg)
        events.push({ type: 'passive', actor: 'a', passive: 'pulso_arcano', label: abilitiesA.passive.label, icon: abilitiesA.passive.icon, damage: dmg, hpA, hpB })
      }
    }
    if (abilitiesB?.passive?.key === 'pulso_arcano' && round % abilitiesB.passive.period === 0 && hpA > 0) {
      const eff = abilitiesB.passive.effect(b.intelligence)
      const dmg = applyVariance(eff.bonusDmg, rng)
      if (dmg > 0) {
        hpA = Math.max(0, hpA - dmg)
        events.push({ type: 'passive', actor: 'b', passive: 'pulso_arcano', label: abilitiesB.passive.label, icon: abilitiesB.passive.icon, damage: dmg, hpA, hpB })
      }
    }

    if (hpA <= 0 || hpB <= 0) {
      log.push({ round, events })
      break
    }

    // ── Ataques ──
    // Pasiva liderazgo (caudillo): reducción fija de daño recibido
    const passiveDmgTakenA = abilitiesA?.passive?.key === 'liderazgo' ? 0.88 : 1
    const passiveDmgTakenB = abilitiesB?.passive?.key === 'liderazgo' ? 0.88 : 1

    // Shield activo de habilidad
    const shieldMultA = shieldA > 0 ? abilityDmgTakenMultA : 1
    const shieldMultB = shieldB > 0 ? abilityDmgTakenMultB : 1

    // Tactic modifiers precalculated for this round
    const tacDmgMultA = 1 + getBuff(tacticBuffsA, 'damage_mult') / (getBuff(tacticBuffsA, 'damage_mult') > 0 ? (1 / (getBuff(tacticBuffsA, 'damage_mult') - 1 || 1)) : 1)
    const tacPenA = penA + getBuff(tacticBuffsA, 'armor_pen_boost')
    const tacPenB = penB + getBuff(tacticBuffsB, 'armor_pen_boost')
    const tacDmgRedA = 1 - getBuff(tacticBuffsA, 'damage_reduction')
    const tacDmgRedB = 1 - getBuff(tacticBuffsB, 'damage_reduction')
    const tacCritRedA = getBuff(tacticBuffsA, 'reduce_crit_damage')
    const tacCritRedB = getBuff(tacticBuffsB, 'reduce_crit_damage')
    // enemy_debuff: reduce ataque del oponente
    const tacEnemyDebuffA = hasBuff(tacticBuffsB, 'enemy_debuff') && tacticBuffsB.enemy_debuff.stat === 'attack'
      ? 1 - getBuff(tacticBuffsB, 'enemy_debuff') : 1
    const tacEnemyDebuffB = hasBuff(tacticBuffsA, 'enemy_debuff') && tacticBuffsA.enemy_debuff.stat === 'attack'
      ? 1 - getBuff(tacticBuffsA, 'enemy_debuff') : 1
    // dodge_boost de tácticas
    const tacDodgeBoostA = getBuff(tacticBuffsA, 'dodge_boost')
    const tacDodgeBoostB = getBuff(tacticBuffsB, 'dodge_boost')

    function calcDmgA(isCrit) {
      const effDef = Math.round((b.defense ?? 0) * (1 - Math.min(tacPenA, 0.60)) * stanceB.defMult)
      const base = physDamage(a.attack * tacEnemyDebuffA, a.strength, effDef) + magicDamage(a.intelligence)
      const tacDmg = hasBuff(tacticBuffsA, 'damage_mult') ? getBuff(tacticBuffsA, 'damage_mult') : 1
      const scaled = base * dmgMult * stanceA.dmgMult * abilityAtkMultA * tacDmg
      const critMult = isCrit ? (1.5 - tacCritRedB) : 1
      const withCrit = scaled * Math.max(critMult, 1.1)
      const withDmgTaken = withCrit * passiveDmgTakenB * shieldMultB * abilityDmgTakenMultB * tacDmgRedB
      return applyVariance(withDmgTaken, rng)
    }

    function calcDmgB(isCrit) {
      const effDef = Math.round((a.defense ?? 0) * (1 - Math.min(tacPenB, 0.60)) * stanceA.defMult)
      const base = physDamage(b.attack * tacEnemyDebuffB, b.strength, effDef) + magicDamage(b.intelligence)
      const tacDmg = hasBuff(tacticBuffsB, 'damage_mult') ? getBuff(tacticBuffsB, 'damage_mult') : 1
      const scaled = base * stanceB.dmgMult * abilityAtkMultB * tacDmg
      const critMult = isCrit ? (1.5 - tacCritRedA) : 1
      const withCrit = scaled * Math.max(critMult, 1.1)
      const withDmgTaken = withCrit * passiveDmgTakenA * shieldMultA * abilityDmgTakenMultA * tacDmgRedA
      return applyVariance(withDmgTaken, rng)
    }

    // Pasiva primer golpe (domador): primer ataque del combate es crit
    const forceCritA = abilitiesA?.passive?.key === 'primer_golpe' && !hasAttackedA
    const forceCritB = abilitiesB?.passive?.key === 'primer_golpe' && !hasAttackedB

    function strikeA() {
      if (hpB <= 0) return
      // Check dodge B (passive + tactic dodge_boost)
      const dodgeChanceB = (abilitiesB?.passive?.key === 'evasion' ? 0.20 : 0) + tacDodgeBoostB
      if (dodgeB > 0) {
        dodgeB--
        events.push({ type: 'dodge', actor: 'a', dodger: 'b', hpA, hpB })
        // on_dodge trigger para B
        handleOnDodge(tacticsB, tacticBuffsB, tacticTriggeredB, 'b', hpA, hpB, events)
        hasAttackedA = true
        return
      }
      if (dodgeChanceB > 0 && rng() < dodgeChanceB) {
        events.push({ type: 'dodge', actor: 'a', dodger: 'b', hpA, hpB })
        handleOnDodge(tacticsB, tacticBuffsB, tacticTriggeredB, 'b', hpA, hpB, events)
        hasAttackedA = true
        return
      }
      // Crit: pasiva + táctica guaranteed_crit / stealth / guaranteed_crit_next / first_hit_mult
      const tacticCrit = hasBuff(tacticBuffsA, 'guaranteed_crit') || hasBuff(tacticBuffsA, 'stealth') || hasBuff(tacticBuffsA, 'guaranteed_crit_next')
      const crit = tacticCrit || (forceCritA && !hasAttackedA) || isCritA
      // first_hit_mult
      const firstHitMult = (!hasAttackedA && hasBuff(tacticBuffsA, 'first_hit_mult')) ? getBuff(tacticBuffsA, 'first_hit_mult') : 1
      const dmg = Math.round(calcDmgA(crit) * firstHitMult)
      hpB = Math.max(0, hpB - dmg)
      events.push({ type: 'attack', actor: 'a', damage: dmg, crit, hpA, hpB })
      hasAttackedA = true
      // Consumir guaranteed_crit_next
      if (hasBuff(tacticBuffsA, 'guaranteed_crit_next')) delete tacticBuffsA.guaranteed_crit_next
      // on_crit trigger
      if (crit) handleOnCrit(tacticsA, tacticBuffsA, tacticTriggeredA, 'a', a, hpA, hpB, events)
    }

    function strikeB() {
      if (hpA <= 0) return
      // Check dodge A (passive + tactic dodge_boost)
      const dodgeChanceA = (abilitiesA?.passive?.key === 'evasion' ? 0.20 : 0) + tacDodgeBoostA
      if (dodgeA > 0) {
        dodgeA--
        events.push({ type: 'dodge', actor: 'b', dodger: 'a', hpA, hpB })
        handleOnDodge(tacticsA, tacticBuffsA, tacticTriggeredA, 'a', hpA, hpB, events)
        hasAttackedB = true
        return
      }
      if (dodgeChanceA > 0 && rng() < dodgeChanceA) {
        events.push({ type: 'dodge', actor: 'b', dodger: 'a', hpA, hpB })
        handleOnDodge(tacticsA, tacticBuffsA, tacticTriggeredA, 'a', hpA, hpB, events)
        hasAttackedB = true
        return
      }
      const tacticCrit = hasBuff(tacticBuffsB, 'guaranteed_crit') || hasBuff(tacticBuffsB, 'stealth') || hasBuff(tacticBuffsB, 'guaranteed_crit_next')
      const crit = tacticCrit || (forceCritB && !hasAttackedB) || isCritB
      const firstHitMult = (!hasAttackedB && hasBuff(tacticBuffsB, 'first_hit_mult')) ? getBuff(tacticBuffsB, 'first_hit_mult') : 1
      const dmg = Math.round(calcDmgB(crit) * firstHitMult)
      hpA = Math.max(0, hpA - dmg)
      events.push({ type: 'attack', actor: 'b', damage: dmg, crit, hpA, hpB })
      hasAttackedB = true
      if (hasBuff(tacticBuffsB, 'guaranteed_crit_next')) delete tacticBuffsB.guaranteed_crit_next
      if (crit) handleOnCrit(tacticsB, tacticBuffsB, tacticTriggeredB, 'b', b, hpA, hpB, events)
    }

    /** Maneja triggers on_crit: heal_pct en crit */
    function handleOnCrit(tactics, buffs, triggered, actor, fighter, currentHpA, currentHpB, events) {
      for (const t of tactics) {
        if (t.combat_effect?.trigger !== 'on_crit') continue
        const eff = t.combat_effect
        if (eff.effect === 'heal_pct') {
          const healAmt = Math.round(fighter.max_hp * scaleTacticValue(eff.value ?? 0, t.level))
          if (actor === 'a') hpA = Math.min(a.max_hp, hpA + healAmt)
          else hpB = Math.min(b.max_hp, hpB + healAmt)
          events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: 'heal_on_crit', hpA, hpB })
        }
      }
    }

    /** Maneja triggers on_dodge: guaranteed_crit_next, damage_mult_next */
    function handleOnDodge(tactics, buffs, triggered, actor, currentHpA, currentHpB, events) {
      for (const t of tactics) {
        if (t.combat_effect?.trigger !== 'on_dodge') continue
        const eff = t.combat_effect
        if (eff.effect === 'damage_mult_next') {
          buffs.damage_mult_next_val = { value: scaleTacticValue(eff.value ?? 1.5, t.level), duration: 1 }
          // boost next attack via damage_mult
          buffs.damage_mult = { value: scaleTacticValue(eff.value ?? 1.5, t.level), duration: 1 }
          events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: 'damage_mult_next', hpA, hpB })
        } else if (eff.effect === 'guaranteed_crit_next') {
          buffs.guaranteed_crit_next = { value: 1, duration: 1 }
          events.push({ type: 'tactic', actor, tactic: t.name, label: t.name, icon: t.icon, effect: 'guaranteed_crit_next', hpA, hpB })
        }
      }
    }

    // Tactic: double_attack
    const tacDoubleA = hasBuff(tacticBuffsA, 'double_attack')
    const tacDoubleB = hasBuff(tacticBuffsB, 'double_attack')

    // Tactic: bonus_magic_damage / pure_magic_burst (daño puro al inicio de ataques)
    if (hasBuff(tacticBuffsA, 'bonus_magic_damage') && hpB > 0) {
      const bmg = Math.round(magicDamage(a.intelligence) * getBuff(tacticBuffsA, 'bonus_magic_damage'))
      hpB = Math.max(0, hpB - bmg)
      events.push({ type: 'tactic', actor: 'a', tactic: 'Golpe Arcano', label: 'Golpe Arcano', icon: '✨', effect: 'bonus_magic_damage', damage: bmg, hpA, hpB })
    }
    if (hasBuff(tacticBuffsA, 'pure_magic_burst') && hpB > 0) {
      const pmb = Math.round(a.intelligence * getBuff(tacticBuffsA, 'pure_magic_burst'))
      hpB = Math.max(0, hpB - pmb)
      events.push({ type: 'tactic', actor: 'a', tactic: 'Canalización Arcana', label: 'Canalización Arcana', icon: '🔮', effect: 'pure_magic_burst', damage: pmb, hpA, hpB })
    }
    if (hasBuff(tacticBuffsB, 'bonus_magic_damage') && hpA > 0) {
      const bmg = Math.round(magicDamage(b.intelligence) * getBuff(tacticBuffsB, 'bonus_magic_damage'))
      hpA = Math.max(0, hpA - bmg)
      events.push({ type: 'tactic', actor: 'b', tactic: 'Golpe Arcano', label: 'Golpe Arcano', icon: '✨', effect: 'bonus_magic_damage', damage: bmg, hpA, hpB })
    }
    if (hasBuff(tacticBuffsB, 'pure_magic_burst') && hpA > 0) {
      const pmb = Math.round(b.intelligence * getBuff(tacticBuffsB, 'pure_magic_burst'))
      hpA = Math.max(0, hpA - pmb)
      events.push({ type: 'tactic', actor: 'b', tactic: 'Canalización Arcana', label: 'Canalización Arcana', icon: '🔮', effect: 'pure_magic_burst', damage: pmb, hpA, hpB })
    }

    if (firstAttacker === 'a') {
      strikeA()
      if ((doubleA && isDoubleRound) || tacDoubleA) strikeA()
      strikeB()
      if ((doubleB && isDoubleRound) || tacDoubleB) strikeB()
    } else {
      strikeB()
      if ((doubleB && isDoubleRound) || tacDoubleB) strikeB()
      strikeA()
      if ((doubleA && isDoubleRound) || tacDoubleA) strikeA()
    }

    // Decrementar shields tras la ronda
    if (shieldA > 0) shieldA--
    if (shieldB > 0) shieldB--

    // Decrementar buffs de tácticas
    tickBuffs(tacticBuffsA)
    tickBuffs(tacticBuffsB)

    log.push({ round, events })

    // Comprobar pausa por "Momento clave"
    if (
      opts.keyMomentEnabled &&
      !pauseUsed &&
      hpA > 0 && hpB > 0 &&
      (hpA / a.max_hp <= 0.5 || hpB / b.max_hp <= 0.5)
    ) {
      return {
        paused:  true,
        rounds:  log.length,
        log,
        hpLeftA: hpA,
        hpLeftB: hpB,
        state: {
          hpA, hpB, round, log, firstAttacker,
          pauseUsed: true,
          classA, classB,
          abilityCdA, abilityCdB,
          hasAttackedA, hasAttackedB,
          shieldA, shieldB,
          dodgeA, dodgeB,
          prevStanceA, prevStanceB,
          tacticTriggeredA, tacticTriggeredB,
          tacticBuffsA, tacticBuffsB,
        },
      }
    }

    if (hpA <= 0 || hpB <= 0) break
  }

  // Empate tras 20 rondas: gana quien tenga mayor % de HP
  let winner
  if      (hpA > 0 && hpB <= 0) winner = 'a'
  else if (hpB > 0 && hpA <= 0) winner = 'b'
  else winner = (hpA / a.max_hp) >= (hpB / b.max_hp) ? 'a' : 'b'

  return {
    winner,
    rounds:  log.length,
    log,
    hpLeftA: Math.max(0, hpA),
    hpLeftB: Math.max(0, hpB),
    paused:  false,
  }
}

// Fórmulas compartidas con el frontend — fuente de verdad en gameFormulas.js
export {
  floorEnemyStats,
  floorRewards,
  floorEnemyName,
  floorEnemyArchetype,
  applyArchetype,
  ENEMY_ARCHETYPES,
  decoratedEnemyName,
} from '../src/lib/gameFormulas.js'
