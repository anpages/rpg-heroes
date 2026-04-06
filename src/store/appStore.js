import { create } from 'zustand'

/**
 * Estado global de UI.
 * Todo lo que no es datos del servidor vive aquí.
 * Los datos del servidor van en TanStack Query.
 */
export const useAppStore = create((set) => ({
  // ── Auth ──────────────────────────────────────────────────────
  userId: null,
  setUserId: (id) => set({ userId: id }),

  // ── Héroe seleccionado ────────────────────────────────────────
  // null → se usa el primero de la lista (heroes[0])
  selectedHeroId: null,
  setSelectedHeroId: (id) => set({ selectedHeroId: id }),

  // ── Navegación ────────────────────────────────────────────────
  activeSection: 'heroe',
  mountedSections: new Set(['heroe']),
  navigateTo: (section) => set((state) => ({
    activeSection: section,
    mountedSections: new Set([...state.mountedSections, section]),
  })),

  // ── Drawers / modales ─────────────────────────────────────────
  missionsOpen:  false,
  setMissionsOpen:  (open) => set({ missionsOpen: open }),

  recruitOpen:   false,
  setRecruitOpen:   (open) => set({ recruitOpen: open }),
}))
