import { requireAuth } from './_auth.js'
import { trainingEnemyStats, trainingEnemyName } from '../src/lib/gameFormulas.js'
import { CLASS_ARCHETYPE_POOL } from '../src/lib/gameConstants.js'
import { signCombatToken } from './_combatSign.js'
import { computeSynergy, applySynergyToStats } from '../src/lib/teamSynergy.js'
import { isUUID } from './_validate.js'

const ALL_CLASSES = ['caudillo', 'arcanista', 'sombra', 'domador']

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroIds } = req.body ?? {}
  if (!Array.isArray(heroIds) || heroIds.length !== 3) {
    return res.status(400).json({ error: 'Debes enviar 3 heroIds' })
  }
  for (const id of heroIds) {
    if (!isUUID(id)) return res.status(400).json({ error: 'heroId inválido' })
  }

  const { data: heroesRows } = await supabase
    .from('heroes')
    .select('id, level, class')
    .in('id', heroIds)
    .eq('player_id', user.id)

  if (!heroesRows || heroesRows.length !== 3) {
    return res.status(404).json({ error: 'Héroes no encontrados' })
  }

  const avgLevel = Math.max(1, Math.round(heroesRows.reduce((a, h) => a + h.level, 0) / 3))

  // Generar equipo rival: 3 clases distintas barajadas
  const shuffled = ALL_CLASSES.slice().sort(() => Math.random() - 0.5).slice(0, 3)
  const rivalSynergy = computeSynergy(shuffled)

  const enemies = shuffled.map(cls => {
    const archetypeOptions = CLASS_ARCHETYPE_POOL[cls] ?? ['berserker']
    const archetypeKey = archetypeOptions[Math.floor(Math.random() * archetypeOptions.length)]
    const base = trainingEnemyStats(avgLevel)
    base.max_hp = Math.round(base.max_hp * 1.15)
    const withSynergy = applySynergyToStats(base, rivalSynergy)
    withSynergy.max_hp = base.max_hp
    return {
      name: trainingEnemyName(avgLevel),
      class: cls,
      archetypeKey,
      stats: withSynergy,
    }
  })

  const token = signCombatToken({
    type: 'team_preview',
    userId: user.id,
    avgLevel,
    enemies,
  })

  return res.status(200).json({
    ok: true,
    token,
    enemies: enemies.map(e => ({ name: e.name, class: e.class })),
  })
}
