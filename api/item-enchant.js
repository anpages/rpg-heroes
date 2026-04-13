import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/item-enchant
 * Aplica una runa de encantamiento a un ítem de inventario del héroe.
 * Consume 1 runa de player_crafted_items y añade el bonus a inventory_items.enchantments.
 * Body: { heroId, itemId, recipeId }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, itemId, recipeId } = req.body
  if (!heroId)   return res.status(400).json({ error: 'heroId requerido' })
  if (!itemId)   return res.status(400).json({ error: 'itemId requerido' })
  if (!recipeId) return res.status(400).json({ error: 'recipeId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Verificar ítem pertenece al héroe (incluye tier para calcular cap)
  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, hero_id, enchantments, item_catalog(tier)')
    .eq('id', itemId)
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

  // Verificar cap de runas por tier (T1: 1, T2: 2, T3: 3)
  const tier = item.item_catalog?.tier ?? 1
  const currentCount = Object.values(item.enchantments ?? {}).filter(v => v > 0).length
  if (currentCount >= tier) {
    return res.status(409).json({ error: `Este ítem ya tiene el máximo de runas para su tier (${tier}/${tier})` })
  }

  // Verificar receta es una runa
  const { data: recipe } = await supabase
    .from('crafting_catalog')
    .select('id, effects')
    .eq('id', recipeId)
    .maybeSingle()

  if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' })

  const enchantEffect = (recipe.effects ?? []).find(e => e.type === 'enchant')
  if (!enchantEffect) return res.status(400).json({ error: 'Esta receta no es una runa de encantamiento' })

  // Verificar stock de la runa
  const { data: stock } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', recipeId)
    .maybeSingle()

  if (!stock || stock.quantity <= 0) return res.status(409).json({ error: 'No tienes esa runa' })

  // Consumir 1 runa
  const { error: consumeErr } = await supabase
    .from('player_crafted_items')
    .update({ quantity: stock.quantity - 1 })
    .eq('player_id', user.id)
    .eq('recipe_id', recipeId)

  if (consumeErr) return res.status(500).json({ error: consumeErr.message })

  // Aplicar encantamiento (acumula sobre el existente)
  const currentEnchants = item.enchantments ?? {}
  const newEnchants = {
    ...currentEnchants,
    [enchantEffect.stat]: (currentEnchants[enchantEffect.stat] ?? 0) + enchantEffect.value,
  }

  const { error: updateErr } = await supabase
    .from('inventory_items')
    .update({ enchantments: newEnchants })
    .eq('id', itemId)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({ ok: true, enchantments: newEnchants, applied: enchantEffect })
}
