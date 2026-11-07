import { TREASURE_TOOL_MAX_TURN, TREASURE_TOOL_MIN_DISTANCE } from "../../config/treasure.js";

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
   * @type {import("src/game/objects/characters/hero/tools/HeroTool.js").HeroTool|null}
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
   * @param {{field: import("./BuriedTreasureField.js").BuriedTreasureField, target: {x: number, y: number, z: number}, hero: import("src/game/objects/ObjectTypes.js").HeroLike, tool: import("src/game/objects/characters/hero/tools/HeroTool.js").HeroTool, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void}} options
   * @param {import("./BuriedTreasureField.js").BuriedTreasureField} options.field
   * @param {{x: number, y: number, z: number}} options.target
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {import("src/game/objects/characters/hero/tools/HeroTool.js").HeroTool} options.tool
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
    const offset = this.#field.fillPileOffsetFor(this.#target.id);
    const dx = this.#target.x - this.#hero.position.x;
    const dz = this.#target.z - this.#hero.position.z;
    const oppositeFill = Boolean(offset &&
      offset.x * (dz * 0.42 + dx * 0.3) +
      offset.y * (-dx * 0.42 + dz * 0.3) < 0);
    const yaw = offset ? Math.atan2(0.3 * offset.x - 0.42 * offset.y,
      0.42 * offset.x + 0.3 * offset.y) : 0;
    const leveling = this.#field.isFillRimStage(this.#target.id);
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: this.#target,
      maxFacingAdjustment: TREASURE_TOOL_MAX_TURN,
      minimumTargetDistance: TREASURE_TOOL_MIN_DISTANCE,
      targetDistance: TREASURE_TOOL_MIN_DISTANCE,
      stances: offset && !leveling ? [
        {
          yaw,
          context: { oppositeFill: false },
        },
        {
          yaw: yaw + Math.PI,
          context: { oppositeFill: true },
        },
      ] : null,
      context: {
        action: leveling ? "level-hole" : "fill",
        oppositeFill,
      },
      onImpact: this.#onImpact.bind(this),
      onScoop: this.#onScoop.bind(this),
      onComplete: this.#complete.bind(this),
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   */
  #onImpact(action) {
    const finished = this.#field.fill(this.#target);
    if (action && this.#field.isFillRimStage(this.#target.id)) {
      action.toolContext.action = "level-hole";
    }
    this.#onChange?.();

    return finished;
  }

  #onScoop() {
    if (this.#field.isFillRimStage(this.#target.id)) {
      this.#field.levelFillRim(this.#target);
    } else {
      this.#field.scoopFillSoil(this.#target);
    }
  }

  #complete() {
    this.#field.returnFillSoil(this.#target);
    this.#onComplete?.();
  }
}
