import { requireAuth } from './_auth.js'

/**
 * POST /api/comeback-bonus
 * Comprueba si el jugador lleva 8+ horas sin jugar y entrega un bonus escalado.
 * Solo una vez por día UTC. Siempre actualiza last_seen_at.
 *
 * Respuesta:
 *   { bonus: { gold, fragments, essence, tier } }  ← si recibe bonus
 *   { bonus: null }                                 ← si no toca
 */

const TIERS = [
  { minHours: 72, gold: 1000, fragments: 60, essence: 1, label: '3+ días' },
  { minHours: 24, gold:  600, fragments: 25, essence: 0, label: '1+ día'  },
  { minHours:  8, gold:  300, fragments:  0, essence: 0, label: '8+ horas' },
]

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const now   = new Date()
  const today = now.toISOString().slice(0, 10) // YYYY-MM-DD UTC

  // Leer estado actual del jugador
  const { data: player } = await supabase
    .from('players')
    .select('last_seen_at, comeback_claimed_date')
    .eq('id', user.id)
    .single()

  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' })

  const lastSeen        = player.last_seen_at ? new Date(player.last_seen_at) : null
  const claimedDate     = player.comeback_claimed_date   // 'YYYY-MM-DD' o null
  const hoursAway       = lastSeen ? (now - lastSeen) / 3_600_000 : 0
  const alreadyClaimed  = claimedDate === today

  // Actualizar last_seen_at siempre
  await supabase
    .from('players')
    .update({ last_seen_at: now.toISOString() })
    .eq('id', user.id)

  // Sin bonus si: primera visita, menos de 8h, o ya reclamado hoy
  if (!lastSeen || hoursAway < 8 || alreadyClaimed) {
    return res.status(200).json({ bonus: null })
  }

  // Determinar tier
  const tier = TIERS.find(t => hoursAway >= t.minHours)
  if (!tier) return res.status(200).json({ bonus: null })

  // Marcar reclamado hoy + entregar recursos
  const [{ error: updateErr }, { error: resourceErr }] = await Promise.all([
    supabase.from('players').update({ comeback_claimed_date: today }).eq('id', user.id),
    supabase.rpc('add_resources', {
      p_player_id: user.id,
      p_gold:      tier.gold,
      p_fragments: tier.fragments,
      p_essence:   tier.essence,
    }),
  ])

  if (updateErr || resourceErr) {
    console.error('comeback-bonus error:', updateErr?.message ?? resourceErr?.message)
    return res.status(500).json({ error: 'Error al entregar bonus' })
  }

  return res.status(200).json({
    bonus: {
      gold:      tier.gold,
      fragments: tier.fragments,
      essence:   tier.essence,
      label:     tier.label,
    },
  })
}
