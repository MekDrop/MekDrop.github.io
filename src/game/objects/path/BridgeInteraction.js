/**
 * The hammer strikes the next two-lane station, leaving the hero's footing intact.
 */
export class BridgeInteraction {
  /**
   * @type {import("./Bridge.js").Bridge|import("./Overpass.js").Overpass}
   */
  #bridge;
  /**
   * @type {import("../characters/hero/Hero.js").Hero}
   */
  #hero;
  /**
   * @type {number}
   */
  #station;
  /**
   * @type {(() => void)|undefined}
   */
  #onComplete;

  /**
   * @param {import("./Bridge.js").Bridge|import("./Overpass.js").Overpass} bridge
   * @param {import("../characters/hero/Hero.js").Hero} hero
   * @param {number} station
   * @param {(() => void)|undefined} onComplete
   */
  constructor(bridge, hero, station, onComplete) {
    this.#bridge = bridge;
    this.#hero = hero;
    this.#station = station;
    this.#onComplete = onComplete;
  }

  /**
   * @returns {boolean}
   */
  get canInteract() {
    return !this.#hero.isIncapacitated && !this.#hero.isUsingTool &&
      !this.#hero.isReacting && this.#hero.grounded !== false &&
      this.#bridge.targetStation(this.#hero) === this.#station;
  }

  /**
   * @returns {import("../../GameContracts.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.#bridge.stationPosition(this.#station),
      id: `${this.#bridge.definition.id}-${this.#station}`,
      labelKey: "game.interaction.smash_bridge",
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
    const position = this.#bridge.stationPosition(this.#station);
    const accepted = this.#hero.smashBridge({
      targetX: position.x,
      targetZ: position.z,
      onImpact: this.#onImpact.bind(this),
      onComplete: this.#onComplete,
    });
    if (accepted) {
      this.#onComplete?.();
    }
    return accepted;
  }

  #onImpact() {
    return this.#bridge.collapseStation(this.#station);
  }
}
