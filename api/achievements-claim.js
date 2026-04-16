import { requireAuth } from './_auth.js'

/**
 * POST /api/achievements-claim
 * Reclama la recompensa de un logro completado.
 * Body: { achievementId: string }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { achievementId } = req.body
  if (!achievementId) return res.status(400).json({ error: 'achievementId requerido' })

  const [{ data: achievement }, { data: existing }] = await Promise.all([
    supabase.from('achievements_catalog').select('*').eq('id', achievementId).single(),
    supabase.from('player_achievements').select('claimed').eq('player_id', user.id).eq('achievement_id', achievementId).maybeSingle(),
  ])

  if (!achievement) return res.status(404).json({ error: 'Logro no encontrado' })
  if (existing?.claimed) return res.status(409).json({ error: 'Logro ya reclamado' })

  // Entregar recursos (oro + fragmentos + esencia)
  const { error: resourceErr } = await supabase.rpc('add_resources', {
    p_player_id: user.id,
    p_gold:      achievement.reward_gold,
    p_fragments: achievement.reward_fragments,
    p_essence:   achievement.reward_essence,
  })
  if (resourceErr) return res.status(500).json({ error: resourceErr.message })

  // Entregar pergamino si aplica
  if ((achievement.reward_scroll ?? 0) > 0) {
    const { data: scrollRow } = await supabase
      .from('player_crafted_items')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('recipe_id', 'tactic_scroll')
      .maybeSingle()

    if (scrollRow) {
      await supabase.from('player_crafted_items')
        .update({ quantity: scrollRow.quantity + achievement.reward_scroll })
        .eq('player_id', user.id).eq('recipe_id', 'tactic_scroll')
    } else {
      await supabase.from('player_crafted_items')
        .insert({ player_id: user.id, recipe_id: 'tactic_scroll', quantity: achievement.reward_scroll })
    }
  }

  // Marcar como reclamado
  await supabase.from('player_achievements').upsert({
    player_id:      user.id,
    achievement_id: achievementId,
    completed:      true,
    claimed:        true,
    completed_at:   new Date().toISOString(),
  }, { onConflict: 'player_id,achievement_id' })

  return res.status(200).json({
    ok: true,
    rewards: {
      gold:      achievement.reward_gold,
      fragments: achievement.reward_fragments,
      essence:   achievement.reward_essence,
      scroll:    achievement.reward_scroll,
    },
  })
}
