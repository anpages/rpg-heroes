# RPG Legends

Juego RPG idle/activo en navegador. Dominio: **rpglegends.net**. Comunidad: r/RPGLegendsnet.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4 + Framer Motion + Zustand (UI state) + TanStack Query (server state)
- **Backend**: Vercel Serverless Functions (Node.js, directorio `api/`)
- **Base de datos**: Supabase (PostgreSQL) con Realtime activado
- **Auth**: Supabase Auth
- **Notificaciones**: Sonner, envuelto en `src/lib/notifications.js` — usar siempre `notify.*`, nunca importar sonner directamente
- **PWA**: vite-plugin-pwa (offline, auto-update, installable)

## Comandos

```bash
npm run dev          # Vite dev server en puerto 5173
npm run build        # Lint + build
npx supabase db push # Aplicar migraciones (SIEMPRE lo aplico yo, nunca el usuario)
```

## Estructura del proyecto

```
api/                          # Serverless functions (Vercel)
  _auth.js                    # Middleware de autenticación
  _combat.js                  # Motor de combate
  _combatMath.js, _combatSign.js
  _constants.js               # Re-exporta gameConstants (incl. HERO_SLOT_CLASS)
  _enemyTactics.js            # IA enemiga (pools por arquetipo)
  _hp.js                      # Interpolación HP idle
  _loot.js                    # Tablas de loot (incl. rollTacticDrop con prestige nivel 6)
  _missions.js                # Generación de misiones + pool con recompensas reales
  _research.js                # Lógica de investigación
  _stats.js                   # Stats efectivas del héroe (durabilidad, peso, equipo, encantamientos)
  _validate.js                # Validación de inputs
  achievements.js             # GET logros con progreso calculado en tiempo real
  achievements-claim.js       # POST reclamar logro completado
  building-*.js               # Edificios: collect, upgrade
  comeback-bonus.js           # POST bonus de regreso (8h/24h/72h, 1 vez/día)
  expedition-*.js             # Expediciones a mazmorras
  hero-*.js                   # Reclutar (unlock slot), renombrar, descansar
  item-*.js                   # Equipar, reparar, desmantelar, transmutar, upgrade, usar
  item-enchant.js             # Aplicar runas de encantamiento a ítems
  refining-*.js               # Slots de laboratorio: start, collect, collect-all
  lab-inventory-upgrade.js    # Ampliar inventario lab
  missions-*.js               # Obtener/reclamar misiones (con fragmentos/esencia/pergamino)
  research-*.js               # Investigación
  tactic-*.js                 # Tácticas: equipar/desequipar/levelup
  tower-attempt.js            # Intento de piso de torre
  training-*.js               # Entrenamiento: asignar, recoger, salas
  bag-upgrade.js, onboarding.js

src/
  pages/
    Dashboard.jsx             # Hub principal: tabs, sidebar, modales
    LoginPage.jsx             # Login (siempre dark)
    Onboarding.jsx            # Setup: solo nombre, clase fija (Caudillo slot 1)

  sections/
    Base.jsx                  # Gestión de base
    Hero.jsx                  # Ficha del héroe
    Equipo.jsx                # Inventario y equipamiento
    Tacticas.jsx              # Sistema de tácticas (5 slots)
    Dungeons.jsx              # Expediciones a mazmorras
    Torre.jsx                 # Torre progresiva (1v1)
    Combates.jsx              # Hub de combate (sub-tabs: Torre, Historial, Clasificación)
    CombatHistorial.jsx       # Historial de combate
    Ranking.jsx               # Clasificación: nivel, clase, piso torre, winrate
    Misiones.jsx              # Misiones diarias con recompensas reales
    Logros.jsx                # Sistema de logros (24 logros, 5 categorías)
    Entrenamiento.jsx         # Salas de entrenamiento
    base/                     # Sub-secciones de Base (zonas, cards, modales)
      RecursosZone.jsx        # Edificios de producción
      TallerZone.jsx          # Laboratorio (crafteo)
      EntrenamientoZone.jsx   # Salas de entrenamiento
      BibliotecaZone.jsx      # Árbol de investigación

  hooks/                      # TanStack Query hooks para cada entidad
    useRealtimeSync.js        # Supabase Realtime centralizado con guards de mutación
    useComebackBonus.js       # Llamada única al montar Dashboard
    useAchievements.js        # Logros con progreso
    useRanking.js             # Clasificación global
  lib/
    gameConstants.js           # FUENTE ÚNICA de constantes de balance + HERO_SLOT_CLASS
    gameFormulas.js            # Fórmulas compartidas frontend/backend
    notifications.js           # Wrapper notify.* sobre sonner
    supabase.js                # Cliente Supabase
    queryClient.js             # Config TanStack Query
    queryKeys.js               # Factory de query keys
    api.js                     # Utilidades de fetch
    combatAbilities.js         # Habilidades por clase (incl. universal)
    combatDecisions.js         # IA de decisiones de combate
    hpInterpolation.js         # Interpolación HP idle
    missionPool.js             # Pool de misiones (sincronizado con _missions.js)
    teamSynergy.js             # Sinergias de equipo

  components/                  # Componentes reutilizables (modales, combat replay, etc.)
  store/appStore.js            # Zustand: tabs, modales, hero seleccionado

supabase/migrations/           # ~130 migraciones SQL
```

