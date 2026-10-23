/**
 * Opens a reachable hatch without requiring a ladder.
 */
export class HatchInteraction {
  /**
   * @type {import("./Hatch.js").Hatch}
   */
  #hatch;
  /**
   * @type {import("../../characters/hero/Hero.js").Hero}
   */
  #hero;
  /**
   * @type {(()=>void)|undefined}
   */
  #onComplete;
  /**
   * @param {import("./Hatch.js").Hatch} hatch
   * @param {import("../../characters/hero/Hero.js").Hero} hero
   * @param {(()=>void)|undefined} onComplete
   */
  constructor(hatch, hero, onComplete) {
    this.#hatch = hatch;
    this.#hero = hero;
    this.#onComplete = onComplete;
  }
  /**
   * @returns {boolean}
   */
  get canInteract() {
    const origin = this.#hatch.visualRoots[0].getPosition();
    const position = this.#hero.position;

    return !this.#hero.isIncapacitated && !this.#hero.isUsingTool &&
      Math.abs(position.y - origin.y) < 2.05 && Math.hypot(position.x - origin.x, position.z - origin.z) < 1;
  }
  /**
   * @returns {import("../../../GameContracts.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.#hatch.visualRoots[0].getPosition(),
      id: this.#hatch.definition.id,
      labelKey: this.#hatch.locked ? "game.interaction.locked_hatch" : "game.interaction.open_hatch",
      showHealth: false,
    };
  }
  /**
   * @returns {boolean}
   */
  interact() {
    if (!this.canInteract || !this.#hatch.open()) {
      return false;
    }
    this.#onComplete?.();

    return true;
  }
}
