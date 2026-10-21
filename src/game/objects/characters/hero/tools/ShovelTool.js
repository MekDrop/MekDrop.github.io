import { Vec3 } from "playcanvas";
import shovelModelUrl from "../../../../models/hero/tools/shovel.glb?url";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";
import { SHOVEL_FILL_RELEASE_TIME, SHOVEL_LEVEL_DURATION, SHOVEL_LEVEL_IMPACT_TIME, TREASURE_DIG_STROKES } from "../../../../config/treasure.js";
import { ShovelSoil } from "./ShovelSoil.js";

export class ShovelTool extends HeroTool {
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {ShovelSoil|null}
   */
  #soil = null;
  /**
   * @type {(x: number, z: number) => number}
   */
  #islandOffsetAt;
  /**
   * @returns {Vec3}
   */
  get mountOffset() {
    return new Vec3(0, -0.07, 0);
  }

  /**
   * @param {import("playcanvas").Entity} parent
   */
  mount(parent) {
    super.mount(parent.findByName("Right white glove"));
    let owner = parent;
    while (owner.parent && !owner.anim) {
      owner = owner.parent;
    }
    if (this.entity.findByName("Shovel soil load")) {
      this.#soil ??= new ShovelSoil({
        app: this.#app,
        owner,
        shovel: this.entity,
        islandOffsetAt: this.#islandOffsetAt,
      });
    }
  }

  /**
   * @param {number} deltaTime
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null} action
   */
  update(deltaTime, action) {
    this.#soil?.update(deltaTime, action?.tool === this ? action : null);
  }

  syncIslandOffsets() {
    this.#soil?.syncIslandOffsets();
  }

  destroy() {
    this.#soil?.destroy();
    this.#soil = null;
    super.destroy();
  }

  /**
   * @returns {number}
   */
  get useDuration() {
    return 1.6;
  }

  /**
   * @returns {number}
   */
  get summonDuration() {
    return 0.6;
  }

  /**
   * @returns {number}
   */
  get summonVisibilityTime() {
    return 0.1;
  }

  /**
   * @returns {number}
   */
  get dismissDuration() {
    return 0.6;
  }

  /**
   * @returns {number}
   */
  get impactTime() {
    return 0.6;
  }

  /**
   * @param {{action?: string}} context
   * @returns {number}
   */
  useDurationFor(context = {}) {
    return this.strokeDurationFor(context) * (["fill", "level-hole"].includes(context.action) ? 1 : TREASURE_DIG_STROKES);
  }

  /**
   * @param {{action?: string}} context
   * @returns {number}
   */
  strokeDurationFor(context = {}) {
    return context.action === "level-hole" ? SHOVEL_LEVEL_DURATION : this.useDuration;
  }

  /**
   * @param {{action?: string}} context
   * @returns {number[]}
   */
  impactTimes(context = {}) {
    if (context.action === "level-hole") {
      return [SHOVEL_LEVEL_IMPACT_TIME];
    }
    if (context.action === "fill") {
      return [SHOVEL_FILL_RELEASE_TIME];
    }
    const count = TREASURE_DIG_STROKES;

    return Array.from({ length: count }, /**
     *
     * @param {undefined} _
     * @param {number} index
     */
      (_, index) => this.impactTime + index * this.useDuration);
  }

  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return shovelModelUrl;
  }

  /**
   *
   * @param {{modelLibrary: string, app: import("playcanvas").Application, islandOffsetAt?: (x: number, z: number) => number}} options
   * @param {string} options.modelLibrary
   * @param {(x: number, z: number) => number} [options.islandOffsetAt]
   */
  constructor({ modelLibrary, app, islandOffsetAt = () => 0 }) {
    super({
      modelLibrary,
      modelUrl: ShovelTool.modelUrl,
      name: "shovel",
    });

    this.#app = app;
    this.#islandOffsetAt = islandOffsetAt;
  }

  /**
   *
    * @returns {string|number}
   */
  get summonAnimation() {
    return HERO_ANIMATION.SUMMON_SHOVEL;
  }

  /**
   *
    * @returns {string|number}
   */
  get dismissAnimation() {
    return HERO_ANIMATION.DISMISS_SHOVEL;
  }

  /**
   *
   * @param {{action?: string, oppositeThrow?: boolean}} context
   */
  useAnimation(context = {}) {
    if (context.action === "level-hole") {
      return HERO_ANIMATION.LEVEL_HOLE;
    }
    return context.action === "fill"
      ? HERO_ANIMATION.FILL_HOLE
      : context.oppositeThrow ? HERO_ANIMATION.DIG_OPPOSITE : HERO_ANIMATION.DIG;
  }
}
