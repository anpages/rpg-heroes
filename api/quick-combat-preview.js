import { requireAuth } from './_auth.js'
import { trainingEnemyName } from '../src/lib/gameFormulas.js'
import { CLASS_ARCHETYPE_POOL } from '../src/lib/gameConstants.js'
import { signCombatToken } from './_combatSign.js'

const FALLBACK_CLASS = 'caudillo'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  // Pool de clases: todas las clases que el jugador tiene desbloqueadas
  const { data: allHeroes } = await supabase
    .from('heroes').select('class, level').eq('player_id', user.id)
  if (!allHeroes?.length) return res.status(404).json({ error: 'No tienes héroes' })

  const unlockedClasses = [...new Set(allHeroes.map(h => h.class).filter(Boolean))]
  const classPool = unlockedClasses.length > 0 ? unlockedClasses : [FALLBACK_CLASS]

  // Clase y arquetipo del rival — aleatorios del pool del jugador
  const enemyClass      = classPool[Math.floor(Math.random() * classPool.length)]
  const archetypeOptions = CLASS_ARCHETYPE_POOL[enemyClass] ?? ['berserker']
  const archetypeKey    = archetypeOptions[Math.floor(Math.random() * archetypeOptions.length)]

  // Nombre basado en el nivel medio de los héroes del jugador
  const avgLevel = Math.round(allHeroes.reduce((s, h) => s + (h.level ?? 1), 0) / allHeroes.length)
  const enemyName = trainingEnemyName(avgLevel)

  const token = signCombatToken({
    type:        'quick_preview',
    userId:      user.id,
    archetypeKey,
    enemyClass,
    enemyName,
  })

  return res.status(200).json({ ok: true, token, enemyName, enemyClass })
}
