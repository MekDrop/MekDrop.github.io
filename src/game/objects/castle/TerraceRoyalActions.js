import { CASTLE_TERRACE_PHASE as PHASE } from "../../enum/CastleTerracePhase.js";
import { syncTerraceWalk, terracePathYaw } from "./TerraceMovement.js";

const DOORWAY_START_Z = -1.4;
const DOORWAY_VISIBLE_Z = 0.2;
const QUEEN_APPROACH_POSITION = [0.62, 0, 3.3];
const QUEEN_REST_POSITION = [0, 0, 3.1];
const QUEEN_ROUTE = [
  { progress: 0, x: 0, z: DOORWAY_START_Z },
  { progress: 0.55, x: 0, z: 1.2 },
  { progress: 0.68, x: 0.9, z: 1.65 },
  { progress: 0.92, x: 0.9, z: 3.3 },
  { progress: 1, x: QUEEN_APPROACH_POSITION[0], z: QUEEN_APPROACH_POSITION[2] },
];

const ease = (value) => value * value * (3 - 2 * value);

/**
 * Executes the visual action selected by one royal's current state.
 */
export class TerraceRoyalActions {
  #kind;
  #royal;
  #activityTime = 0;

  constructor({ RoyalType, pc, modelLibrary, performanceSeed, stage }) {
    this.#kind = RoyalType.kind;
    this.#royal = new RoyalType({ pc, modelLibrary, performanceSeed });
    stage.addChild(this.#royal.entity);
  }

  get actor() {
    return this.#royal;
  }

  get state() {
    const position = this.#royal.entity.enabled
      ? this.#royal.entity.getLocalPosition() : null;
    return {
      position: position ? { x: position.x, y: position.y, z: position.z } : null,
      yaw: this.#royal.entity.enabled
        ? this.#royal.entity.getLocalEulerAngles().y : null,
    };
  }

  sync(behavior) {
    const phase = behavior.stagePhase;
    const visible = [PHASE.ROYAL_ENTER, PHASE.SETTLE, PHASE.ACTIVITY,
      PHASE.RISE, PHASE.ROYAL_EXIT].includes(phase);
    this.#royal.entity.enabled = visible;
    if (!visible) {
      return;
    }
    if (phase === PHASE.ACTIVITY) {
      this.#activityTime = behavior.elapsed;
    } else if (phase === PHASE.SETTLE) {
      this.#activityTime = 0;
    }
    if (this.#kind === "queen") {
      this.#syncQueen(behavior);
      return;
    }
    const target = this.#kind === "princess"
      ? [-0.75, 0, 3.2] : [0, 0, 3.1];
    if ([PHASE.ROYAL_ENTER, PHASE.ROYAL_EXIT].includes(phase)) {
      syncTerraceWalk({
        actor: this.#royal,
        target,
        leaving: phase === PHASE.ROYAL_EXIT,
        behavior,
      });
      return;
    }
    this.#royal.entity.setLocalPosition(...target);
    this.#royal.entity.setLocalEulerAngles(
      0,
      this.#kind === "princess" ? 90 : 0,
      0,
    );
    const blend = phase === PHASE.SETTLE
      ? behavior.progress
      : phase === PHASE.RISE ? 1 - behavior.progress : 1;
    this.#royal.pose(behavior.action, this.#activityTime, blend);
  }

  destroy() {
    this.#royal.destroy();
    this.#royal = null;
  }

  #syncQueen(behavior) {
    const phase = behavior.stagePhase;
    if ([PHASE.ROYAL_ENTER, PHASE.ROYAL_EXIT].includes(phase)) {
      this.#walkQueen(behavior, phase === PHASE.ROYAL_EXIT);
      return;
    }
    if ([PHASE.SETTLE, PHASE.RISE].includes(phase)) {
      const progress = phase === PHASE.SETTLE
        ? behavior.progress : 1 - behavior.progress;
      this.#poseQueenOnSunbed(progress, behavior.action);
      return;
    }
    this.#royal.entity.setLocalPosition(...QUEEN_REST_POSITION);
    this.#royal.entity.setLocalEulerAngles(0, 0, 0);
    this.#royal.pose(behavior.action, this.#activityTime);
  }

  #walkQueen(behavior, leaving) {
    const travelDuration = behavior.duration - 0.7;
    const travelTime = Math.max(
      0,
      Math.min(travelDuration, behavior.elapsed - 0.4),
    );
    const progress = leaving
      ? 1 - travelTime / travelDuration
      : travelTime / travelDuration;
    const position = this.#queenRoutePoint(progress);
    const before = this.#queenRoutePoint(Math.max(0, progress - 0.002));
    const after = this.#queenRoutePoint(Math.min(1, progress + 0.002));
    const stairProgress = ease(Math.max(
      0,
      Math.min(1, (position.z - DOORWAY_START_Z) / 1.5),
    ));
    this.#royal.entity.setLocalPosition(
      position.x,
      -1.05 * (1 - stairProgress),
      position.z,
    );
    const yaw = terracePathYaw([before, after], leaving);
    this.#royal.entity.setLocalEulerAngles(0, yaw, 0);
    this.#royal.entity.enabled = position.z > DOORWAY_VISIBLE_Z;
    const moving = travelTime > 0 && travelTime < travelDuration;
    this.#royal.pose(
      moving ? "walk" : "idle",
      travelTime * behavior.walkSpeed,
    );
  }

  #queenRoutePoint(progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    for (let index = 1; index < QUEEN_ROUTE.length; index += 1) {
      const start = QUEEN_ROUTE[index - 1];
      const end = QUEEN_ROUTE[index];
      if (clamped > end.progress) {
        continue;
      }
      const segment = ease(
        (clamped - start.progress) / (end.progress - start.progress),
      );
      return {
        x: start.x + (end.x - start.x) * segment,
        z: start.z + (end.z - start.z) * segment,
      };
    }
    return { x: QUEEN_APPROACH_POSITION[0], z: QUEEN_APPROACH_POSITION[2] };
  }

  #poseQueenOnSunbed(progress, action) {
    const phase = Math.max(0, Math.min(1, progress));
    const sitting = ease(phase / 0.28);
    const feetUp = ease(Math.max(0, Math.min(1, (phase - 0.28) / 0.34)));
    const x = QUEEN_APPROACH_POSITION[0] +
      (QUEEN_REST_POSITION[0] - QUEEN_APPROACH_POSITION[0]) * feetUp;
    const y = 0.18 * sitting * (1 - feetUp);
    const z = QUEEN_APPROACH_POSITION[2] +
      (QUEEN_REST_POSITION[2] - QUEEN_APPROACH_POSITION[2]) * feetUp;
    this.#royal.entity.setLocalPosition(x, y, z);
    this.#royal.entity.setLocalEulerAngles(0, -90 * (1 - feetUp), 0);
    this.#royal.pose(action, phase);
  }
}
