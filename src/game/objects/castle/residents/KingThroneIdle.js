/**
 * Random seated performances; all offsets are relative to the authored pose.
 */
export class KingThroneIdle {
  /**
   * @type {import("playcanvas").Entity}
   */
  #head;
  /**
   * @type {import("playcanvas").Quat|null}
   */
  #base;
  /**
   * @type {import("playcanvas").Quat}
   */
  #rotation;


  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} model
   */
  constructor(pc, model) {
    this.#head = model.findByName("Royal head rig");
    this.#rotation = new pc.Quat();
  }

  restore() {
    if (this.#base) {
      this.#head.setLocalRotation(this.#base);
      this.#base = null;
    }
  }

  /**
   * @param {string} state
   * @param {number} time
   * @param {boolean} available
   */
  update(state, time, available) {
    this.restore();
    if (!available || !this.#head) {
      return;
    }
    const t = time;
    const duration = state === "dozing" ? 9.1 : state === "waking" ? 4.9 : 7;
    /**
   * @param {number} value
   */
    const smooth = (value) => {
      const x = Math.max(0, Math.min(1, value));

      return x * x * (3 - 2 * x);
    };
    const envelope = smooth(t / 1.5) * smooth((duration - t) / 1.2);
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    if (state === "dozing") {
      pitch = -32 * smooth(t / 3) * (1 - smooth((t - 8.8) / 0.3));
    } else if (state === "waking") {
      const awake = t;
      yaw = 38 * Math.sin(awake * 3) * smooth(awake / 0.25);
      pitch = 7 * Math.exp(-awake * 3);
    } else if (state === "looking") {
      yaw = 32 * Math.sin(t * 1.2);
      pitch = 5 * Math.sin(t * 0.8);
    } else {
      roll = 12 * Math.sin(t * 0.65);
      pitch = 10;
    }
    this.#base = this.#head.getLocalRotation().clone();
    this.#rotation.setFromEulerAngles(pitch * envelope, yaw * envelope, roll * envelope);
    this.#head.setLocalRotation(this.#base.clone().mul(this.#rotation));
  }
}
