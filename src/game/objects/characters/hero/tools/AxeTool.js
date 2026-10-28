import axeModelUrl from "../../../../models/hero/tools/axe.glb?url";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroTool } from "./HeroTool.js";
import { Vec3 } from "playcanvas";
import { AxeSupportGrip } from "./AxeSupportGrip.js";
import { AxeCuttingEdge } from "./AxeCuttingEdge.js";
import { DetachedShaderWarmup } from "../../../../rendering/DetachedShaderWarmup.js";

const CUT_ANIMATIONS = [
  HERO_ANIMATION.CHOP_LOW,
  HERO_ANIMATION.CHOP_ROW_2,
  HERO_ANIMATION.CHOP_MIDDLE,
  HERO_ANIMATION.CHOP_ROW_4,
  HERO_ANIMATION.CHOP_ROW_5,
  HERO_ANIMATION.CHOP_HIGH,
  HERO_ANIMATION.CHOP_ROW_7,
];

export class AxeTool extends HeroTool {
  /**
   * @type {import("../../../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #models;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #shaderTemplate = null;
  /**
   * @type {DetachedShaderWarmup|null}
   */
  #shaderWarmup = null;
  /**
   * @type {AxeSupportGrip}
   */
  #supportGrip;
  /**
   * @type {AxeCuttingEdge|null}
   */
  #cuttingEdge = null;
  /**
   * @type {import("playcanvas").Vec3[]}
   */
  #previousEdge = [];
  /**
   * @type {number}
   */
  #previousTime = 0;
  /**
   * @type {string|null}
   */
  #previousPhase = null;
  /**
   * @type {string|number|null}
   */
  #previousAnimation = null;
  /**
   * @type {boolean}
   */
  #clearingStance = false;
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return axeModelUrl;
  }

  /**
   *
   * @param {{modelLibrary: string}} options
   * @param {string} options.modelLibrary
   */
  constructor({ modelLibrary }) {
    super({
      modelLibrary,
      modelUrl: AxeTool.modelUrl,
      name: "axe",
    });

    this.#models = modelLibrary;
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   */
  prepareShaders(pc, app) {
    if (!this.#shaderWarmup) {
      this.#shaderTemplate = this.#models.instantiate(AxeTool.modelUrl);
      this.#shaderWarmup = new DetachedShaderWarmup(pc, app, this.#shaderTemplate);
    }
  }

  destroy() {
    this.#shaderWarmup?.destroy();
    this.#shaderTemplate?.destroy();
    this.#shaderWarmup = null;
    this.#shaderTemplate = null;
    super.destroy();
  }

  /**
   *
    * @returns {string|number}
   */
  get summonAnimation() {
    return HERO_ANIMATION.SUMMON_AXE;
  }

  /**
   *
    * @returns {string|number}
   */
  get dismissAnimation() {
    return HERO_ANIMATION.DISMISS_AXE;
  }

  /**
   *
   * @param {{heightClass?: string, cutHeight?: number}} options
   * @param {string} [options.heightClass]
   * @param {number} [options.cutHeight]
   */
  useAnimation({ heightClass, cutHeight } = {}) {
    if (Number.isFinite(cutHeight)) {
      const row = Math.max(0, Math.min(CUT_ANIMATIONS.length - 1, Math.round((cutHeight - 0.125) / 0.25)));

      return CUT_ANIMATIONS[row];
    }
    switch (heightClass) {
      case "low":
        return HERO_ANIMATION.CHOP_LOW;
      case "middle":
        return HERO_ANIMATION.CHOP_MIDDLE;
      case "high":
        return HERO_ANIMATION.CHOP_HIGH;
      default:
        return null;
    }
  }

  /**
   * @returns {Vec3}
   */
  get mountOffset() {
    return new Vec3(0, -0.08, 0.095);
  }

  /**
   * @returns {number}
   */
  get useDuration() {
    return 1.5;
  }

  /**
   * @returns {number}
   */
  get impactTime() {
    return 0.60;
  }

  /**
   * Let the wrist settle into the authored carrying pose before revealing the tool.
   * @returns {number}
   */
  get summonVisibilityTime() {
    return 0.33;
  }

  /**
   * @returns {number}
   */
  get dismissVisibilityTime() {
    return 0.32;
  }

  /**
   * @param {{cutHeight:number}} target
   * @returns {number}
   */
  targetDistanceFor(target) {
    const row = Math.max(0, Math.min(6, Math.round((target.cutHeight - 0.125) / 0.25)));

    return [0.95, 0.95, 1.01, 0.98, 0.90, 0.68, 0.50][row];
  }

  /**
   * The sharpened bit leads the head pivot laterally at contact.
   * @returns {number}
   */
  get contactLateralOffset() {
    return 0.12;
  }

  /**
   * @param {import("playcanvas").Entity} parent
   */
  mount(parent) {
    this.#supportGrip = new AxeSupportGrip(parent);
    super.mount(parent.findByName("Axe grip") ?? parent.findByName("Right white glove"));
    const offset = this.mountOffset;
    this.entity.setLocalPosition(offset.x, offset.y, offset.z);
    // Seat the shaft across the curled fingers rather than at the wrist pivot.
    this.entity.setLocalEulerAngles(0, 0, 90);
    this.#cuttingEdge = new AxeCuttingEdge(this.entity);
    this.#previousEdge = [];
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null} action
   */
  renderUpdate(action) {
    if (action?.tool === this && !action.positioning && this.entity?.enabled) {
      if (action.elapsed === this.#previousTime && action.phase === this.#previousPhase
        && action.useAnimation === this.#previousAnimation) {
        return;
      }
      if (action.phase === "use" && (this.#previousPhase !== "use" || this.#previousAnimation !== action.useAnimation)) {
        this.#clearingStance = true;
      }
      if (action.elapsed >= 0.32) {
        this.#clearingStance = false;
      }
      // Quaternion blends can lower the haft through the advancing boot even
      // when both authored poses are clear. Guide it beside the boot until the foot plants.
      const blend = Math.max(0, Math.min(1, (action.elapsed - 0.14) / 0.18));
      const clearance = this.#clearingStance && action.phase === "use" && action.useAnimation === HERO_ANIMATION.CHOP_LOW
        ? 0.12 * Math.sin(Math.PI * blend) ** 2 : 0;
      this.#supportGrip?.update(this.entity, action.phase !== "summon", clearance);
      const edge = this.#cuttingEdge.points();
      const contactStart = action.useAnimation === HERO_ANIMATION.CHOP_LOW ? 0.34 : 0.48;
      if (action.phase === "use" && action.elapsed >= contactStart && action.elapsed <= 0.80
        && action.elapsed > this.#previousTime && !action.stopAfterCycle) {
        action.onContact?.(action, this.#previousEdge, edge);
      }
      this.#previousEdge = edge;
      this.#previousTime = action.elapsed;
      this.#previousPhase = action.phase;
      this.#previousAnimation = action.useAnimation;
    } else {
      this.#previousEdge = [];
      this.#previousTime = 0;
      this.#previousPhase = null;
    }
  }
}
