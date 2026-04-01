export const createVisiblePools = ({
  maxVisibleStructures,
  maxVisibleAnchors,
  maxVisibleMinions,
  maxVisibleProjectiles,
  maxVisibleImpacts,
}) => {
  const structurePool = Array.from({ length: maxVisibleStructures }, () => ({
    x: -9999,
    y: -9999,
    z: -9999,
    r: 0,
    h: 0,
    type: 0,
    emissive: 0,
    grapplable: 0,
  }));

  const anchorPool = Array.from({ length: maxVisibleAnchors }, () => ({
    x: -9999,
    y: -9999,
    z: -9999,
    radius: 0,
    active: 0,
  }));

  const minionPool = Array.from({ length: maxVisibleMinions }, () => ({
    x: -9999,
    y: -9999,
    z: -9999,
    radius: 0,
    hp: 0,
    phase: 0,
    flash: 0,
  }));

  const projectilePool = Array.from({ length: maxVisibleProjectiles }, () => ({
    x: -9999,
    y: -9999,
    z: -9999,
    radius: 0,
    kind: 0,
    lifeRatio: 0,
    owner: 0,
    glow: 0,
  }));

  const impactPool = Array.from({ length: maxVisibleImpacts }, () => ({
    x: -9999,
    y: -9999,
    z: -9999,
    radius: 0,
    strength: 0,
  }));

  return {
    structurePool,
    anchorPool,
    minionPool,
    projectilePool,
    impactPool,
  };
};
