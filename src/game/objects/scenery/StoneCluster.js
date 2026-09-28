import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";
import {
  buildStoneVoxelGeometry,
  buildStoneVoxels,
} from "./StoneVoxelGeometry.js";

/**
 * A map-authored cubic stone cluster with solid tops the hero can land on.
 */
export class StoneCluster {
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   *
    * @type {Array<{x: number, z: number, ground: number, top: number, halfWidth: number}>}
   */
  #parts = [];
  /**
   *
    * @type {import("playcanvas").Mesh}
   */
  #mesh = null;
  /**
   *
    * @type {import("playcanvas").Material}
   */
  #material = null;
  /**
   *
    * @type {import("playcanvas").Entity|null}
   */
  #physicsCollider = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   */
  constructor({ pc, app, definition }) {

    this.#definition = definition;

    this.#entity = new pc.Entity(`${definition.id} stone cluster`);
    this.#entity.tags.add("map-object", definition.id, this.constructor.name);
    const stones = [];
    const { position, parts } = definition;
    for (const stone of parts) {
      const x = position.x + stone.offsetX;
      const z = position.z + stone.offsetZ;
      const halfWidth = stone.diameter / 2;
      const top = position.y + stone.height;
      stones.push({ ...stone, x, z, ground: position.y });
      this.#parts.push({ x, z, ground: position.y, top, halfWidth });
    }
    if (!stones.length) {
      return;
    }


    this.#physicsCollider = addGeneratedVoxelPhysics({
      pc,
      parent: this.#entity,
      name: "Stone",
      voxels: buildStoneVoxels(stones),
      friction: 0.7,
    });

    const geometry = buildStoneVoxelGeometry(stones);

    this.#mesh = new pc.Mesh(app.graphicsDevice);
    this.#mesh.setPositions(geometry.positions);
    this.#mesh.setNormals(geometry.normals);
    this.#mesh.setColors32(geometry.colors);
    this.#mesh.setIndices(geometry.indices);
    this.#mesh.update();


    this.#material = new pc.StandardMaterial();
    this.#material.name = "Generated cubic stone";
    this.#material.diffuse = new pc.Color(1, 1, 1);
    this.#material.diffuseVertexColor = true;
    this.#material.gloss = 0.08;
    this.#material.metalness = 0;
    this.#material.useMetalness = true;
    this.#material.update();
    const meshInstance = new pc.MeshInstance(this.#mesh, this.#material);
    this.#entity.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: true,
      receiveShadows: true,
    });
  }

  get entity() {
    return this.#entity;
  }

  get definition() {
    return this.#definition;
  }

  /**
   *
    * @returns {boolean}
   */
  get isGroundCollider() {
    return true;
  }

  /**
   *
    * @returns {boolean}
   */
  get physicsSurface() {
    return false;
  }

  /**
   *
    * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() {
    return [this.#entity];
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  surfaceHeightAt(x, z, radius = 0) {
    let height = null;
    for (const part of this.#parts) {
      if (
        Math.abs(x - part.x) >= part.halfWidth + radius ||
        Math.abs(z - part.z) >= part.halfWidth + radius
      ) {
        continue;
      }
      height = height === null ? part.top : Math.max(height, part.top);
    }
    return height;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  collisionDepthAt(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    let depth = 0;
    for (const part of this.#parts) {
      if (
        elevation + stepClearance >= part.top ||
        elevation + 1 < part.ground
      ) {
        continue;
      }
      depth = Math.max(
        depth,
        Math.min(
          part.halfWidth + radius - Math.abs(x - part.x),
          part.halfWidth + radius - Math.abs(z - part.z),
        ),
      );
    }
    return Math.max(0, depth);
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  movementCollisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    if (this.#physicsCollider) {
      return 0;
    }
    return this.collisionDepthAt(
      x,
      z,
      radius,
      elevation,
      stepClearance,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   */
  grassWeightAt(x, z, elevation) {
    return this.#parts.some(
      /**
       *
       * @param {{x: number, z: number, ground: number, top: number, halfWidth: number}} part
       */
      (part) =>
        Math.abs(elevation - part.ground) < 0.18 &&
        Math.abs(x - part.x) < part.halfWidth + 0.04 &&
        Math.abs(z - part.z) < part.halfWidth + 0.04,
    )
      ? 1
      : 0;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#mesh?.destroy();
    this.#mesh = null;
    this.#material?.destroy();
    this.#material = null;
    this.#physicsCollider = null;
    this.#parts = [];
  }
}
