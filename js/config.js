export const CONFIG = {
  mouseSensitivity: 0.00155,
  fov: 72,
  fogColor: 0x09080a,
  fogDensity: 0.022,

  player: {
    walkSpeed: 5.4,
    sprintSpeed: 8.2,
    radius: 0.42,
    eyeHeight: 1.62,
    maxHealth: 100,
    gravity: 22,
    jumpSpeed: 7.2,
  },

  weapon: {
    magSize: 30,
    reserve: 90,
    fireInterval: 0.11,
    damage: 28,
    headMultiplier: 2.15,
    range: 70,
  },

  // World-space meters per second. Never scaled by mouse look.
  zombies: {
    walker: { speed: 1.55, health: 90, damage: 9, color: 0x5a6a48, scale: 1 },
    runner: { speed: 2.55, health: 60, damage: 7, color: 0x6e5a3a, scale: 0.94 },
    tank: { speed: 1.12, health: 220, damage: 16, color: 0x3d3a38, scale: 1.22 },
    attackRange: 1.38,
    attackCooldown: 1.05,
    turnRate: 3.4,
    maxStep: 0.05,
  },

  mapHalf: 46,
};
