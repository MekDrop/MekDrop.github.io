/**
 * Subtle eye acting layered over the model's existing head animation.
 */
export class KingTrainingExpression {
  /**
   * @type {Array<{eye:import("playcanvas").Entity,scale:import("playcanvas").Vec3}>}
   */
  #eyes = [];
  /**
   * @type {number}
   */
  #openness = 1;
  /**
   * @type {number}
   */
  #target = 1;
  /**
   * @type {number}
   */
  #time = 0;
  /**
   * @type {boolean}
   */
  #active = false;
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #handle;

  /**
   * @param {import("playcanvas").Entity} model
   * @param {import("playcanvas").Application} app
   */
  constructor(model, app) {
    for (const name of ["Royal left eye", "Royal right eye"]) {
      const eye = model.findByName(name);
      if (eye) {
        this.#eyes.push({
          eye,
          scale: eye.getLocalScale().clone(),
        });
      }
    }
    this.#handle = app.on("postupdate", this.#update, this);
  }

  /**
   * @param {string} action
   * @param {string} clip
   */
  pose(action, clip) {
    this.#active = action === "sword";
    this.#target = !this.#active ? 1 : /Failure/.test(clip) ? 1.3
      : /Strike|Slash|Thrust|Lunge|Swing/.test(clip) ? 0.55 : 0.8;
  }

  /**
   * @param {number} dt
   */
  #update(dt) {
    this.#time += dt;
    this.#openness += (this.#target - this.#openness) * (1 - Math.exp(-12 * dt));
    const phase = this.#time % 4.3;
    const blink = this.#active && phase < 0.16 ? Math.abs(phase - 0.08) / 0.08 : 1;
    for (const { eye, scale } of this.#eyes) {
      eye.setLocalScale(scale.x, scale.y * Math.max(0.05, this.#openness * blink), scale.z);
    }
  }

  destroy() {
    this.#handle?.off();
    for (const { eye, scale } of this.#eyes) {
      eye.setLocalScale(scale);
    }
    this.#eyes = [];
  }
}
