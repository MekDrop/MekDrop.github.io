export class TreasureChestInteraction {
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
    * @type {() => void}
   */
  #onComplete;

  /**
   *
   * @param {{field: import("./BuriedTreasureField.js").BuriedTreasureField, target: {x: number, y: number, z: number}, hero: import("src/game/objects/ObjectTypes.js").HeroLike, onComplete: () => void}} options
   * @param {import("./BuriedTreasureField.js").BuriedTreasureField} options.field
   * @param {{x: number, y: number, z: number}} options.target
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {() => void} options.onComplete
   */
  constructor({ field, target, hero, onComplete }) {
    this.#field = field;
    this.#target = target;
    this.#hero = hero;
    this.#onComplete = onComplete;
  }

  /**
   *
    * @returns {boolean}
   */
  get canInteract() {
    return !this.#hero.isUsingTool && this.#field.canOpen(this.#target.id);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").InteractionDescription}
   */
  get description() {
    return {
      ...this.#target,
      labelKey: "game.interaction.open_treasure",
      showHealth: false,
    };
  }

  interact() {
    if (!this.canInteract || !this.#field.open(this.#target)) {
      return false;
    }
    this.#onComplete?.();
    return true;
  }
}
