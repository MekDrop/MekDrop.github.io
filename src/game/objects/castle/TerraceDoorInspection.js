import { TERRACE_DOOR_INSPECTION_PHASE as PHASE } from "../../enum/TerraceDoorInspectionPhase.js";

const STEPS = [
  [PHASE.WAIT, 30],
  [PHASE.NOTICE, 1.2],
  [PHASE.WALK_OUT, 3],
  [PHASE.LOOK_LEFT, 1.8],
  [PHASE.LOOK_RIGHT, 2.4],
  [PHASE.RETURN, 2],
  [PHASE.GRASP, 0.7],
  [PHASE.CLOSE, 2],
  [PHASE.RELEASE, 0.5],
  [PHASE.LEAVE, 1.8],
];

/** Game-time choreography: no timeout survives a pause or a destroyed castle. */
export class TerraceDoorInspection {
  #step = -1;
  #elapsed = 0;

  get phase() {
    return STEPS[this.#step]?.[0] ?? PHASE.IDLE;
  }

  get active() {
    return this.#step >= 0;
  }

  get inspecting() {
    return this.active && this.phase !== PHASE.WAIT;
  }

  get doorOpen() {
    return this.active && ![PHASE.CLOSE, PHASE.RELEASE, PHASE.LEAVE].includes(this.phase);
  }

  get elapsed() {
    return this.#elapsed;
  }

  get progress() {
    return this.active ? Math.min(1, this.#elapsed / STEPS[this.#step][1]) : 0;
  }

  start() {
    // Repeated clicks must not postpone the servant or spawn extra visits.
    if (this.active) {
      return false;
    }
    this.#step = 0;
    this.#elapsed = 0;
    return true;
  }

  update(deltaTime, doorwayBusy = false) {
    if (!this.active || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.#elapsed += deltaTime;
    while (this.active && this.#elapsed >= STEPS[this.#step][1]) {
      if (this.phase === PHASE.WAIT && doorwayBusy) {
        this.#elapsed = STEPS[this.#step][1];
        return;
      }
      this.#elapsed -= STEPS[this.#step][1];
      this.#step += 1;
      if (this.#step === STEPS.length) {
        this.reset();
      }
    }
  }

  reset() {
    this.#step = -1;
    this.#elapsed = 0;
  }
}
