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

  // ── Navegación principal ──────────────────────────────────────
  // Tabs: inicio | heroes | base | mundo
  activeTab: 'base',
  mountedTabs: new Set(['base', 'heroes', 'heroes:ficha']),

  // Sub-tab de Héroes: ficha | expediciones
  activeHeroTab: 'ficha',

  // Sub-tab de Mundo: torre | torneos | clasificacion | historial
  activeWorldTab: 'torre',

  navigateTo: (tab, opts = {}) => set((state) => {
    const next = {
      activeTab: tab,
      mountedTabs: new Set([...state.mountedTabs, tab]),
    }
    // Auto-mount el sub-tab activo al visitar heroes/mundo por primera vez
    if (tab === 'heroes') {
      const heroTab = opts.heroTab ?? state.activeHeroTab
      next.activeHeroTab = heroTab
      next.mountedTabs.add(`heroes:${heroTab}`)
    }
    if (tab === 'mundo') {
      const worldTab = opts.worldTab ?? state.activeWorldTab
      next.activeWorldTab = worldTab
      next.mountedTabs.add(`mundo:${worldTab}`)
    }
    return next
  }),

  navigateToHeroTab: (heroTab) => set((state) => ({
    activeTab: 'heroes',
    activeHeroTab: heroTab,
    mountedTabs: new Set([...state.mountedTabs, 'heroes', `heroes:${heroTab}`]),
  })),

  navigateToWorldTab: (worldTab) => set((state) => ({
    activeTab: 'mundo',
    activeWorldTab: worldTab,
    mountedTabs: new Set([...state.mountedTabs, 'mundo', `mundo:${worldTab}`]),
  })),

  // ── Drawers / modales ─────────────────────────────────────────
  missionsOpen:  false,
  setMissionsOpen:  (open) => set({ missionsOpen: open }),

  recruitOpen:   false,
  setRecruitOpen:   (open) => set({ recruitOpen: open }),

  shopOpen: false,
  setShopOpen: (open) => set({ shopOpen: open }),

  // ── Flash de recursos (expedición/torre/torneo) ───────────────
  resourceFlashAt: 0,
  triggerResourceFlash: () => set({ resourceFlashAt: Date.now() }),
}))
