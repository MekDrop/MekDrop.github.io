import { TREASURE_TOOL_MAX_TURN, TREASURE_TOOL_MIN_DISTANCE } from "../../config/treasure.js";

export class DigInteraction {
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
      this.#field.canDig(this.#target.id) &&
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
          ? "game.interaction.stop_digging"
          : "game.interaction.dig",
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
    let revealedBlockedDig = false;
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: this.#target,
      maxFacingAdjustment: TREASURE_TOOL_MAX_TURN,
      minimumTargetDistance: TREASURE_TOOL_MIN_DISTANCE,
      targetDistance: TREASURE_TOOL_MIN_DISTANCE,
      context: { action: this.#target.kind === "blocked-dig" ? "blocked-dig" : "dig" },
      onImpact: /**
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
       */
        (action) => {
          const facing = this.#hero.facingDirection;
          const finished = this.#field.dig(this.#target, facing);
          if (this.#target.kind !== "blocked-dig") {
            const offset = this.#field.pileOffsetFor(this.#target, facing);
            action.toolContext.pileOffsetX = offset?.x ?? facing.z * 0.42 + facing.x * 0.3;
            action.toolContext.pileOffsetZ = offset?.y ?? -facing.x * 0.42 + facing.z * 0.3;
            action.toolContext.oppositeThrow = Boolean(offset &&
            offset.x * (facing.z * 0.42 + facing.x * 0.3) +
            offset.y * (-facing.x * 0.42 + facing.z * 0.3) < 0);
            action.useAnimation = this.#tool.useAnimation(action.toolContext);
          }
          revealedBlockedDig =
            this.#target.kind === "blocked-dig" && finished;
          this.#onChange?.();

          return finished;
        },
      onComplete: () => {
        if (revealedBlockedDig) {
          this.#hero.reactToBlockedDig();
        }
        this.#onComplete?.();
      },
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }
}
