import { createClient } from '@supabase/supabase-js'

// Slots de cartas equipadas según nivel de biblioteca
function cardSlots(libraryLevel) {
  return 1 + libraryLevel * 2  // nivel 1 = 3, nivel 2 = 5, etc.
}

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

  const { cardId, equip } = req.body
  if (!cardId || equip === undefined) return res.status(400).json({ error: 'cardId y equip requeridos' })

  // Obtener carta con datos del catálogo
  const { data: heroCard } = await supabase
    .from('hero_cards')
    .select('*, skill_cards(*)')
    .eq('id', cardId)
    .single()

  if (!heroCard) return res.status(404).json({ error: 'Carta no encontrada' })

  // Verificar propiedad
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, strength, agility, intelligence')
    .eq('id', heroCard.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // ── DESEQUIPAR ────────────────────────────────────────────────────────────
  if (!equip) {
    if (!heroCard.equipped) return res.status(409).json({ error: 'La carta no está equipada' })
    await supabase.from('hero_cards').update({ equipped: false }).eq('id', cardId)
    return res.status(200).json({ ok: true })
  }

  // ── EQUIPAR ───────────────────────────────────────────────────────────────
  if (heroCard.equipped) return res.status(409).json({ error: 'La carta ya está equipada' })

  const sc = heroCard.skill_cards
  const category = sc.category
  const thisCost = sc.base_cost * heroCard.rank

  // Verificar slots disponibles en biblioteca
  const { data: library } = await supabase
    .from('buildings')
    .select('level')
    .eq('player_id', user.id)
    .eq('type', 'library')
    .maybeSingle()

  const maxSlots = cardSlots(library?.level ?? 1)

  const { data: allEquipped } = await supabase
    .from('hero_cards')
    .select('id, rank, skill_cards(category, base_cost)')
    .eq('hero_id', hero.id)
    .eq('equipped', true)

  if ((allEquipped?.length ?? 0) >= maxSlots) {
    return res.status(409).json({ error: `Slots llenos (máx ${maxSlots}). Mejora la Biblioteca para equipar más cartas.` })
  }

  // Verificar presupuesto de la categoría (usa stats base del héroe, no efectivas)
  const budget = hero[category] // hero.strength | hero.agility | hero.intelligence
  const usedBudget = (allEquipped ?? [])
    .filter(c => c.skill_cards.category === category)
    .reduce((sum, c) => sum + c.skill_cards.base_cost * c.rank, 0)

  if (usedBudget + thisCost > budget) {
    return res.status(409).json({
      error: `Presupuesto de ${category} insuficiente (usas ${usedBudget + thisCost}, tienes ${budget}). Mejora el Cuartel.`,
    })
  }

  await supabase.from('hero_cards').update({ equipped: true }).eq('id', cardId)
  return res.status(200).json({ ok: true })
}
