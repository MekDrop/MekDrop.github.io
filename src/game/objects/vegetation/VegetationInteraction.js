import { AXE_HIT_STOP_DURATION } from "../../config/axe.js";

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
   * @type {() => void}
   */
  #onDestroyed;

  /**
   *
   * @param {{item: import("./DestructibleVegetation.js").DestructibleVegetation, hero: import("src/game/objects/ObjectTypes.js").HeroLike, tool: import("src/game/objects/characters/hero/tools/HeroTool.js").HeroTool, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void, onDestroyed: () => void}} options
   * @param {import("./DestructibleVegetation.js").DestructibleVegetation} options.item
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {import("src/game/objects/characters/hero/tools/HeroTool.js").HeroTool} options.tool
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
        ? target.kind === "bush" ? "game.interaction.stop_burning" : "game.interaction.stop_cutting"
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
    const surface = this.#cuttingTarget();
    const target = this.#item.describe();
    const accepted = this.#hero.useTool(this.#tool, {
      targetPosition: surface,
      targetDistance: this.#tool.targetDistanceFor?.(target) ?? 0.62,
      stances: [{
        yaw: surface.yaw,
        context: {},
      }],
      context: {
        heightClass: target.heightClass,
        cutHeight: target.cutHeight,
        verticalCut: target.verticalCut,
      },
      onImpact: this.#onImpact.bind(this),
      onContact: this.#onContact.bind(this),
      onCycle: this.#onCycle.bind(this),
      onComplete: this.#onComplete,
    });
    if (accepted) {
      this.#onChange?.();
    }
    return accepted;
  }

  /**
   * Step up to the new exposed face only after the previous stroke has recovered.
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   * @returns {boolean}
   */
  #onCycle(action) {
    const surface = this.#cuttingTarget();
    const target = this.#item.describe();
    if (action) {
      action.toolContext.heightClass = target.heightClass;
      action.toolContext.cutHeight = target.cutHeight;
      action.toolContext.verticalCut = target.verticalCut;
    }
    if (this.#tool.name === "burner") {
      return true;
    }
    const distance = this.#tool.targetDistanceFor?.(target) ?? 0.62;

    return this.#hero.repositionTool(surface, distance, [{
      yaw: surface.yaw,
      context: {},
    }]);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   */
  #onImpact(action) {
    if (this.#tool.name === "burner") {
      const result = this.#item.burnLevel(action.toolContext.cutHeight);
      if (result) {
        this.#handleCut(action, result);
      }

      return !this.#item.canInteract;
    }
    if (action.toolContext?.verticalCut) {
      const result = this.#item.cutVertical();
      if (result) {
        this.#handleCut(action, result);

        return true;
      }
    }

    return !this.#item.canInteract;
  }

  #cuttingTarget() {
    const surface = this.#item.cuttingTargetFrom(this.#hero.position);
    const offset = this.#tool.contactLateralOffset ?? 0;
    surface.x -= Math.cos(surface.yaw) * offset;
    surface.z += Math.sin(surface.yaw) * offset;

    return surface;
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   * @param {import("playcanvas").Vec3[]} previous
   * @param {import("playcanvas").Vec3[]} current
   */
  #onContact(action, previous, current) {
    if (this.#tool.name === "burner" || action.toolContext.verticalCut) {
      return;
    }
    const result = this.#item.cutSweep(previous, current, action.toolContext.cutHeight);
    if (!result) {
      return;
    }
    this.#handleCut(action, result);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   * @param {{destroyed:boolean,felled?:boolean}} result
   */
  #handleCut(action, result) {
    // Bushes may report several swept columns in one stroke. Pause only once.
    if (this.#tool.name !== "burner" && !action.chopHitStopped) {
      action.chopHitStopped = true;
      action.hitStopRemaining = AXE_HIT_STOP_DURATION;
      action.hitStopActive = true;
    }
    if (this.#tool.name !== "burner") {
      this.#hero.playToolContact?.("axe", Boolean(result.destroyed || result.felled));
    }
    if (result.felled) {
      action.stopAfterCycle = true;
      action.impactIndex = Math.max(1, action.impactIndex ?? 0);
    }
    if (result?.destroyed) {
      action.stopAfterCycle = true;
      action.impactIndex = Math.max(1, action.impactIndex ?? 0);
      this.#onDestroyed?.(result);
    }
    this.#onChange?.();
  }
}
