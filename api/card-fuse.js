import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { cardId1, cardId2 } = req.body
  if (!cardId1 || !cardId2 || cardId1 === cardId2) {
    return res.status(400).json({ error: 'Se necesitan dos cartas distintas para fusionar' })
  }
  if (!isUUID(cardId1) || !isUUID(cardId2)) {
    return res.status(400).json({ error: 'IDs de carta inválidos' })
  }

  // Obtener ambas cartas
  const { data: cards } = await supabase
    .from('hero_cards')
    .select('*, skill_cards(name, base_mana_fuse)')
    .in('id', [cardId1, cardId2])
    .is('slot_index', null)

  if (!cards || cards.length !== 2) return res.status(404).json({ error: 'Cartas no encontradas' })

  const [c1, c2] = cards

  // Validaciones
  if (c1.card_id !== c2.card_id)  return res.status(409).json({ error: 'Las cartas deben ser del mismo tipo' })
  if (c1.rank    !== c2.rank)                   return res.status(409).json({ error: 'Las cartas deben ser del mismo rango' })
  if (c1.rank >= 5)                             return res.status(409).json({ error: 'Rango máximo alcanzado (V)' })
  if (c1.slot_index !== null || c2.slot_index !== null) return res.status(409).json({ error: 'Desequipa las cartas antes de fusionarlas' })

  // Verificar propiedad (ambas del mismo héroe del usuario)
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', c1.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id || c1.hero_id !== c2.hero_id) {
    return res.status(403).json({ error: 'No autorizado' })
  }

  // Coste en maná: base_mana_fuse × 2^(rank-1), reducido por investigación fusion_cost_pct
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)
  const baseMana = c1.skill_cards.base_mana_fuse * Math.pow(2, c1.rank - 1)
  const manaCost = Math.max(1, Math.round(baseMana * (1 + rb.fusion_cost_pct)))

  const { data: resources } = await supabase
    .from('resources')
    .select('iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'No se pudieron obtener los recursos' })

  const snap = snapshotResources(resources)

  if (snap.mana < manaCost) {
    return res.status(409).json({ error: `Maná insuficiente (necesitas ${manaCost})` })
  }

  // Fusionar: eliminar ambas atómicamente (re-validar que siguen existiendo)
  const { data: deleted } = await supabase
    .from('hero_cards')
    .delete()
    .in('id', [cardId1, cardId2])
    .select('id')
  if (!deleted || deleted.length !== 2) {
    return res.status(409).json({ error: 'Las cartas ya no están disponibles' })
  }

  const { data: newCard } = await supabase
    .from('hero_cards')
    .insert({ hero_id: hero.id, card_id: c1.card_id, rank: c1.rank + 1, slot_index: null })
    .select('*, skill_cards(*)')
    .single()

  const { error: resErr, count: resCount } = await supabase
    .from('resources')
    .update({ iron: snap.iron, wood: snap.wood, mana: snap.mana - manaCost, last_collected_at: snap.nowIso })
    .eq('player_id', user.id)
    .eq('last_collected_at', snap.prevCollectedAt)

  if (resErr) return res.status(500).json({ error: resErr.message })
  if (resCount === 0) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })

  return res.status(200).json({ ok: true, newCard, manaCost })
}
