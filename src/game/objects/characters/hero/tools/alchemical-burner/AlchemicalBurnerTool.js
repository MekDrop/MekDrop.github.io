import modelUrl from "../../../../../models/hero/tools/alchemical-burner.glb?url";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HeroTool } from "../HeroTool.js";
import { BurnerFlame } from "./BurnerFlame.js";
import { Vec3 } from "playcanvas";
import { DetachedShaderWarmup } from "../../../../../rendering/DetachedShaderWarmup.js";

export class AlchemicalBurnerTool extends HeroTool {
  /**
   * @type {string}
   */
  static modelUrl = modelUrl;
  /**
   * @type {Record<string,string>}
   */
  static textureUrls = BurnerFlame.textureUrls;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {BurnerFlame|null}
   */
  #flame = null;
  /**
   * @type {DetachedShaderWarmup|null}
   */
  #warmup = null;

  /**
   * @param {{pc:typeof import("playcanvas"),modelLibrary:import("../../../../../models/GameModelLibrary.js").GameModelLibrary,app:import("playcanvas").Application}} options
   */
  constructor({ modelLibrary, app, pc }) {
    super({
      modelLibrary,
      modelUrl,
      name: "burner",
    });

    this.#app = app;
    this.#pc = pc;
  }

  /**
   * @returns {string}
   */
  get summonAnimation() {
    return HERO_ANIMATION.BURN_BUSH_MIDDLE;
  }

  /**
   * @returns {string}
   */
  get dismissAnimation() {
    return HERO_ANIMATION.IDLE;
  }

  /**
   * @returns {number}
   */
  get summonDuration() {
    return 0.28;
  }

  /**
   * @returns {number}
   */
  get dismissDuration() {
    return 0.28;
  }

  /**
   * @returns {number}
   */
  get useDuration() {
    return 0.5;
  }

  /**
   * @returns {number}
   */
  get impactTime() {
    return 0.30;
  }

  /**
   * @returns {Vec3}
   */
  get mountOffset() {
    return new Vec3();
  }

  /**
   * @param {{cutHeight?:number}} context
   * @returns {string}
   */
  useAnimation({ cutHeight = 0.375 } = {}) {
    return cutHeight < 0.25 ? HERO_ANIMATION.BURN_BUSH_LOW
      : cutHeight < 0.5 ? HERO_ANIMATION.BURN_BUSH_MIDDLE : HERO_ANIMATION.BURN_BUSH_HIGH;
  }

  /**
   * @returns {number}
   */
  targetDistanceFor() {
    return 0.58;
  }

  /**
   * Allocate the pooled device and emitter while its interaction prompt is visible.
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   */
  prepareShaders(pc, app) {
    if (this.entity) {
      return;
    }
    super.mount(app.root);
    this.#flame = new BurnerFlame(pc, app, this.entity.findByName("Burner nozzle"));
    this.#warmup = new DetachedShaderWarmup(pc, app, this.entity);
  }

  /**
   * @param {import("playcanvas").Entity} parent
   */
  mount(parent) {
    this.prepareShaders(this.#pc, this.#app);
    super.mount(parent.findByName("Right white glove"));
  }

  /**
   * @param {import("../../../../ObjectTypes.js").HeroActionPayload|null} action
   */
  renderUpdate(action) {
    if (this.#flame) {
      this.#flame.firing = action?.tool === this && !action.positioning && action.phase === "use"
        && action.elapsed >= 0.06 && action.elapsed <= 0.34;
    }
  }

  destroy() {
    this.#warmup?.destroy();
    this.#warmup = null;
    this.#flame = null;
    super.destroy();
  }
}
