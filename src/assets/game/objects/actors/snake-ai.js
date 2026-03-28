export const createSnakeAI = (stateMachine, patrolSpeed) => {
  return {
    stateMachine,
    desiredDir: 0,
    desiredSpeed: patrolSpeed,
    attackMode: false,
    heroAbove: false,
    escapeTarget: null,
    spikeThreat: null,
  };
};
