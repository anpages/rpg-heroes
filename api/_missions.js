/**
 * Pool de misiones diarias y helpers de progreso.
 * MISSION_POOL vive en src/lib/missionPool.js (compartido con el frontend).
 * Aquí solo mantenemos las funciones de servidor.
 */

// Redefinido aquí para no depender de src/ desde el servidor
const MISSION_POOL = [
  { type: 'expeditions_complete', targets: [2, 3, 5],        rewards: [{ gold: 150, mana:  0, xp:  80 }, { gold: 300, mana: 10, xp: 150 }, { gold: 600, mana: 25, xp: 300 }] },
  { type: 'gold_earn',            targets: [300, 600, 1200],  rewards: [{ gold: 100, mana:  0, xp:  60 }, { gold: 200, mana: 15, xp: 120 }, { gold: 400, mana: 30, xp: 250 }] },
  { type: 'xp_earn',              targets: [200, 500, 1000],  rewards: [{ gold: 120, mana:  0, xp:  50 }, { gold: 250, mana: 10, xp: 100 }, { gold: 500, mana: 25, xp: 200 }] },
  { type: 'tower_attempt',        targets: [1, 2, 3],         rewards: [{ gold: 200, mana: 20, xp: 100 }, { gold: 350, mana: 35, xp: 180 }, { gold: 500, mana: 50, xp: 300 }] },
  { type: 'dungeon_type_combat',  targets: [1, 2, 3],         rewards: [{ gold: 180, mana:  0, xp:  90 }, { gold: 350, mana: 10, xp: 180 }, { gold: 600, mana: 20, xp: 350 }] },
  { type: 'dungeon_type_magic',   targets: [1, 2, 3],         rewards: [{ gold: 150, mana: 30, xp:  80 }, { gold: 300, mana: 60, xp: 150 }, { gold: 500, mana: 100, xp: 280 }] },
  { type: 'dungeon_type_wilderness', targets: [1, 2, 3],      rewards: [{ gold: 160, mana: 10, xp:  80 }, { gold: 320, mana: 20, xp: 160 }, { gold: 550, mana: 40, xp: 300 }] },
  { type: 'item_drop',            targets: [1, 2, 3],         rewards: [{ gold: 200, mana:  0, xp: 100 }, { gold: 400, mana:  0, xp: 200 }, { gold: 700, mana:  0, xp: 400 }] },
]

/** Genera 3 misiones aleatorias para hoy sin repetir tipo. */
export function generateMissions(playerId, dateStr) {
  // Seed determinista por jugador+fecha para reproducibilidad
  let seed = 0
  for (const ch of `${playerId}-${dateStr}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0

  function rand() {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5
    return (seed >>> 0) / 0xffffffff
  }

  const pool = [...MISSION_POOL]
  const selected = []

  while (selected.length < 3 && pool.length > 0) {
    const idx = Math.floor(rand() * pool.length)
    const def = pool.splice(idx, 1)[0]
    const tier = Math.floor(rand() * 3) // 0, 1 o 2
    const target = def.targets[tier]
    const reward = def.rewards[tier]
    selected.push({
      player_id:    playerId,
      date:         dateStr,
      type:         def.type,
      tier,
      target_value: target,
      reward_gold:  reward.gold,
      reward_mana:  reward.mana,
      reward_xp:    reward.xp,
    })
  }

  return selected
}

/**
 * Progresa misiones activas de un tipo para un jugador.
 * Llamar desde expedition-collect, tower-attempt, etc.
 */
export async function progressMissions(supabase, playerId, type, amount = 1) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: missions } = await supabase
    .from('daily_missions')
    .select('id, current_value, target_value')
    .eq('player_id', playerId)
    .eq('date', today)
    .eq('type', type)
    .eq('completed', false)

  if (!missions?.length) return

  for (const m of missions) {
    const newVal = Math.min(m.target_value, m.current_value + amount)
    const completed = newVal >= m.target_value
    await supabase
      .from('daily_missions')
      .update({ current_value: newVal, completed })
      .eq('id', m.id)
  }
}
