import handleUrl from "../../../models/castle/doors/interior-doors.glb?url";
import { Vec3 } from "playcanvas";
import hatchUrl from "../../../models/castle/residential/floor-panel.glb?url";
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
   * @type {import("playcanvas").Entity}
   */
  #hatch;
  /**
   * @type {import("playcanvas").Entity}
   */
  #hatchCollider;
  /**
   * @type {ReturnType<typeof setTimeout>}
   */
  #closeTimer;

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [modelUrl, hatchUrl, handleUrl]; }

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

    const { pc, modelLibrary, definition } = options;
    this.#climbUpdate = options.app.on("update", () => {
      if (!this.#releaseClimber) {
        this.#releaseClimber = options.runtime?.getHero?.()?.registerLadder?.(this);
      }
    });
    const hatch = definition.hatch;
    if (!hatch) { return; }
    const angle = (definition.rotation ?? 0) * Math.PI / 180;
    const dx = hatch.position.x - definition.position.x;
    const dz = hatch.position.z - definition.position.z;
    const x = dx * Math.cos(angle) - dz * Math.sin(angle);
    const z = dx * Math.sin(angle) + dz * Math.cos(angle);
    this.#hatch = new pc.Entity("Tower roof hatch hinge");
    this.visualRoots[0].addChild(this.#hatch);
    this.#hatch.setLocalPosition(x, hatch.position.y - definition.position.y, z - hatch.depth / 2);
    // Four reused timber modules form a fixed frame outside the clear opening.
    for (const [offsetX, offsetZ, width, depth] of [
      [-hatch.width / 2 - 0.04, 0, 0.08, hatch.depth + 0.16],
      [hatch.width / 2 + 0.04, 0, 0.08, hatch.depth + 0.16],
      [0, -hatch.depth / 2 - 0.04, hatch.width, 0.08],
      [0, hatch.depth / 2 + 0.04, hatch.width, 0.08],
    ]) {
      const frame = modelLibrary.instantiate(hatchUrl);
      frame.name = "Tower hatch fixed oak frame";
      frame.setLocalScale(width, 1, depth);
      frame.setLocalPosition(x + offsetX, hatch.position.y - definition.position.y - 0.04, z + offsetZ);
      this.visualRoots[0].addChild(frame);
    }
    const panel = modelLibrary.instantiate(hatchUrl);
    panel.setLocalScale(hatch.width - 0.01, 1, hatch.depth - 0.01);
    panel.setLocalPosition(0, -0.05, hatch.depth / 2);
    this.#hatch.addChild(panel);
    const handleSource = modelLibrary.instantiate(handleUrl);
    const ring = handleSource.findByName("Right castle door ring handle");
    if (ring) {
      for (const side of [1, -1]) {
        const handle = ring.clone();
        handle.name = side > 0 ? "Roof hatch outside handle" : "Roof hatch inside handle";
        handle.setLocalPosition(0, side > 0 ? 0.025 : -0.085, hatch.depth * 0.78);
        handle.setLocalEulerAngles(side > 0 ? -90 : 90, 0, 0);
        handle.setLocalScale(0.75, 0.75, 0.75);
        this.#hatch.addChild(handle);
      }
    }
    handleSource.destroy();
    this.#hatchCollider = new pc.Entity("Closed tower hatch support");
    this.#hatch.addChild(this.#hatchCollider);
    this.#hatchCollider.setLocalPosition(0, -0.03, hatch.depth / 2);
    this.#hatchCollider.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(hatch.width / 2, 0.03, hatch.depth / 2),
    });
    this.#hatchCollider.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
    });
  }

  /**
   * Rest the rails against the hatch opening's inner face, below the lid.
   * @param {import("playcanvas").Entity} model
   */
  prepareModel(model) {
    const { hatch, position, rotation = 0, top } = this.definition;
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
    if (!this.#hatch) {
      return;
    }
    clearTimeout(this.#closeTimer);
    this.#hatchCollider.enabled = false;
    this.#hatch.setLocalEulerAngles(-100, 0, 0);
    this.#closeTimer = setTimeout(this.#setTimeout.bind(this), 2000);
  }

  // The movable lid must retain its own transform rather than enter a static batch.
  onSceneReady() {}

  destroy() { this.#climbUpdate?.off(); this.#releaseClimber?.(); clearTimeout(this.#closeTimer); super.destroy(); }

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
    if (!this.definition.hatch) return [top];
    const guide = this.climbGuide(top.y);
    const angle = (this.definition.rotation ?? 0) * Math.PI / 180;
    const offset = this.definition.hatch.width / 2 + 0.2;
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
    const clearance = Math.min(1, 0.25 / distance);

    return {
      x: rail.x + (bottom.x - root.x) * clearance,
      y: height,
      z: rail.z + (bottom.z - root.z) * clearance,
    };
  }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
  /**
   * Collide with the authored rails and rungs while retaining the open spaces.
   * @returns {boolean}
   */
  static get hasAuthoredCollision() { return true; }

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

  #setTimeout() {
    this.#hatch.setLocalEulerAngles(0, 0, 0);
    this.#hatchCollider.enabled = true;
  }
}
