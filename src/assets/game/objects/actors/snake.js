export const createSnake = (startPos) => {
  return {
    x: startPos.x,
    y: startPos.y + 2.2,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    supportPlatform: null,
    onLadder: false,
    ladder: null,
    homePlatform: null,
    patrolDir: 1,
    targetLadder: null,
    targetLadderRefresh: 0,
    ladderDecisionCooldown: 0,
    ladderIntentLeft: 0,
    biteCooldown: 0,
    alive: true,
  };
};