## Navegación

- **Base** — Zonas: Producción, Laboratorio, Entrenamiento, Biblioteca
- **Héroes** — Sub-tabs: Ficha, Equipo, Tácticas, Expediciones
- **Combates** — Sub-tabs: Torre (PvE infinita), Historial, Clasificación
- **Arena** — Placeholder "Próximamente" (PvP futuro)
- **Logros** — 24 logros en 5 categorías con recompensas reclamables

## Sistemas del juego

### Economía de recursos
- **Producción idle**: lumber_mill (madera), gold_mine (hierro), herb_garden (hierbas), mana_well (maná)
- **Orden en UI y prioridad**: aserradero → mina → hierbas → pozo de maná
- **El aserradero es el edificio principal** — siempre llena más rápido que la mina en cada nivel
- **wood/iron/mana/herbs NUNCA salen de drops de actividad** — solo de edificios productores
- **gold/fragments/essence** sí pueden ser loot de actividad
- **essence** exclusiva de mazmorras tipo `ancient` (dificultad 6+ de cada clase)
- **fragments** de mazmorras tipo `mine` y `crypt`
- **Iconos estándar**: fragmentos = `Sparkles` (#f59e0b), esencia = `Droplets` (#8b5cf6) — usar SIEMPRE estos en toda la UI

### Producción idle — caps fijos por edificio
- Recoger solo cuando el almacén está **lleno**. Cap fijo → a mayor nivel, menos tiempo para llenar.
- `lumber_mill`: cap=60 madera → L1: 3h20m, L5: 49m ← **recurso principal, más rápido que mina**
- `gold_mine`: cap=48 hierro → L1: 4h, L5: 1h
- `herb_garden`: cap=56 hierbas → L1: 5h5m, L5: 1h25m (~25% más lento que mina)
- `mana_well`: cap=102 maná → L1: 6h, L5: 1h27m (recurso escaso, ritmo lento)
- Spread entre aserradero y maná: ~1.8× constante en todos los niveles
- RPC: `collect_building_production` y `collect_all_buildings_production` (solo si lleno)
- Mejora del jardín (L2+) requiere también hierbas: L2→L3: 24, L3→L4: 36, L4→L5: 48

### Héroes
- **5 clases**: Caudillo, Sombra, Arcanista, Domador, Universal
- **Clase fija por slot** — `HERO_SLOT_CLASS` en `gameConstants.js` es la fuente de verdad
- **Desbloqueo progresivo** por nivel de base: Caudillo(Nv1), Sombra(Nv3), Arcanista(Nv5), Domador(Nv7), Universal(Nv10)
- **No hay elección de clase** en onboarding ni en recruit — la clase viene del slot
- Stats base: strength, agility, intelligence → derivadas: HP, attack, defense
- Entrenamiento en 6 salas (strength, agility, attack, defense, max_hp, intelligence)

### Equipamiento
- 7 slots: helmet, chest, arms, legs, main_hand, off_hand, accessory
- Rareza: Common → Uncommon → Rare → Epic → Legendary
- Durabilidad proporcional a bonos (50% dur → 50% stats)
- Peso penaliza agilidad: `floor(totalWeight / 4)`
- Torre reduce durabilidad: 1pt (1-10), 2pt (11-25), 3pt (26-40), 4pt (41+)
- Desmantelar da oro: common:10, uncommon:25, rare:60, epic:150, legendary:400
- **Reparación**: cuesta oro directamente (sin kits). RPC `deduct_resources`.
- **Encantamientos**: columna `inventory_items.enchantments` (JSONB). Escalan por durabilidad igual que bonos base.
- **Items solo de drops** — no hay tienda de equipo. La tienda fue eliminada.

### Runas de encantamiento
- 6 tipos: rune_attack (+10 ATQ), rune_defense (+10 DEF), rune_hp (+80 HP), rune_strength (+8 FUE), rune_agility (+8 AGI), rune_intelligence (+8 INT)
- Cap por tier del ítem: T1=1 runa, T2=2 runas, T3=3 runas (verificado en `api/item-enchant.js`)
- Crafteadas en el Laboratorio con recursos brutos
- UI en Equipo.jsx: badge de encantamientos + picker inline en cada slot

### Tácticas
- 5 slots por héroe, ~80 tácticas en catálogo (common→legendary, todas las clases)
- **Niveles**: 1-5 via pergamino táctico (scroll), nivel 6 "Maestría ★" exclusivo de drops
- `TACTIC_MAX_LEVEL = 5` (cap de pergaminos), `TACTIC_PRESTIGE_LEVEL = 6` (solo drops)
- Tap en card de colección → equipa al instante (sin modal)
- Tap en chip equipado → desequipa al instante (sin modal)
- Solo modal cuando todos los slots están llenos: picker de slot a reemplazar
- **PENDIENTE (Fase 5)**: tácticas exclusivas por clase con efectos condicionales

### Misiones diarias
- 3 misiones por día con seed determinista (jugador + fecha)
- Recompensas variables por tier: gold + xp siempre; fragmentos en tiers medio/difícil; esencia/pergamino en difícil
- Tipos con recompensas especiales: `dungeon_type_combat/magic` (frags), `item_drop` (frags/esencia), `tower_attempt` (pergamino en difícil)

### Bonus de regreso
- Se comprueba al montar Dashboard (`useComebackBonus`)
- 8h+: 300 oro | 24h+: 600 oro + 25 frags | 72h+: 1000 oro + 60 frags + 1 esencia
- Máximo 1 vez por día UTC. Columnas en `players`: `last_seen_at`, `comeback_claimed_date`

### Logros
- 24 logros en 5 categorías: Progresión, Torre, Expediciones, Tácticas, Equipo
- Progreso calculado en tiempo real desde tablas existentes (sin counters adicionales)
- Recompensas: oro, fragmentos, esencia, pergaminos
- Endpoint `GET /api/achievements` + `POST /api/achievements-claim`

### Expediciones y mazmorras
- Idle con timer, coste de HP basado en fórmulas de gameFormulas.js
- **PENDIENTE (Fase 4)**: cada héroe tendrá zonas exclusivas con drops por clase
- **Provisiones de expedición**: opt-in toggle antes de iniciar (+15% oro, +10% XP). Se consume 1 si activado.
- **Poción de Vida**: se usa desde la ficha del héroe (restaura 40% HP al momento), NO desde expediciones
- Mazmorras bloqueadas por nivel: muestran botón deshabilitado con "Requiere Nv. X"

### Torre
- Progresión infinita con escalado de enemigos (formato 1v1, siempre disponible)
- Pisos 1-25: crecimiento lineal, 26+: velocidad media
- Hitos cada 5 pisos con recompensas bonus
- Arquetipos enemigos: Berserker, Tank, Assassin, Mage

### Combate
- Motor por turnos con habilidades, tácticas, sinergias de equipo — NO CAMBIA
- Formato activo: 1v1 (Torre). PvP futuro en Arena (pendiente)
- Firma HMAC para verificar resultados
- **No hay estrategia defensiva** — eliminada. El héroe combate con sus stats tal cual.

### Laboratorio (antes "Taller")
- Requiere base nivel 3
- Crafteo de **1 unidad a la vez** por receta — sin selector de cantidad
- Botón único por receta: "Craftear" → deshabilitado con timer → "Recoger" (verde al terminar)
- Categorías en UI: **Consumibles** (poción de vida + provisiones), **Runas**, **Mejora de tier**
- Ingredientes: solo recursos brutos (iron, wood, mana, herbs, fragments, essence)
- Piedras de forja (forge_stone_t2, forge_stone_t3) para upgrade de tier de ítems
- Pergamino Táctico (tactic_scroll): 20 maná + 5 fragmentos, 20 min — sube 1 nivel una táctica (máx nivel 5)

### Biblioteca
- Requiere base nivel 3
- Árbol de investigación con bonos permanentes

## Patrones técnicos

- **RPCs atómicas**: todos los endpoints usan RPCs de Supabase, CAS eliminado
- **Realtime**: Supabase subscriptions para recursos, edificios, expediciones (`useRealtimeSync`)
- **Stats efectivas**: calculadas en `api/_stats.js` (durabilidad proporcional + peso + encantamientos)
- **Constantes compartidas**: `gameConstants.js` y `gameFormulas.js` importados por frontend y backend
- **Lazy mount de tabs**: `mountedTabs` Set en Dashboard
- **Notificaciones**: usar solo `notify.*` de `src/lib/notifications.js` — nunca sonner directo
- **snapshotResources()**: siempre llamar antes de sumar/restar recursos idle
- **Patrón de mutations**: optimistic update en `onMutate` + rollback en `onError` + `invalidateQueries` en `onSettled`. Usar `mutationKey` para proteger Realtime de invalidar encima de optimistic updates (ver `useRealtimeSync`).

## Reglas de colaboración

- **Móvil primero, sin hover**
- **Fuentes mínimas**: 13px secundario, 14-15px principal, nunca 9-10px en cards
- **No añadir funcionalidad no pedida** — ni tooltips, ni mejoras UX extra
- **Respuestas cortas y directas**
- **Cero parches**: si algo no funciona, refactorizar desde raíz
- **No apilar notificaciones**: no añadir toasts a flujos con feedback visual; máximo 2 toasts del mismo flujo
- **Migraciones SQL**: las aplico yo siempre con `npx supabase db push`
- **Para decisiones de balance**: implementar la opción razonable directamente, no pedir confirmación por cada detalle
- **UI en español**
- **Metodología uniforme**: aplicar el mismo patrón en todo el proyecto — no mezclar optimistic con invalidación según la sección

## Cron jobs (vercel.json)

- `/api/cron/process-expeditions` — cada 5 minutos
- `/api/cron/process-buildings` — cada 1 minuto

## Pendiente

- **Push notifications** — VAPID keys, service worker, backend push, cron triggers
- **Fase 4** — Expediciones por clase: zonas temáticas, drops dirigidos
- **Fase 5** — Tácticas exclusivas por clase con efectos condicionales
- **Arena PvP** — Sistema completo de combates entre jugadores
