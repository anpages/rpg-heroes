/**
 * Decisiones de "Momento clave" — pausa estratégica que aparece cuando un
 * combatiente baja del 50% HP en combates especiales (torre cada 5 pisos,
 * final de torneo).
 *
 * Cada decisión modifica las stats del héroe (lado A) o del enemigo (lado B)
 * para el resto del combate. La función `apply` se ejecuta en el servidor
 * dentro de /api/combat-resume después de verificar el token firmado.
 *
 * Catálogo compartido entre frontend (UI del modal) y backend (resume).
 */

export const COMBAT_DECISIONS = {
  estocada_final: {
    label:       'Estocada Final',
    description: 'Daño ×2, defensa ×0.5. Todo o nada.',
    icon:        '⚔️',
    color:       '#dc2626',
    apply: (a, b, hpA, hpB) => ({
      a: { ...a, attack: Math.round(a.attack * 2.0), defense: Math.max(1, Math.round(a.defense * 0.5)) },
      b,
      hpA,
      hpB,
    }),
  },
  defensa_ferrea: {
    label:       'Defensa Férrea',
    description: 'Defensa ×1.5 y recuperas 30% de HP.',
    icon:        '🛡️',
    color:       '#0369a1',
    apply: (a, b, hpA, hpB) => ({
      a: { ...a, defense: Math.round(a.defense * 1.5) },
      b,
      hpA: Math.min(a.max_hp, hpA + Math.round(a.max_hp * 0.30)),
      hpB,
    }),
  },
  concentracion_arcana: {
    label:       'Concentración Arcana',
    description: 'INT ×2.5, tu magia arrasa pero bajas la guardia.',
    icon:        '✨',
    color:       '#7c3aed',
    apply: (a, b, hpA, hpB) => ({
      a: { ...a, intelligence: Math.round((a.intelligence ?? 0) * 2.5), defense: Math.max(1, Math.round(a.defense * 0.7)) },
      b,
      hpA,
      hpB,
    }),
  },
  impulso_veloz: {
    label:       'Impulso Veloz',
    description: 'AGI ×2, esquiva el siguiente golpe y gana iniciativa.',
    icon:        '💨',
    color:       '#16a34a',
    apply: (a, b, hpA, hpB) => ({
      a: { ...a, agility: Math.round((a.agility ?? 0) * 2) },
      b,
      hpA,
      hpB,
    }),
  },
}

/** Opciones que se muestran al jugador en el momento clave. */
export const KEY_MOMENT_OPTIONS = ['estocada_final', 'defensa_ferrea', 'concentracion_arcana', 'impulso_veloz']

export function getDecision(key) {
  return COMBAT_DECISIONS[key] ?? null
}
