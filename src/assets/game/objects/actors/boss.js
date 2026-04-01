export const createBoss = (startPos, maxHealth) => {
  return {
    x: startPos.x,
    y: startPos.y,
    z: startPos.z,
    hp: maxHealth,
    maxHp: maxHealth,
    alive: true,
    state: "idle",
    stateTime: 0,
    summonCooldownLeft: 2.8,
    lookUp: 0,
    pulse: 0,
    attackCooldownLeft: 1.2,
    damageFlash: 0,
  };
};

