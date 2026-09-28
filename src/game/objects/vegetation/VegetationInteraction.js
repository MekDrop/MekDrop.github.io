export class VegetationInteraction {
  /**
   *
    * @type {import("./DestructibleVegetation.js").DestructibleVegetation}
   */
  #item;
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
    * @type {() => void}
   */
  #onDestroyed;

  /**
   *
   * @param {{item: import("./DestructibleVegetation.js").DestructibleVegetation, hero: import("src/game/objects/ObjectTypes.js").HeroLike, tool: import("src/game/objects/hero/tools/HeroTool.js").HeroTool, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void, onDestroyed: () => void}} options
   * @param {import("./DestructibleVegetation.js").DestructibleVegetation} options.item
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {import("src/game/objects/hero/tools/HeroTool.js").HeroTool} options.tool
   * @param {(value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void} options.onChange
   * @param {() => void} options.onComplete
   * @param {() => void} options.onDestroyed
   */
  constructor({ item, hero, tool, onChange, onComplete, onDestroyed }) {
    this.#item = item;
    this.#hero = hero;
    this.#tool = tool;
    this.#onChange = onChange;
    this.#onComplete = onComplete;
    this.#onDestroyed = onDestroyed;
  }

  /**
   *
    * @returns {boolean}
   */
  get canInteract() {
    return (
      this.#item.canInteract &&
      (!this.#hero.isUsingTool || this.#hero.tool === this.#tool)
    );
  }

  /**
   *
    * @returns {{x: number, y: number, z: number}}
   */
  get description() {
    const target = this.#item.describe();
    const active = this.#hero.tool === this.#tool;
    return {
      ...target,
      labelKey: active
        ? "game.interaction.stop_cutting"
        : target.kind === "bush"
          ? "game.interaction.clear_bush"
          : "game.interaction.chop_tree",
      showHealth: true,
    };
  }

  interact() {
    if (!this.canInteract) {
      return false;
    }
    if (this.#hero.isUsingTool) {
      return this.#hero.stopUsingTool();
    }
    const target = this.#item.describe();
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: target,
      context: { heightClass: target.heightClass },
      onImpact: () => {
        const result = this.#item.interact();
        if (result?.destroyed) {
          this.#onDestroyed?.(result);
        }
        this.#onChange?.();
        return result?.destroyed ?? true;
      },
      onComplete: this.#onComplete,
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }
}
