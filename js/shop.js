export const SHOP_ITEMS = [
  {
    id: "medkit",
    name: "Medkit",
    cost: 20,
    desc: (p) => `Restore 45 HP  (${Math.ceil(p.health)}/${p.maxHealth})`,
    canBuy: (p) => p.health < p.maxHealth,
    apply: (p) => p.heal(45),
  },
  {
    id: "ammo",
    name: "Ammo crate",
    cost: 18,
    desc: () => "+40 reserve rounds",
    apply: (p) => p.addAmmo(40),
  },
  {
    id: "healmax",
    name: "Field surgeon",
    cost: 40,
    desc: () => "Full heal + 20 max HP",
    apply: (p) => {
      p.maxHealth += 20;
      p.health = p.maxHealth;
    },
  },
  {
    id: "damage",
    name: "Hollow points",
    cost: 32,
    desc: (p) => `Rifle damage ${p.gunDamage} → ${p.gunDamage + 8}`,
    apply: (p) => {
      p.gunDamage += 8;
    },
  },
  {
    id: "firerate",
    name: "Rapid fire",
    cost: 38,
    desc: (p) => `Fire delay ${p.fireInterval.toFixed(2)}s`,
    canBuy: (p) => p.fireInterval > 0.055,
    apply: (p) => {
      p.fireInterval = Math.max(0.055, p.fireInterval * 0.86);
    },
  },
  {
    id: "mag",
    name: "Extended mag",
    cost: 28,
    desc: (p) => `Mag size ${p.magSize} → ${p.magSize + 8}`,
    apply: (p) => {
      p.magSize += 8;
      p.mag += 8;
    },
  },
  {
    id: "armor",
    name: "Armor plates",
    cost: 42,
    desc: (p) => `Damage taken ${Math.round((1 - p.armor) * 100)}%`,
    canBuy: (p) => p.armor < 0.5,
    apply: (p) => {
      p.armor = Math.min(0.5, p.armor + 0.12);
    },
  },
  {
    id: "speed",
    name: "Stim shot",
    cost: 36,
    desc: (p) => `Sprint ${p.sprintSpeed.toFixed(1)} → ${(p.sprintSpeed + 0.7).toFixed(1)}`,
    apply: (p) => {
      p.walkSpeed += 0.45;
      p.sprintSpeed += 0.7;
    },
  },
];
