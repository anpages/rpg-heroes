import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Clasificación 3v3: agrupa los héroes por jugador, toma los 3 con mayor rating
 * de cada uno y los ordena por rating medio del trío. Solo entran jugadores con
 * al menos 3 héroes (los que pueden formar escuadrón).
 */
export function useTeamRanking() {
  const { data: ranking = [], isLoading: loading } = useQuery({
    queryKey: ['team-ranking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('heroes')
        .select('player_id, name, class, combat_rating, players(username)')
        .order('combat_rating', { ascending: false })
        .limit(500)
      if (error) throw error

      const byPlayer = new Map()
      for (const h of data ?? []) {
        if (!byPlayer.has(h.player_id)) {
          byPlayer.set(h.player_id, { playerId: h.player_id, username: h.players?.username ?? null, heroes: [] })
        }
        byPlayer.get(h.player_id).heroes.push(h)
      }

      const entries = []
      for (const p of byPlayer.values()) {
        if (p.heroes.length < 3) continue
        const top3  = p.heroes.slice(0, 3)
        const avg   = top3.reduce((a, h) => a + (h.combat_rating ?? 0), 0) / 3
        const total = top3.reduce((a, h) => a + (h.combat_rating ?? 0), 0)
        entries.push({
          playerId: p.playerId,
          username: p.username,
          heroes:   top3,
          avg:      Math.round(avg),
          total,
        })
      }
      entries.sort((a, b) => b.avg - a.avg)
      return entries
    },
    staleTime: 60_000,
  })

  return { ranking, loading }
}
