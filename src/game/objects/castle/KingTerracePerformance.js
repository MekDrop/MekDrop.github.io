import { KING_ANIMATION } from "../../enum/KingAnimation.js";

const STEP_DURATION = 0.65;
const SWORD_SEQUENCE = [
  KING_ANIMATION.SWORD_READY,
  KING_ANIMATION.SWORD_OVERHEAD_STRIKE,
  KING_ANIMATION.SWORD_SIDE_SLASH,
  KING_ANIMATION.SWORD_THRUST,
  KING_ANIMATION.SWORD_PARRY,
  KING_ANIMATION.SWORD_GUARDED,
  KING_ANIMATION.SWORD_LUNGE,
  KING_ANIMATION.SWORD_RAISED,
  KING_ANIMATION.SWORD_LOW_DEFENSE,
  KING_ANIMATION.SWORD_TWO_HANDED_SWING,
  KING_ANIMATION.SWORD_RECOVERY,
  KING_ANIMATION.SWORD_FINISH,
];
const ATTACKS = new Set([
  KING_ANIMATION.SWORD_OVERHEAD_STRIKE,
  KING_ANIMATION.SWORD_SIDE_SLASH,
  KING_ANIMATION.SWORD_THRUST,
  KING_ANIMATION.SWORD_LUNGE,
  KING_ANIMATION.SWORD_TWO_HANDED_SWING,
]);
const ATTACK_SEQUENCE = SWORD_SEQUENCE.filter((clip) => ATTACKS.has(clip));
const POSITION_BY_CLIP = new Map([
  [KING_ANIMATION.SWORD_READY, { x: 0, y: 0, z: 0 }],
  [KING_ANIMATION.SWORD_OVERHEAD_STRIKE, { x: -0.7, y: 0, z: 0.1 }],
  [KING_ANIMATION.SWORD_SIDE_SLASH, { x: 0.65, y: 0, z: 0.2 }],
  [KING_ANIMATION.SWORD_THRUST, { x: 1.25, y: 0, z: 0.65 }],
  [KING_ANIMATION.SWORD_PARRY, { x: 0.55, y: 0, z: 0.1 }],
  [KING_ANIMATION.SWORD_GUARDED, { x: 0, y: 0, z: 0 }],
  [KING_ANIMATION.SWORD_LUNGE, { x: -1.25, y: 0, z: 0.7 }],
  [KING_ANIMATION.SWORD_RAISED, { x: -0.5, y: 0, z: -0.15 }],
  [KING_ANIMATION.SWORD_LOW_DEFENSE, { x: 0.9, y: 0, z: 0.35 }],
  [KING_ANIMATION.SWORD_TWO_HANDED_SWING, { x: 1.3, y: 0, z: 0.2 }],
  [KING_ANIMATION.SWORD_RECOVERY, { x: 0.45, y: 0, z: 0.1 }],
  [KING_ANIMATION.SWORD_FINISH, { x: 0, y: 0, z: 0 }],
  [KING_ANIMATION.SWORD_FAILURE_LEFT, { x: -0.95, y: 0, z: 0.15 }],
  [KING_ANIMATION.SWORD_FAILURE_RIGHT, { x: 0.95, y: 0, z: 0.15 }],
]);
const YAW_BY_CLIP = new Map([
  [KING_ANIMATION.SWORD_READY, -12],
  [KING_ANIMATION.SWORD_OVERHEAD_STRIKE, -35],
  [KING_ANIMATION.SWORD_SIDE_SLASH, 28],
  [KING_ANIMATION.SWORD_THRUST, 48],
  [KING_ANIMATION.SWORD_PARRY, -20],
  [KING_ANIMATION.SWORD_GUARDED, 0],
  [KING_ANIMATION.SWORD_LUNGE, -52],
  [KING_ANIMATION.SWORD_RAISED, -25],
  [KING_ANIMATION.SWORD_LOW_DEFENSE, 38],
  [KING_ANIMATION.SWORD_TWO_HANDED_SWING, 55],
  [KING_ANIMATION.SWORD_RECOVERY, 20],
  [KING_ANIMATION.SWORD_FINISH, 0],
  [KING_ANIMATION.SWORD_FAILURE_LEFT, -65],
  [KING_ANIMATION.SWORD_FAILURE_RIGHT, 65],
]);
const ZERO_POSITION = { x: 0, y: 0, z: 0 };

