export const createInputState = () => {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    fire: false,
    grapple: false,
    sword: false,
    weaponSwitch: -1,
    pointerActive: false,
    aimNdcX: 0,
    aimNdcY: -0.06,
  };
};
