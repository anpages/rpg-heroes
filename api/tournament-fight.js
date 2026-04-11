import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import { getWeekStart, getAvailableRound, isAutoEliminated } from './_tournament.js'
import { isUUID } from './_validate.js'
import { interpolateHP, canPlay } from './_hp.js'
import { signCombatToken } from './_combatSign.js'
import { KEY_MOMENT_OPTIONS } from '../src/lib/combatDecisions.js'
import { finalizeTournamentFight } from './_tournamentFinalize.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, experience, level, active_effects, current_hp, max_hp, hp_last_updated_at')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // Verificar HP mínimo para combatir (20% de max_hp)
  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  if (!canPlay(currentHp, hero.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(hero.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  const weekStart = getWeekStart()

  const { data: bracket } = await supabase
    .from('tournament_brackets')
    .select('id, rivals, current_round, eliminated, champion')
    .eq('hero_id', heroId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (!bracket)           return res.status(404).json({ error: 'No estás inscrito en el torneo de esta semana' })
  if (bracket.champion)   return res.status(409).json({ error: 'Ya eres campeón de esta semana' })

  // Auto-eliminación por no presentarse a tiempo
  if (isAutoEliminated(bracket, weekStart)) {
    await supabase.from('tournament_brackets').update({ eliminated: true }).eq('id', bracket.id)
    return res.status(409).json({ error: 'Eliminado por no presentarse a la ronda a tiempo', code: 'AUTO_ELIMINATED' })
  }

  if (bracket.eliminated) return res.status(409).json({ error: 'Has sido eliminado del torneo' })

  const nextRound = bracket.current_round + 1
  if (nextRound > 3) return res.status(409).json({ error: 'Torneo completado' })

  // Verificar que hoy es el día correcto para esta ronda
  const availableRound = getAvailableRound(weekStart)
  if (availableRound !== nextRound) {
    const msg = availableRound === null
      ? 'Hoy no hay ronda de torneo disponible'
      : availableRound < nextRound
        ? 'Aún no es el momento de esta ronda'
        : 'Ya pasó la ventana de esta ronda'
    return res.status(409).json({ error: msg, code: 'WRONG_DAY' })
  }

  const rival = bracket.rivals[nextRound - 1]

  // Stats efectivas actuales del héroe
  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats' })

  // Aplicar boosts de pociones activas
  const effects = hero.active_effects ?? {}
  if (effects.atk_boost) heroStats.attack  = Math.round(heroStats.attack  * (1 + effects.atk_boost))
  if (effects.def_boost) heroStats.defense = Math.round(heroStats.defense * (1 + effects.def_boost))
  const newEffects = { ...effects }
  delete newEffects.atk_boost
  delete newEffects.def_boost

  // Bonos de investigación de combate (crit + dmg) — igual que torre y quick
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Final del torneo (ronda 3) → activa Momento clave
  const isKeyMomentRound = nextRound === 3
  const combatOpts = {
    critBonus:        rb.crit_pct,
    dmgMultiplier:    rb.tower_dmg_pct,
    keyMomentEnabled: isKeyMomentRound,
  }
  const result = simulateCombat(heroStats, rival.stats, combatOpts)

  if (result.paused) {
    const token = signCombatToken({
      type:        'tournament',
      heroId:      hero.id,
      userId:      user.id,
      bracketId:   bracket.id,
      nextRound,
      heroStats,
      rival,
      state:       result.state,
      combatOpts:  { critBonus: rb.crit_pct, dmgMultiplier: rb.tower_dmg_pct },
      newEffects,
    })
    return res.status(200).json({
      ok:          true,
      paused:      true,
      token,
      decisions:   KEY_MOMENT_OPTIONS,
      log:         result.log,
      heroHpLeft:  result.hpLeftA,
      enemyHpLeft: result.hpLeftB,
      heroMaxHp:   heroStats.max_hp,
      rivalMaxHp:  rival.stats.max_hp,
      round:       nextRound,
      rival,
    })
  }

  const finalize = await finalizeTournamentFight({
    supabase,
    user,
    hero,
    heroStats,
    rival,
    bracket,
    nextRound,
    result,
    currentHp,
    newEffects,
    nowMs,
  })

  return res.status(200).json(finalize.payload)
}