/** Chooses model-authored clips; it never manufactures joint transforms. */
export class KingTerracePerformance {
  #seed;
  #schedule;

  constructor(seed = Math.random()) {
    this.#seed = Number.isFinite(seed) ? seed : 0;
    this.#schedule = this.#buildSchedule();
  }

  sample(action, time, blend = 1) {
    const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (action === "walk") {
      return {
        clip: KING_ANIMATION.TERRACE_WALK,
        repeated: false,
        failed: false,
        sequenceStep: "walk",
        offset: { ...ZERO_POSITION },
        yaw: 0,
      };
    }
    if (action !== "sword") {
      return {
        clip: KING_ANIMATION.TERRACE_IDLE,
        repeated: false,
        failed: false,
        sequenceStep: "idle",
        offset: { ...ZERO_POSITION },
        yaw: 0,
      };
    }
    if (blend < 1) {
      return {
        clip: safeTime > 0
          ? KING_ANIMATION.SWORD_FINISH
          : KING_ANIMATION.SWORD_READY,
        repeated: false,
        failed: false,
        sequenceStep: safeTime > 0 ? "rise" : "settle",
        offset: { ...ZERO_POSITION },
        yaw: 0,
      };
    }

    const step = Math.floor(safeTime / STEP_DURATION + 1e-9);
    const index = step % this.#schedule.length;
    const entry = this.#schedule[index];
    const previous = step === 0
      ? entry
      : this.#schedule[(index + this.#schedule.length - 1) %
        this.#schedule.length];
    const phase = (safeTime / STEP_DURATION) - step;
    const movement = this.#smooth(Math.min(1, phase / 0.28));
    const from = POSITION_BY_CLIP.get(previous.clip) ?? ZERO_POSITION;
    const to = POSITION_BY_CLIP.get(entry.clip) ?? ZERO_POSITION;
    const fromYaw = step === 0 ? 0 : YAW_BY_CLIP.get(previous.clip) ?? 0;
    const toYaw = YAW_BY_CLIP.get(entry.clip) ?? 0;
    return {
      ...entry,
      sequenceStep: step,
      offset: {
        x: from.x + (to.x - from.x) * movement,
        y: from.y + (to.y - from.y) * movement,
        z: from.z + (to.z - from.z) * movement,
      },
      yaw: fromYaw + (toYaw - fromYaw) * movement,
    };
  }

  #buildSchedule() {
    const schedule = [];
    // Four varied passes keep the routine from looking like a tiny loop. Each
    // pass still includes every authored pose, plus at least one repeat and
    // one failed technique.
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const forcedRepeat = Math.floor(
        this.#noise(cycle, 23) * SWORD_SEQUENCE.length,
      );
      const forcedFailure = Math.floor(
        this.#noise(cycle, 29) * ATTACK_SEQUENCE.length,
      );
      for (let index = 0; index < SWORD_SEQUENCE.length; index += 1) {
        const clip = SWORD_SEQUENCE[index];
        schedule.push({ clip, repeated: false, failed: false });
        if (index === forcedRepeat || this.#noise(cycle * 31 + index, 3) < 0.16) {
          schedule.push({ clip, repeated: true, failed: false });
        }
        const attackIndex = ATTACK_SEQUENCE.indexOf(clip);
        if (attackIndex >= 0 && (attackIndex === forcedFailure ||
          this.#noise(cycle * 31 + index, 11) < 0.14)) {
          const failure = this.#noise(cycle * 31 + index, 19) < 0.5
            ? KING_ANIMATION.SWORD_FAILURE_LEFT
            : KING_ANIMATION.SWORD_FAILURE_RIGHT;
          schedule.push({ clip: failure, repeated: false, failed: true });
        }
      }
    }
    return schedule;
  }

  #noise(index, salt) {
    const value = Math.sin(
      (index + 1) * 12.9898 + (this.#seed + salt) * 78.233,
    ) * 43758.5453;
    return value - Math.floor(value);
  }

  #smooth(value) {
    return value * value * (3 - 2 * value);
  }

}
