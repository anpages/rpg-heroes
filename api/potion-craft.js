import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { MAX_POTION_STACK, POTION_CRAFT_DURATION_MS } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, potionId } = req.body
  if (!heroId)   return res.status(400).json({ error: 'heroId requerido' })
  if (!potionId) return res.status(400).json({ error: 'potionId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Verificar que no haya un crafteo en curso
  const { data: activeCraft } = await supabase
    .from('potion_crafting')
    .select('potion_id, craft_ends_at')
    .eq('hero_id', heroId)
    .single()

  if (activeCraft && new Date(activeCraft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'Ya hay una poción en proceso. Espera a que termine.' })
  }

  // Obtener receta
  const { data: potion } = await supabase
    .from('potion_catalog')
    .select('*')
    .eq('id', potionId)
    .single()

  if (!potion) return res.status(404).json({ error: 'Poción no encontrada' })

  // Verificar nivel del Laboratorio
  const { data: lab } = await supabase
    .from('buildings')
    .select('level, unlocked')
    .eq('player_id', user.id)
    .eq('type', 'laboratory')
    .single()

  if (!lab || !lab.unlocked) return res.status(403).json({ error: 'El Laboratorio no está desbloqueado' })
  if (lab.level < potion.min_lab_level) return res.status(403).json({ error: `Requiere Laboratorio Nv.${potion.min_lab_level}` })

  // Verificar stack actual
  const { data: existing } = await supabase
    .from('hero_potions')
    .select('quantity')
    .eq('hero_id', heroId)
    .eq('potion_id', potionId)
    .single()

  const currentQty = existing?.quantity ?? 0
  if (currentQty >= MAX_POTION_STACK) {
    return res.status(409).json({ error: `Ya tienes el máximo (${MAX_POTION_STACK}) de esta poción` })
  }

  // Verificar y descontar recursos
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)

  if (snap.gold < potion.recipe_gold) return res.status(402).json({ error: 'Oro insuficiente' })
  if (snap.wood < potion.recipe_wood) return res.status(402).json({ error: 'Madera insuficiente' })
  if (snap.mana < potion.recipe_mana) return res.status(402).json({ error: 'Maná insuficiente' })

  const craftEndsAt = new Date(Date.now() + POTION_CRAFT_DURATION_MS).toISOString()

  const [resourcesResult, craftResult] = await Promise.all([
    supabase.from('resources').update({
      gold: snap.gold - potion.recipe_gold,
      iron: snap.iron,
      wood: snap.wood - potion.recipe_wood,
      mana: snap.mana - potion.recipe_mana,
      last_collected_at: snap.nowIso,
    }).eq('player_id', user.id),

    supabase.from('potion_crafting').upsert(
      { hero_id: heroId, potion_id: potionId, craft_ends_at: craftEndsAt },
      { onConflict: 'hero_id' }
    ),
  ])

  if (resourcesResult.error) return res.status(500).json({ error: resourcesResult.error.message })
  if (craftResult.error)    return res.status(500).json({ error: craftResult.error.message })

  return res.status(200).json({ ok: true, craft_ends_at: craftEndsAt })
}
