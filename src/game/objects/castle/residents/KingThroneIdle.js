/**
 * Random seated performances; all offsets are relative to the authored pose.
 */
export class KingThroneIdle {
  /**
   *
   */
  #head;
  /**
   *
   */
  #base;
  /**
   *
   */
  #rotation;
  /**
   *
   */
  #elapsed = 0;
  /**
   *
   */
  #delay = 8;
  /**
   *
   */
  #state = "waiting";
  /**
   *
   */
  #previous = -1;

  /**
   *
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
   *
   */
  update(deltaTime, available) {
    this.restore();
    if (!available || !this.#head) {
      this.#state = "waiting";
      this.#elapsed = 0;

      return;
    }
    this.#elapsed += deltaTime;
    if (this.#state === "waiting") {
      if (this.#elapsed < this.#delay) {
        return;
      }
      const choice = (this.#previous + 1 + Math.floor(Math.random() * 2)) % 3;
      this.#previous = choice;
      this.#state = ["dozing", "looking", "bored"][choice];
      this.#elapsed = 0;
    }
    const t = this.#elapsed;
    const duration = this.#state === "dozing" ? 14 : 7;
    if (t >= duration) {
      this.#state = "waiting";
      this.#elapsed = 0;
      this.#delay = 10 + Math.random() * 18;

      return;
    }
    /**
     *
     */
    const smooth = (value) => {
      const x = Math.max(0, Math.min(1, value));

      return x * x * (3 - 2 * x);
    };
    const envelope = smooth(t / 1.5) * smooth((duration - t) / 1.2);
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    if (this.#state === "dozing") {
      pitch = -32 * smooth(t / 3) * (1 - smooth((t - 8.8) / 0.3));
      if (t > 9.1) {
        const awake = t - 9.1;
        yaw = 38 * Math.sin(awake * 3) * smooth(awake / 0.25);
        pitch = 7 * Math.exp(-awake * 3);
      }
    } else if (this.#state === "looking") {
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
