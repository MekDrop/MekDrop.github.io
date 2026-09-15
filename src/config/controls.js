export const DEFAULT_CONTROLS = Object.freeze({
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
    allowedModifiers: ["shiftKey"],
  },
  moveDown: {
    keys: ["ArrowDown"],
    allowedModifiers: ["shiftKey"],
  },
  moveLeft: {
    keys: ["ArrowLeft"],
    allowedModifiers: ["shiftKey"],
  },
  moveRight: {
    keys: ["ArrowRight"],
    allowedModifiers: ["shiftKey"],
  },
  run: {
    keys: ["ShiftLeft", "ShiftRight"],
  },
  jump: {
    keys: ["Space"],
    allowRepeat: false,
  },
  dodge: {
    doubleTapWindow: 0.28,
  },
  interact: {
    keys: ["KeyE"],
    allowRepeat: false,
  },
  toggleInventory: {
    keys: ["KeyI"],
    allowRepeat: false,
  },
  closeModal: {
    keys: ["Escape"],
    allowRepeat: false,
  },
  rotateAnticlockwise: {
    keys: ["KeyQ"],
  },
  toggleRecording: {
    keys: ["PrintScreen"],
    ctrlKey: true,
    allowRepeat: false,
  },
  copyScreenshot: {
    keys: ["KeyS"],
    ctrlKey: true,
    allowRepeat: false,
  },
  regenerateMap: {
    keys: ["F5"],
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
    min: 1.0,
    max: 6.0,
  },
  move: {
    step: 32,
  },
});

export default DEFAULT_CONTROLS;
