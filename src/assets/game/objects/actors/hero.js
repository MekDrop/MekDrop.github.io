export const createHero = (startPos) => {
  return {
    x: startPos.x,
    y: startPos.y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyoteLeft: 0,
    jumpBufferLeft: 0,
    crouch: 0,
    superJumpCharge: 0,
    superJumpWindow: 0,
    airJumpsLeft: 1,
    supportPlatform: null,
    onLadder: false,
    ladder: null,
    ladderRegrabLock: 0,
  };
};
