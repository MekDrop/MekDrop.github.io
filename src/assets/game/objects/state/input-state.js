export const createInputState = () => {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpQueued: false,
    jumpFromSpace: false,
  };
};
