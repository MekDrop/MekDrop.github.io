import { addGeneratedVoxelPhysics } from "../../shared/GeneratedVoxelPhysics.js";
import modelUrl from "../../../models/castle/props/kitchen-table.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import deskUrl from "../../../models/castle/residential/writing-desk.glb?url";

/**
 * A dimensioned timber table or writing desk.
 */
export class Table extends AbstractCastleProp {
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
  static get modelUrls() { return [modelUrl, deskUrl]; }
  /**
   * @returns {boolean}
   */
  get hasAuthoredCollision() { return !this.definition.castleTable; }
  /**
   * @returns {string}
   */
  get modelUrl() { return this.definition.variant === "writingDesk" ? deskUrl : modelUrl; }
  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application,modelLibrary:import("../../../models/GameModelLibrary.js").GameModelLibrary,definition:import("../../ObjectTypes.js").MapObjectDefinition,runtime?:import("../../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor(options) {
    const definition = Table.definitionFor(options.definition);
    super({
      ...options,
      definition,
    });

    if (!definition.castleTable) { return; }
    const { pc } = options;
    this.#pc = pc;
    const scale = definition.scale ?? 1;
    const stretch = definition.stretch ?? {
      x: 1,
      y: 1,
      z: 1,
    };
    const height = 0.73 * scale * stretch.y;
    this.#size = {
      width: definition.footprint?.width ?? 0.9 * scale * stretch.x,
      height,
      depth: definition.footprint?.depth ?? 0.55 * scale * stretch.z,
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
   * Apply default dimensions to the shared timber model.
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @returns {import("../../ObjectTypes.js").MapObjectDefinition}
   */
  static definitionFor(definition) {
    const desk = definition.variant === "writingDesk";

    return {
      ...definition,
      object: Table.name,
      width: definition.width ?? (desk ? 0.9 : 0.6271365),
      height: definition.height ?? (desk ? 0.65 : 0.56465894),
      depth: definition.depth ?? (desk ? 0.55 : 1.25),
    };
  }

  /**
   * Size both visible timber and authored collision from the same definition.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { width, height, depth, scale = 1, stretch = {
      x: 1,
      y: 1,
      z: 1,
    } } = this.definition;
    const desk = this.definition.variant === "writingDesk";
    model.setLocalScale(width / (desk ? 0.9 : 0.6271365) * scale * stretch.x,
      height / (desk ? 0.65 : 0.56465894) * scale * stretch.y, depth / (desk ? 0.55 : 1.25) * scale * stretch.z);
    if (desk && !this.definition.deskContents) {
      model.findByName("Parchment")?.destroy();
      model.findByName("Ink pot")?.destroy();
    }
  }
  /**
   * Legacy navigation and camera queries share the Ammo box envelope; Ammo owns contact.
   * @returns {boolean}
   */
  get isGroundCollider() { return !!this.definition.castleTable; }
  /**
   * Castle tables did not expose a walkable top in the castle navigation contract.
   * @returns {boolean}
   */
  get physicsSurface() { return false; }
  /**
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   */
  blocksMovementAt(x, z, radius, elevation) {
    if (!this.#collider) { return false; }
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
    if (!this.#collider) { return false; }
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
    this.#collider?.rigidbody?.syncEntityToBody();
  }
  onSceneReady() {
    super.onSceneReady();
    this.#collider?.rigidbody?.syncEntityToBody();
  }
}
