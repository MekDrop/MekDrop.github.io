export const createVisiblePools = ({
  maxVisiblePlatforms,
  maxVisibleCollectibles,
  maxVisibleLadders,
  maxVisibleSpikes,
  maxVisiblePortals,
}) => {
  const platformPool = Array.from({ length: maxVisiblePlatforms }, () => ({
    x: -9999,
    y: -9999,
    w: 0,
    h: 0,
    motion: 0,
    type: 0,
    shake: 0,
    durability: 1,
    ref: null,
  }));

  const collectiblePool = Array.from({ length: maxVisibleCollectibles }, () => ({
    x: -9999,
    y: -9999,
    phase: 0,
  }));

  const ladderPool = Array.from({ length: maxVisibleLadders }, () => ({
    x: -9999,
    y: -9999,
    w: 0,
    h: 0,
    ref: null,
  }));

  const spikePool = Array.from({ length: maxVisibleSpikes }, () => ({
    x: -9999,
    y: -9999,
    w: 0,
    h: 0,
    dir: 0,
  }));

  const portalPool = Array.from({ length: maxVisiblePortals }, () => ({
    x: -9999,
    y: -9999,
    w: 0,
    h: 0,
    side: 0,
    ref: null,
  }));

  return {
    platformPool,
    collectiblePool,
    ladderPool,
    spikePool,
    portalPool,
  };
};
