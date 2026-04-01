export const createMinion = ({ id, x, y, z, maxHealth }) => {
  return {
    id,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: maxHealth,
    maxHp: maxHealth,
    radius: 0.85,
    attackCooldownLeft: 0.6,
    damageFlash: 0,
    orbitPhase: Math.random() * Math.PI * 2,
  };
};

