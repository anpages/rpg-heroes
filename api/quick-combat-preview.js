import { requireAuth } from './_auth.js'
import { trainingEnemyName, CLASS_TO_ARCHETYPE } from '../src/lib/gameFormulas.js'
import { isUUID } from './_validate.js'
import { signCombatToken } from './_combatSign.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)          return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId))  return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, class, level, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // El enemigo siempre es de la misma clase que el héroe (combate espejo).
  // El arquetipo se usa solo para tácticas, estrategia y nombre decorado.
  const enemyClass   = hero.class
  const archetypeKey = CLASS_TO_ARCHETYPE[hero.class] ?? 'tank'
  const enemyName    = trainingEnemyName(hero.level ?? 1)

  const token = signCombatToken({
    type:        'quick_preview',
    userId:      user.id,
    archetypeKey,
    enemyClass,
    enemyName,
  })

  return res.status(200).json({ ok: true, token, enemyName, enemyClass, enemyArchetype: archetypeKey })
}
