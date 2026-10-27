import royalUrl from "../../../models/castle/residential/royal-bed.glb?url";
import servantUrl from "../../../models/castle/residential/servant-bed.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { addGeneratedVoxelPhysics } from "../../shared/GeneratedVoxelPhysics.js";
import { BedPatchMaterial } from "./BedPatchMaterial.js";

/**
 * Grounded royal or servant bed with the original solid furniture envelope.
 */
export class Bed extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").Entity}
   */
  #collider;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {{width: number, height: number, depth: number}}
   */
  #size;
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [royalUrl, servantUrl];
  }
  /**
   * @returns {boolean}
   */
  static get hasAuthoredCollision() {
    return false;
  }
  /**
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.variant === "servant" ? servantUrl : royalUrl;
  }
  /**
   * Recolor only the authored repairs; every instance owns its cloth finish.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    if (collision || this.definition.variant !== "servant") {
      return;
    }
    for (const render of model.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        const material = this.cloneMaterial(mesh.material);
        BedPatchMaterial.configure(material, this.definition.seed ?? this.definition.id);
        mesh.material = material;
      }
    }
  }
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    const { pc, definition } = options;
    this.#pc = pc;
    const royal = definition.variant !== "servant";
    const scale = definition.scale ?? 1;
    const stretch = definition.stretch ?? {
      x: 1,
      y: 1,
      z: 1,
    };
    const height = (royal ? 2.03 : 0.675) * scale * stretch.y;
    this.#size = {
      width: definition.footprint?.width ?? (royal ? 1.2 : 0.9) * scale * stretch.x,
      height,
      depth: definition.footprint?.depth ?? (royal ? 1.805 : 2) * scale * stretch.z,
    };
    const collider = addGeneratedVoxelPhysics({
      pc,
      parent: this.visualRoots[0],
      name: definition.id,
      friction: 0.6,
      voxels: [{
        x: 0,
        y: height / 2,
        z: 0,
        width: this.#size.width,
        height,
        depth: this.#size.depth,
      }],
    });
    // Planned footprints are aligned to the castle, independently of model yaw.
    collider.setLocalEulerAngles(0, (definition.collisionRotation ?? definition.rotation ?? 0) - (definition.rotation ?? 0), 0);
    this.#collider = collider;
  }
  /**
   * Legacy navigation and camera queries share the Ammo box envelope; Ammo owns contact.
   * @returns {boolean}
   */
  get isGroundCollider() {
    return true;
  }
  /**
   * Beds did not expose a walkable top in the castle navigation contract.
   * @returns {boolean}
   */
  get physicsSurface() {
    return false;
  }
  /**
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   */
  blocksMovementAt(x, z, radius, elevation) {
    const point = this.#localPoint(x, elevation, z);

    return point.y + 0.02 < this.#size.height && point.y + 0.8 > 0 &&
      Math.hypot(Math.max(Math.abs(point.x) - this.#size.width / 2, 0),
        Math.max(Math.abs(point.z) - this.#size.depth / 2, 0)) < radius;
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius) {
    const point = this.#localPoint(x, y, z);

    return Math.hypot(Math.max(Math.abs(point.x) - this.#size.width / 2, 0),
      Math.max(Math.abs(point.y - this.#size.height / 2) - this.#size.height / 2, 0),
      Math.max(Math.abs(point.z) - this.#size.depth / 2, 0)) <= radius;
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {import("playcanvas").Vec3}
   */
  #localPoint(x, y, z) {
    const inverse = new this.#pc.Mat4().copy(this.#collider.getWorldTransform()).invert();

    return inverse.transformPoint(new this.#pc.Vec3(x, y, z));
  }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    super.setIslandOffsets(near, far, offsets);
    this.#collider.rigidbody?.syncEntityToBody();
  }
  onSceneReady() {
    super.onSceneReady();
    this.#collider.rigidbody?.syncEntityToBody();
  }
}
