import { Vec3 } from "playcanvas";
import modelUrl from "../../../models/castle/residential/crown-ladder.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * A map-owned ladder linking supported lower and upper landings.
 */
export class Ladder extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #climbUpdate;
  /**
   * @type {(()=>void)|undefined}
   */
  #releaseClimber;
  /**
   * @type {import("../../ObjectTypes.js").MapObjectRuntime}
   */
  #runtime;
  /**
   * @type {import("../hatch/Hatch.js").Hatch|undefined}
   */
  #linkedHatch;
  /**
   * @type {number|undefined}
   */
  #hatchRevision;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [modelUrl];
  }

  /**
   * Place the rails ahead of the lower landing when only endpoints are authored.
   * Explicit castle rail positions and headings retain their existing placement.
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {import("../../ObjectTypes.js").MapObjectDefinition}
   */
  static resolveDefinition(definition) {
    const { bottom, top } = definition;
    const rotation = definition.rotation ?? Math.atan2(top.x - bottom.x, top.z - bottom.z) * 180 / Math.PI;
    const angle = rotation * Math.PI / 180;

    return {
      ...definition,
      rotation,
      position: definition.position ?? {
        x: bottom.x + Math.sin(angle) * 0.375,
        y: bottom.y,
        z: bottom.z + Math.cos(angle) * 0.375,
      },
    };
  }

  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    options = {
      ...options,
      definition: Ladder.resolveDefinition(options.definition),
    };
    super(options);

    this.#climbUpdate = options.app.on("update", () => {
      if (!this.#releaseClimber) {
        this.#releaseClimber = options.runtime?.getHero?.()?.registerLadder?.(this);
      }
    });
    this.#runtime = options.runtime;
  }

  /**
   * Rest the rails against the hatch opening's inner face, below the lid.
   * @param {import("playcanvas").Entity} model
   */
  prepareModel(model) {
    const { opening: hatch, position, rotation = 0, top } = this.definition;
    const height = Math.max(0.1, top.y - position.y - (hatch ? 0.07 : 0.12));
    let offset = 0;
    if (hatch) {
      const angle = rotation * Math.PI / 180;
      const center = (hatch.position.x - position.x) * Math.sin(angle) +
        (hatch.position.z - position.z) * Math.cos(angle);
      // The bare rail tips are 75 mm deep; their back face meets the opening.
      const reach = Math.max(0, hatch.depth / 2 - 0.0375);
      offset = center + (center >= 0 ? -1 : 1) * reach;
    }
    model.setLocalScale(1, Math.hypot(height, offset) / 3.7, 1);
    model.setLocalEulerAngles(Math.atan2(offset, height) * 180 / Math.PI, 0, 0);
  }

  /**
   * Open for the climb, then leave the rooftop sealed again.
   */
  openHatch() {
    const hatch = this.connectedHatch;

    return this.definition.hatchId ? (hatch?.open() ?? false) : true;
  }

  /**
   * @returns {import("../hatch/Hatch.js").Hatch|undefined}
   */
  get connectedHatch() {
    if (!this.definition.hatchId) {
      return undefined;
    }
    const objects = this.#runtime?.objects;
    if (this.#linkedHatch && this.#hatchRevision === objects?.revision) {
      return this.#linkedHatch;
    }
    this.#hatchRevision = objects?.revision;
    this.#linkedHatch = [...(objects ?? [])].find(/**
     *
     * @param {import("../hatch/Hatch.js").Hatch} item
     */
      item => item.definition?.id === this.definition.hatchId);

    return this.#linkedHatch;
  }

  /**
   * @returns {boolean}
   */
  get passageBlocked() {
    return Boolean(this.definition.hatchId && (!this.connectedHatch || this.connectedHatch.locked));
  }

  // Keep the authored rail transform available to the climbing guide.
  onSceneReady() {}

  destroy() {
    this.#climbUpdate?.off(); this.#releaseClimber?.(); super.destroy();
  }

  /**
   * @returns {{x:number,z:number}}
   */
  get climbFacing() {
    const bottom = this.landing("bottom");
    const root = this.visualRoots[0].getPosition();
    const length = Math.hypot(root.x - bottom.x, root.z - bottom.z) || 1;

    return {
      x: (root.x - bottom.x) / length,
      z: (root.z - bottom.z) / length,
    };
  }

  /**
   * Step off beside either rail, outside the hatch frame.
   * @returns {Array<{x:number,y:number,z:number}>}
   */
  get topLandings() {
    const top = this.landing("top");
    if (!this.definition.opening) {
      return [top];
    }
    const guide = this.climbGuide(top.y);
    const angle = (this.definition.rotation ?? 0) * Math.PI / 180;
    const offset = this.definition.opening.width / 2 + 0.2;
    const facing = this.climbFacing;

    return [-1, 1].map(/**
     *
     * @param {number} side
     */
      side => ({
        x: guide.x + side * Math.cos(angle) * offset - facing.x * 0.12,
        y: top.y,
        z: guide.z - side * Math.sin(angle) * offset - facing.z * 0.12,
      }));
  }

  /**
   * Follow the rail lean while retaining the body's standing clearance.
   * @param {number} height
   * @returns {{x:number,y:number,z:number}}
   */
  climbGuide(height) {
    const bottom = this.landing("bottom"), top = this.landing("top");
    const root = this.visualRoots[0].getPosition();
    const amount = Math.max(0, Math.min(1, (height - bottom.y) / (top.y - bottom.y)));
    const rail = this.visualRoots[0].children[0].getWorldTransform().transformPoint(new Vec3(0, 3.7 * amount, 0));
    const distance = Math.hypot(bottom.x - root.x, bottom.z - root.z) || 1;
    const clearance = Math.min(1, 0.33 / distance);

    return {
      x: rail.x + (bottom.x - root.x) * clearance,
      y: height,
      z: rail.z + (bottom.z - root.z) * clearance,
    };
  }

  /**
   * Palm anchors above the authored planks, following their height and lean.
   * @param {number} index
   * @param {number} side
   * @returns {import("playcanvas").Vec3}
   */
  handhold(index, side) {
    return this.visualRoots[0].children[0].getWorldTransform().transformPoint(
      new Vec3(side * 0.2, 0.2 + Math.max(0, Math.min(12, index)) * 0.27 + 0.055, -0.015));
  }

  /**
   * Forefoot contact on the plank's upper face, or on the floor below it.
   * @param {number} index
   * @param {number} side
   * @returns {import("playcanvas").Vec3}
   */
  foothold(index, side) {
    return this.visualRoots[0].children[0].getWorldTransform().transformPoint(
      new Vec3(side * 0.2, index < 0 ? 0 : 0.2385 + Math.min(12, index) * 0.27, -0.01));
  }

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }
  /**
   * Collide with the authored rails and rungs while retaining the open spaces.
   * @returns {boolean}
   */
  static get hasAuthoredCollision() {
    return true;
  }

  /**
   * @param {"bottom"|"top"} end
   * @returns {{x:number,y:number,z:number}}
   */
  landing(end) {
    const root = this.visualRoots[0].getPosition();
    const target = this.definition[end];
    const anchor = this.definition.position;

    return {
      x: root.x + target.x - anchor.x,
      y: root.y + target.y - anchor.y,
      z: root.z + target.z - anchor.z,
    };
  }

  /**
   * Movement contact owns climbing, so the ladder never offers an E prompt.
   * @returns {null}
   */
  findInteraction() {
    return null;
  }

}
