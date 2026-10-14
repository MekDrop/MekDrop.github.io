import handleUrl from "../../models/castle/doors/interior-doors.glb?url";
import hatchUrl from "../../models/castle/residential/floor-panel.glb?url";
import modelUrl from "../../models/castle/residential/crown-ladder.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { LadderInteraction } from "./LadderInteraction.js";

/**
 * A map-owned ladder linking supported lower and upper landings.
 */
export class Ladder extends AbstractCastleProp {
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
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);
    const { pc, modelLibrary, definition } = options;
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
    this.#hatchCollider.addComponent("collision", { type: "box", halfExtents: new pc.Vec3(hatch.width / 2, 0.03, hatch.depth / 2) });
    this.#hatchCollider.addComponent("rigidbody", { type: "static", friction: 0.6 });
  }

  /**
   * Keep the authored ladder rails beneath the closed lid.
   * @param {import("playcanvas").Entity} model
   */
  prepareModel(model) {
    model.setLocalScale(1, Math.max(0.1, this.definition.top.y - this.definition.position.y - 0.12) / 3.7, 1);
  }

  /**
   * Open for the climb, then leave the rooftop sealed again.
   */
  openHatch() {
    if (!this.#hatch) { return; }
    clearTimeout(this.#closeTimer);
    this.#hatchCollider.enabled = false;
    this.#hatch.setLocalEulerAngles(-100, 0, 0);
    this.#closeTimer = setTimeout(() => {
      this.#hatch.setLocalEulerAngles(0, 0, 0);
      this.#hatchCollider.enabled = true;
    }, 2000);
  }

  // The movable lid must retain its own transform rather than enter a static batch.
  onSceneReady() {}

  destroy() { clearTimeout(this.#closeTimer); super.destroy(); }

  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }
  /**
   * Interaction owns the ladder transfer; rungs must not obstruct its landings.
   * @returns {boolean}
   */
  static get hasAuthoredCollision() { return false; }

  /**
   * @param {"bottom"|"top"} end
   * @returns {{x:number,y:number,z:number}}
   */
  landing(end) {
    const root = this.visualRoots[0].getPosition();
    const target = this.definition[end];
    const anchor = this.definition.position;
    return { x: root.x + target.x - anchor.x, y: root.y + target.y - anchor.y, z: root.z + target.z - anchor.z };
  }

  /**
   * @param {{hero:import("../hero/Hero.js").Hero,onComplete?:()=>void}} options
   * @returns {LadderInteraction|null}
   */
  findInteraction({ hero, onComplete }) {
    for (const end of ["bottom", "top"]) {
      const interaction = new LadderInteraction(this, hero, end, onComplete);
      if (interaction.canInteract) { return interaction; }
    }
    return null;
  }
}

