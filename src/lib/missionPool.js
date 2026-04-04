export const MISSION_POOL = [
  {
    type: 'expeditions_complete',
    label: 'Expedicionario',
    description: (n) => `Completa ${n} expedicion${n > 1 ? 'es' : ''}`,
    targets: [2, 3, 5],
    rewards: [
      { gold: 150, mana:  0, xp:  80 },
      { gold: 300, mana: 10, xp: 150 },
      { gold: 600, mana: 25, xp: 300 },
    ],
  },
  {
    type: 'gold_earn',
    label: 'Buscador de oro',
    description: (n) => `Gana ${n} de oro en expediciones`,
    targets: [300, 600, 1200],
    rewards: [
      { gold: 100, mana:  0, xp:  60 },
      { gold: 200, mana: 15, xp: 120 },
      { gold: 400, mana: 30, xp: 250 },
    ],
  },
  {
    type: 'xp_earn',
    label: 'Aprendiz',
    description: (n) => `Gana ${n} de experiencia`,
    targets: [200, 500, 1000],
    rewards: [
      { gold: 120, mana:  0, xp:  50 },
      { gold: 250, mana: 10, xp: 100 },
      { gold: 500, mana: 25, xp: 200 },
    ],
  },
  {
    type: 'tower_attempt',
    label: 'Escalador',
    description: (n) => `Intenta la torre ${n} ${n === 1 ? 'vez' : 'veces'}`,
    targets: [1, 2, 3],
    rewards: [
      { gold: 200, mana: 20, xp: 100 },
      { gold: 350, mana: 35, xp: 180 },
      { gold: 500, mana: 50, xp: 300 },
    ],
  },
  {
    type: 'dungeon_type_combat',
    label: 'Guerrero',
    description: (n) => `Completa ${n} expedicion${n > 1 ? 'es' : ''} de combate`,
    targets: [1, 2, 3],
    rewards: [
      { gold: 180, mana:  0, xp:  90 },
      { gold: 350, mana: 10, xp: 180 },
      { gold: 600, mana: 20, xp: 350 },
    ],
  },
  {
    type: 'dungeon_type_magic',
    label: 'Arcanista',
    description: (n) => `Completa ${n} expedicion${n > 1 ? 'es' : ''} mágica${n > 1 ? 's' : ''}`,
    targets: [1, 2, 3],
    rewards: [
      { gold: 150, mana:  30, xp:  80 },
      { gold: 300, mana:  60, xp: 150 },
      { gold: 500, mana: 100, xp: 280 },
    ],
  },
  {
    type: 'dungeon_type_wilderness',
    label: 'Explorador',
    description: (n) => `Completa ${n} expedicion${n > 1 ? 'es' : ''} de exploración`,
    targets: [1, 2, 3],
    rewards: [
      { gold: 160, mana: 10, xp:  80 },
      { gold: 320, mana: 20, xp: 160 },
      { gold: 550, mana: 40, xp: 300 },
    ],
  },
  {
    type: 'item_drop',
    label: 'Cazador de botín',
    description: (n) => `Obtén ${n} objeto${n > 1 ? 's' : ''} en expediciones`,
    targets: [1, 2, 3],
    rewards: [
      { gold: 200, mana:  0, xp: 100 },
      { gold: 400, mana:  0, xp: 200 },
      { gold: 700, mana:  0, xp: 400 },
    ],
  },
]
