export class FillHoleInteraction {
  /**
   *
    * @type {import("./BuriedTreasureField.js").BuriedTreasureField}
   */
  #field;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #target;
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
   * @param {{field: import("./BuriedTreasureField.js").BuriedTreasureField, target: {x: number, y: number, z: number}, hero: import("src/game/objects/ObjectTypes.js").HeroLike, tool: import("src/game/objects/hero/tools/HeroTool.js").HeroTool, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void}} options
   * @param {import("./BuriedTreasureField.js").BuriedTreasureField} options.field
   * @param {{x: number, y: number, z: number}} options.target
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {import("src/game/objects/hero/tools/HeroTool.js").HeroTool} options.tool
   * @param {(value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void} options.onChange
   * @param {() => void} options.onComplete
   */
  constructor({ field, target, hero, tool, onChange, onComplete }) {
    this.#field = field;
    this.#target = target;
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
      this.#field.canFill(this.#target.id) &&
      (!this.#hero.isUsingTool || this.#hero.tool === this.#tool)
    );
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.#target,
      labelKey:
        this.#hero.tool === this.#tool
          ? "game.interaction.stop_filling"
          : "game.interaction.fill_hole",
      showHealth: false,
    };
  }

  interact() {
    if (!this.canInteract) {
      return false;
    }
    if (this.#hero.isUsingTool) {
      return this.#hero.stopUsingTool();
    }
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: this.#target,
      context: { action: "fill" },
      onImpact: () => {
        const finished = this.#field.fill(this.#target);
        this.#onChange?.();
        return finished;
      },
      onComplete: this.#onComplete,
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }
}
