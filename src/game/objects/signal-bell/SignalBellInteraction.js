/**
 * An explicit E action available within reach and on the bell's elevation.
 */
export class SignalBellInteraction {
  /**
   * @type {import("./SignalBell.js").SignalBell}
   */
  #bell;
  /**
   * @type {import("../hero/Hero.js").Hero}
   */
  #hero;
  /**
   * @type {(()=>void)|undefined}
   */
  #onComplete;

  /**
   * @param {import("./SignalBell.js").SignalBell} bell
   * @param {import("../hero/Hero.js").Hero} hero
   * @param {(()=>void)|undefined} onComplete
   */
  constructor(bell, hero, onComplete) {
    this.#bell = bell;
    this.#hero = hero;
    this.#onComplete = onComplete;
  }

  /**
   * @returns {boolean}
   */
  get canInteract() {
    const position = this.#hero.position;
    const bell = this.#bell.position;

    return !this.#hero.isIncapacitated && !this.#hero.isUsingTool && !this.#hero.isReacting && this.#bell.canRing &&
      Math.abs(position.y - bell.y) < 0.7 && Math.hypot(position.x - bell.x, position.z - bell.z) < 1.25;
  }

  /**
   * @returns {import("../../GameContracts.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.#bell.position,
      id: this.#bell.definition.id,
      labelKey: "game.interaction.ring_bell",
      showHealth: false,
    };
  }

  /**
   * @returns {boolean}
   */
  interact() {
    if (!this.canInteract) { return false; }
    const accepted = this.#hero.ringBell({
      ...this.#bell.ringingPose,
      onStart: this.#onStart.bind(this),
      /**
       * @param {number} time
       */
      onProgress: this.#onProgress.bind(this),
      onStrike: this.#onStrike.bind(this),
      onEnd: this.#onEnd.bind(this),
    });
    if (!accepted) { return false; }
    this.#bell.beginRinging();
    this.#onComplete?.();

    return true;
  }

  #onStart() {
    return this.#bell.startPull(this.#hero);
  }

  /**
   * @param {number} time
   */
  #onProgress(time) {
    return this.#bell.setPullTime(time);
  }

  #onStrike() {
    return this.#bell.strike();
  }

  #onEnd() {
    this.#bell.endRinging();
    this.#onComplete?.();
  }
}
