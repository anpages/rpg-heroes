/**
 * Roles y sinergia de equipo para combates 3v3 (Escuadrón).
 *
 * Fuente de verdad compartida entre frontend (preview de squad) y backend
 * (motor de combate). No debe importar nada específico de React ni de Node.
 */

// ── Roles por clase ──────────────────────────────────────────────────────────
//
// line: 'front' → recibe ataques mientras existan tanques vivos
//       'back'  → protegido por la línea frontal excepto frente a asesinos
//
export const CLASS_ROLE = {
  caudillo:  { role: 'tank',     line: 'front', label: 'Tanque' },
  sombra:    { role: 'assassin', line: 'front', label: 'Asesino' },
  arcanista: { role: 'mage',     line: 'back',  label: 'DPS mágico' },
  domador:   { role: 'ranger',   line: 'back',  label: 'DPS a distancia' },
}

export function roleForClass(className) {
  return CLASS_ROLE[className] ?? { role: 'dps', line: 'front', label: 'DPS' }
}

// ── Sinergia por diversidad de clases ────────────────────────────────────────
//
// 3 clases distintas → +15% attack/defense global
// 2 clases distintas → sin bonus ni penalty
// 1 clase            → −10% attack/defense (castigo al mono-clase)
//
export const SYNERGY = {
  diverse3: { attackPct:  0.15, defensePct:  0.15, label: 'Sinergia completa' },
  diverse2: { attackPct:  0.00, defensePct:  0.00, label: 'Sin sinergia' },
  mono:     { attackPct: -0.10, defensePct: -0.10, label: 'Formación mono-clase' },
}

export function computeSynergy(heroClasses) {
  const list = (heroClasses ?? []).filter(Boolean)
  if (list.length === 0) return { ...SYNERGY.diverse2, distinctClasses: 0, kind: 'none' }
  const distinct = new Set(list).size
  if (distinct >= 3) return { ...SYNERGY.diverse3, distinctClasses: distinct, kind: 'diverse3' }
  if (distinct === 2) return { ...SYNERGY.diverse2, distinctClasses: 2, kind: 'diverse2' }
  return { ...SYNERGY.mono, distinctClasses: 1, kind: 'mono' }
}

/**
 * Aplica el multiplicador de sinergia a un objeto de stats mutable.
 * Afecta a attack y defense (campos del motor de combate 1v1 y 3v3).
 */
export function applySynergyToStats(stats, synergy) {
  if (!stats || !synergy) return stats
  const out = { ...stats }
  if (synergy.attackPct)  out.attack  = Math.max(0, Math.round(out.attack  * (1 + synergy.attackPct)))
  if (synergy.defensePct) out.defense = Math.max(0, Math.round(out.defense * (1 + synergy.defensePct)))
  return out
}
