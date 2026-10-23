/**
 * Uses the normal interaction HUD for an explicit climb between ladder landings.
 */
export class LadderInteraction {
  /**
   * @type {import("./Ladder.js").Ladder}
   */
  #ladder;
  /**
   * @type {import("../../characters/hero/Hero.js").Hero}
   */
  #hero;
  /**
   * @type {"bottom"|"top"}
   */
  #end;
  /**
   * @type {(()=>void)|undefined}
   */
  #onComplete;

  /**
   * @param {import("./Ladder.js").Ladder} ladder
   * @param {import("../../characters/hero/Hero.js").Hero} hero
   * @param {"bottom"|"top"} end
   * @param {(()=>void)|undefined} onComplete
   */
  constructor(ladder, hero, end, onComplete) {
    this.#ladder = ladder; this.#hero = hero; this.#end = end; this.#onComplete = onComplete;
  }

  /**
   * @returns {boolean}
   */
  get canInteract() {
    const position = this.#hero.position;
    const landing = this.#ladder.landing(this.#end);

    return !this.#ladder.passageBlocked && !this.#hero.isIncapacitated && !this.#hero.isUsingTool && Math.abs(position.y - landing.y) < 0.65 &&
      Math.hypot(position.x - landing.x, position.z - landing.z) < 0.85;
  }

  /**
   * @returns {import("../../../GameContracts.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.#ladder.landing(this.#end),
      id: this.#ladder.definition.id,
      labelKey: this.#end === "bottom" ? "game.interaction.climb_ladder" : "game.interaction.descend_ladder",
      showHealth: false,
    };
  }

  /**
   * @returns {boolean}
   */
  interact() {
    if (!this.canInteract) {
      return false;
    }
    this.#ladder.openHatch?.();
    const accepted = this.#hero.teleport(this.#ladder.landing(this.#end === "bottom" ? "top" : "bottom"));
    if (accepted) {
      this.#onComplete?.();
    }
    return accepted;
  }
}
