import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import { interpolateHP, canPlay } from './_hp.js'
import { getWeekStart, tournamentRoundRewards } from './_tournament.js'
import { isUUID, safeMinutes } from './_validate.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  if (!canPlay(currentHp, hero.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(hero.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  // Obtener bracket activo de la semana
  const weekStart = getWeekStart()
  const { data: bracket } = await supabase
    .from('tournament_brackets')
    .select('id, rivals, current_round, eliminated, champion')
    .eq('hero_id', heroId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (!bracket)          return res.status(404).json({ error: 'No estás inscrito en el torneo de esta semana' })
  if (bracket.eliminated) return res.status(409).json({ error: 'Has sido eliminado del torneo' })
  if (bracket.champion)   return res.status(409).json({ error: 'Ya eres campeón de esta semana' })

  const nextRound = bracket.current_round + 1
  if (nextRound > 3) return res.status(409).json({ error: 'Torneo completado' })

  const rival = bracket.rivals[nextRound - 1]

  // Stats efectivas del héroe
  const heroStats = await getEffectiveStats(supabase, hero.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats' })

  // Simular combate
  const result  = simulateCombat(heroStats, rival.stats)
  const won     = result.winner === 'a'
  const champion = won && nextRound === 3

  // Deducir HP (igual que la Torre)
  const damageTaken    = heroStats.max_hp - result.hpLeftA
  const hpAfterCombat  = Math.max(0, currentHp - damageTaken)
  const knockedOut     = hpAfterCombat === 0

  await supabase
    .from('heroes')
    .update({ current_hp: hpAfterCombat, hp_last_updated_at: new Date(nowMs).toISOString() })
    .eq('id', hero.id)

  // Actualizar bracket
  await supabase
    .from('tournament_brackets')
    .update({
      current_round: won ? nextRound : bracket.current_round,
      eliminated:    !won,
      champion,
    })
    .eq('id', bracket.id)

  // Recompensas si gana
  let rewards = null
  if (won) {
    rewards = tournamentRoundRewards(nextRound, champion)

    const { data: resources } = await supabase
      .from('resources')
      .select('gold, gold_rate, last_collected_at, mana, mana_rate')
      .eq('player_id', user.id)
      .single()

    if (resources) {
      const goldNow = Math.floor(resources.gold + resources.gold_rate * safeMinutes(resources.last_collected_at, nowMs))
      const manaNow = Math.floor(resources.mana + resources.mana_rate * safeMinutes(resources.last_collected_at, nowMs))
      await supabase
        .from('resources')
        .update({
          gold: goldNow + rewards.gold,
          mana: manaNow + (rewards.mana ?? 0),
          last_collected_at: new Date(nowMs).toISOString(),
        })
        .eq('player_id', user.id)
    }

    const newXp      = hero.experience + rewards.experience
    const xpForLevel = hero.level * 150
    const levelUp    = newXp >= xpForLevel
    await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level:      levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)
    rewards.levelUp = levelUp

    // Carta garantizada al ganar el torneo
    if (champion && rewards.cardGuaranteed) {
      const { data: cards } = await supabase
        .from('skill_cards')
        .select('id')
        .order('id')
        .limit(20)
      if (cards?.length) {
        const card = cards[Math.floor(Math.random() * cards.length)]
        const { data: existing } = await supabase
          .from('hero_cards')
          .select('id, rank')
          .eq('hero_id', heroId)
          .eq('card_id', card.id)
          .maybeSingle()
        if (existing) {
          await supabase.from('hero_cards').update({ rank: Math.min(20, existing.rank + 1) }).eq('id', existing.id)
        } else {
          await supabase.from('hero_cards').insert({ hero_id: heroId, card_id: card.id, rank: 1 })
        }
        rewards.card = card
      }
    }
  }

  // Guardar match
  await supabase.from('tournament_matches').insert({
    bracket_id:   bracket.id,
    round:        nextRound,
    won,
    log:          result.log,
    rewards:      rewards ?? null,
    hero_max_hp:  heroStats.max_hp,
    rival_max_hp: rival.stats.max_hp,
  })

  return res.status(200).json({
    ok: true,
    won,
    round:        nextRound,
    champion,
    eliminated:   !won,
    log:          result.log,
    heroMaxHp:    heroStats.max_hp,
    rivalMaxHp:   rival.stats.max_hp,
    rival,
    rewards,
    knockedOut,
    heroCurrentHp: hpAfterCombat,
  })
}
