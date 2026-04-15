import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/item-enchant
 * Aplica una runa de encantamiento a un ítem de inventario del héroe.
 * Consume 1 runa de player_crafted_items y añade el bonus a inventory_items.enchantments.
 * Body: { heroId, itemId, recipeId }
 *
 * Las runas tienen class_restrictions — solo pueden aplicarse a héroes de la clase indicada.
 * Las runas combinadas tienen múltiples efectos enchant y ocupan N slots (uno por stat).
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

  // Verificar héroe y obtener su clase
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, class')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Verificar ítem pertenece al héroe
  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, hero_id, enchantments, item_catalog(tier)')
    .eq('id', itemId)
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

  // Verificar receta y sus restricciones de clase
  const { data: recipe } = await supabase
    .from('crafting_catalog')
    .select('id, effects, class_restrictions')
    .eq('id', recipeId)
    .maybeSingle()

  if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' })

  // Validar restricción de clase
  const classRestrictions = recipe.class_restrictions
  if (Array.isArray(classRestrictions) && classRestrictions.length > 0) {
    if (!classRestrictions.includes(hero.class)) {
      const forClasses = classRestrictions.filter(c => c !== 'universal').join(', ')
      return res.status(403).json({
        error: `Esta runa solo puede usarse por: ${forClasses}`,
        code: 'CLASS_MISMATCH',
      })
    }
  }

  // Obtener todos los efectos enchant (puede ser > 1 para runas combinadas)
  const enchantEffects = (recipe.effects ?? []).filter(e => e.type === 'enchant')
  if (!enchantEffects.length) return res.status(400).json({ error: 'Esta receta no es una runa de encantamiento' })

  // Verificar cap de runas por tier (T1=1 slot, T2=2 slots, T3=3 slots)
  // Cada stat del encantamiento ocupa 1 slot; una runa combinada ocupa N slots
  const tier         = item.item_catalog?.tier ?? 1
  const currentCount = Object.values(item.enchantments ?? {}).filter(v => v > 0).length
  const slotsNeeded  = enchantEffects.length

  if (currentCount + slotsNeeded > tier) {
    const free = tier - currentCount
    return res.status(409).json({
      error: free === 0
        ? `Este ítem ya tiene el máximo de slots de runa (${tier}/${tier})`
        : `Esta runa necesita ${slotsNeeded} slot${slotsNeeded > 1 ? 's' : ''} pero solo hay ${free} libre${free > 1 ? 's' : ''}`,
    })
  }

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

  // Aplicar todos los efectos enchant (acumula sobre existentes)
  const newEnchants = { ...(item.enchantments ?? {}) }
  for (const effect of enchantEffects) {
    newEnchants[effect.stat] = (newEnchants[effect.stat] ?? 0) + effect.value
  }

  const { error: updateErr } = await supabase
    .from('inventory_items')
    .update({ enchantments: newEnchants })
    .eq('id', itemId)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({ ok: true, enchantments: newEnchants, applied: enchantEffects })
}
