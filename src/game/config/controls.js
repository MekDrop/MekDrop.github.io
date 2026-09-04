export const CONTROLS = {
  zoomIn: {
    keys: ["PageUp"],
    wheelDirection: "up",
  },
  zoomOut: {
    keys: ["PageDown"],
    wheelDirection: "down",
  },
  moveUp: {
    keys: ["ArrowUp"],
  },
  moveDown: {
    keys: ["ArrowDown"],
  },
  moveLeft: {
    keys: ["ArrowLeft"],
  },
  moveRight: {
    keys: ["ArrowRight"],
  },
  run: {
    keys: ["ShiftLeft", "ShiftRight"],
  },
  jump: {
    keys: ["Space"],
    allowRepeat: false,
  },
  interact: {
    keys: ["KeyE"],
    allowRepeat: false,
  },
  rotateAnticlockwise: {
    keys: ["KeyQ"],
  },
  copyScreenshot: {
    keys: ["KeyS"],
    ctrlKey: true,
    allowRepeat: false,
  },
  dragCamera: {
    mouseButtons: [0, 2],
    activationDistance: 4,
  },
  rotateCamera: {
    mouseButton: 1,
    activationDistance: 4,
    quarterTurnsPerPixel: 1 / 240,
  },
  toggleArrows: {
    keys: ["Pause"],
  },
  zoom: {
    factor: 1.1,
    min: 0.15,
    max: 6.0,
  },
  move: {
    step: 32,
  },
};
