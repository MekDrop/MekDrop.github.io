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
  rotateAnticlockwise: {
    keys: ["KeyQ"],
  },
  rotateClockwise: {
    keys: ["KeyE"],
  },
  copyScreenshot: {
    keys: ["KeyS"],
    ctrlKey: true,
    allowRepeat: false,
  },
  dragCamera: {
    mouseButton: 2,
  },
  rotateCamera: {
    mouseButton: 1,
    activationDistance: 4,
    quarterTurnsPerPixel: 1 / 240,
  },
  toggleArrows: {
    keys: ["Pause"],
  },
  regenerateMap: {
    keys: ["KeyR"],
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
