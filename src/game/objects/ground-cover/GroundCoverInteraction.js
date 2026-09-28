export class GroundCoverInteraction {
  /**
   *
    * @type {number}
   */
  #collectible;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").HeroLike}
   */
  #hero;
  /**
   *
    * @type {import("src/game/objects/hero/tools/HeroTool.js").HeroTool|null}
   */
  #tool;
  /**
   *
    * @type {(value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void}
   */
  #onChange;
  /**
   *
    * @type {() => void}
   */
  #onComplete;

  /**
   *
   * @param {{collectible: number, hero: import("src/game/objects/ObjectTypes.js").HeroLike, tool: import("src/game/objects/hero/tools/HeroTool.js").HeroTool, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void}} options
   * @param {number} options.collectible
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {import("src/game/objects/hero/tools/HeroTool.js").HeroTool} options.tool
   * @param {(value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void} options.onChange
   * @param {() => void} options.onComplete
   */
  constructor({ collectible, hero, tool, onChange, onComplete }) {
    this.#collectible = collectible;
    this.#hero = hero;
    this.#tool = tool;
    this.#onChange = onChange;
    this.#onComplete = onComplete;
  }

  /**
   *
    * @returns {boolean}
   */
  get canInteract() {
    return (
      this.#collectible.canInteract &&
      !this.#hero.isCollecting &&
      !this.#hero.isRefusingInventoryPickup
    );
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").InteractionDescription}
   */
  get description() {
    return this.#collectible.describe();
  }

  interact() {
    if (!this.canInteract) {
      return false;
    }

    if (this.#hero.inventoryFull) {
      const started = this.#hero.refuseInventoryPickup(
        this.#collectible.category,
        {
          targetPosition: this.#collectible.position,
          targetRadius: this.#collectible.interactionRadius,
          onComplete: this.#onComplete,
        },
      );
      if (started) {
        this.#onChange?.();
      }
      return started;
    }

    const started = this.#hero.collectGroundCover(
      this.#collectible.category,
      {
        targetPosition: this.#collectible.position,
        targetRadius: this.#collectible.interactionRadius,
        tool: this.#tool,
        heldItem: this.#collectible.createHeldItem(),
        onImpact: () => this.#collectible.collect(),
        onComplete: this.#onComplete,
      },
    );
    if (started) {
      this.#onChange?.();
    }
    return started;
  }
}
