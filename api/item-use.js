import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { interpolateHP } from './_hp.js'
import { getEffectiveStats } from './_stats.js'

/**
 * POST /api/item-use
 * Usa un item consumible (poción, elixir, etc.) desde player_crafted_items.
 * Lee effects desde crafting_catalog.effects JSONB.
 * Body: { heroId: uuid, recipeId: string }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, recipeId } = req.body
  if (!heroId)   return res.status(400).json({ error: 'heroId requerido' })
  if (!recipeId) return res.status(400).json({ error: 'recipeId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, max_hp, current_hp, hp_last_updated_at, status, active_effects')
    .eq('id', heroId)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en expedición' })

  // Verificar item en catálogo
  const { data: recipe } = await supabase
    .from('crafting_catalog')
    .select('id, effects')
    .eq('id', recipeId)
    .single()

  if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' })
  if (!recipe.effects || recipe.effects.length === 0) {
    return res.status(400).json({ error: 'Este item no es consumible' })
  }

  // Verificar inventario
  const { data: stock } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', recipeId)
    .maybeSingle()

  if (!stock || stock.quantity <= 0) return res.status(409).json({ error: 'No tienes ese item' })

  // Descontar del inventario
  const { error: deductError } = await supabase
    .from('player_crafted_items')
    .update({ quantity: stock.quantity - 1 })
    .eq('player_id', user.id)
    .eq('recipe_id', recipeId)

  if (deductError) return res.status(500).json({ error: deductError.message })

  // Aplicar efectos
  const heroUpdate = {}
  const result = {}
  const effects = recipe.effects

  // Separar hp_restore de boosts
  const hpEffect = effects.find(e => e.type === 'hp_restore')
  const boostEffects = effects.filter(e => e.type !== 'hp_restore')

  if (hpEffect) {
    const effStats = await getEffectiveStats(supabase, hero.id, user.id)
    const maxHp = effStats?.max_hp ?? hero.max_hp ?? 100
    const hpNow = interpolateHP(hero, Date.now(), maxHp)
    const restored = Math.round(maxHp * hpEffect.value)
    const newHp = Math.min(maxHp, hpNow + restored)
    heroUpdate.current_hp = newHp
    heroUpdate.hp_last_updated_at = new Date().toISOString()
    result.restored = restored
    result.newHp = newHp
  }

  if (boostEffects.length > 0) {
    const activeEffects = { ...(hero.active_effects ?? {}) }
    for (const eff of boostEffects) {
      activeEffects[eff.type] = eff.value
    }
    heroUpdate.active_effects = activeEffects
    result.effects = boostEffects
  }

  const { error: updateError } = await supabase
    .from('heroes')
    .update(heroUpdate)
    .eq('id', heroId)

  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.status(200).json({ ok: true, ...result })
}
