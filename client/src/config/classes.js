/**
 * Character class definitions for Guild Clash
 */
const CHARACTER_CLASSES = {
  CLERK: {
    id: 'CLERK',
    name: 'Clerk',
    color: 0x4287f5, // Blue
    health: 80,
    speed: 0.15,
    description: 'High speed, lower health. Uses magic attacks.',
    abilities: {
      primary: {
        name: 'Magic Bolt',
        damage: 15,
        cooldown: 1,
        range: 8
      },
      secondary: {
        name: 'Frost Nova',
        damage: 10,
        cooldown: 6,
        range: 5,
        areaOfEffect: true
      },
      ultimate: {
        name: 'Arcane Barrage',
        damage: 25,
        cooldown: 10,
        range: 10
      }
    }
  },
  
  WARRIOR: {
    id: 'WARRIOR',
    name: 'Warrior',
    color: 0xe74c3c, // Red
    health: 120,
    speed: 0.08,
    description: 'High health, lower speed. Uses melee attacks.',
    abilities: {
      primary: {
        name: 'Slash',
        damage: 20,
        cooldown: 1,
        range: 2
      },
      secondary: {
        name: 'Shield Bash',
        damage: 10,
        cooldown: 4,
        range: 2,
        stun: true
      },
      ultimate: {
        name: 'Whirlwind',
        damage: 30,
        cooldown: 10,
        range: 3,
        areaOfEffect: true
      }
    }
  },
  
  RANGER: {
    id: 'RANGER',
    name: 'Ranger',
    color: 0x2ecc71, // Green
    health: 100,
    speed: 0.12,
    description: 'Balanced health and speed. Uses ranged attacks.',
    abilities: {
      primary: {
        name: 'Quick Shot',
        damage: 18,
        cooldown: 1,
        range: 6
      },
      secondary: {
        name: 'Trap',
        damage: 5,
        cooldown: 6,
        range: 4,
        slow: true
      },
      ultimate: {
        name: 'Volley',
        damage: 35,
        cooldown: 10,
        range: 7,
        multiTarget: true
      }
    }
  }
};

export default CHARACTER_CLASSES;