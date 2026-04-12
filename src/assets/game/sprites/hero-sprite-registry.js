import idleLeft from "./hero-custom/hero-idle-left.png";
import runLeft from "./hero-custom/hero-run-left.png";
import deathBiteLeft from "./hero-custom/hero-death-bite-left.png";
import turnLeftRight from "./hero-custom/hero-turn-left-right.png";

const FALLBACK_FPS = 1;

const baseIdle = {
  src: idleLeft,
  frames: 1,
  columns: 1,
  rows: 1,
  fps: FALLBACK_FPS,
  mirror: true,
  frameOffsets: [{ x: 0, y: 0 }],
};

const animations = {
  idle: baseIdle,
  run: {
    src: runLeft,
    frames: 7,
    columns: 3,
    rows: 3,
    fps: 10,
    mirror: true,
    frameOffsets: [
      { x: 0, y: 0 },
      { x: 0.125, y: 0 },
      { x: 0.375, y: 0 },
      { x: 0.8125, y: 0.125 },
      { x: 0.75, y: 0.25 },
      { x: 0.5625, y: 0.25 },
      { x: 0.5625, y: 0 },
    ],
  },
  jump: baseIdle,
  fall: baseIdle,
  hurt: baseIdle,
  clear: baseIdle,
  death: {
    src: deathBiteLeft,
    frames: 13,
    columns: 4,
    rows: 4,
    fps: 10,
    mirror: true,
  },
  turn: {
    src: turnLeftRight,
    frames: 5,
    columns: 3,
    rows: 2,
    fps: 12,
    mirrorByFacing: {
      left: true,
      right: false,
    },
    frameOffsets: [
      { x: 0, y: 0 },
      { x: 0.4375, y: 0 },
      { x: 0.25, y: 0 },
      { x: -0.0625, y: 0.25 },
      { x: -0.125, y: 0.125 },
    ],
  },
};

export const getHeroAnimation = (name) => animations[name] ?? animations.idle;
export const getHeroAnimationSources = () => {
  const sources = new Set();

  Object.values(animations).forEach((animation) => {
    if (animation.src) sources.add(animation.src);
    if (animation.srcByFacing) {
      Object.values(animation.srcByFacing).forEach((src) => {
        if (src) sources.add(src);
      });
    }
  });

  return [...sources];
};
