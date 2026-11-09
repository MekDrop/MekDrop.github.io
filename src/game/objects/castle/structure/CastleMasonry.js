import { SurfaceSpatialIndex } from "../../shared/SurfaceSpatialIndex.js";
import { createCastleMasonryVoxels } from "./CastleMasonryPhysics.js";
import { addGeneratedVoxelPhysics } from "../../shared/GeneratedVoxelPhysics.js";
import stoneBlockUrl from "../../../models/castle/residential/masonry-block.glb?url";
import { CastleWindowLayout } from "./CastleWindowLayout.js";

/**
 * Owns cut masonry, its collision snapshot, native collider and instance buffers.
 * Materials, model meshes and the castle parent are borrowed from their owners.
 */
export class CastleMasonry {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #parent;
  /**
   * @type {import("../../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   * @type {Map<string, import("playcanvas").StandardMaterial>}
   */
  #materials;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #masonryRoot = null;
  /**
   * @type {import("playcanvas").VertexBuffer[]}
   */
  #vertexBuffers = [];
  /**
   * @type {import("./CastleWindowLayout.js").MasonryBox[]}
   */
  #masonryBoxes = [];
  /**
   * @type {Array<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>}
   */
  #cameraCollisionBlocks = [];
  /**
   * @type {SurfaceSpatialIndex<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>}
   */
  #collisionIndex = new SurfaceSpatialIndex();
  /**
   * @type {WeakMap<import("../../architecture/door/Door.js").Door,number>}
   */
  #breachedDoors = new WeakMap();

  /**
   * @returns {string}
   */
  static get modelUrl() {
    return stoneBlockUrl;
  }

  /**
   * @param {{pc:typeof import("playcanvas"),parent:import("playcanvas").Entity,modelLibrary:import("../../../models/GameModelLibrary.js").GameModelLibrary,materials:Map<string,import("playcanvas").StandardMaterial>,buildPlan:import("../../../GameContracts.js").CastleBuildPlan,windows:CastleWindowLayout}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Entity} options.parent Borrowed castle root.
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {Map<string,import("playcanvas").StandardMaterial>} options.materials Borrowed structure materials.
   * @param {import("../../../GameContracts.js").CastleBuildPlan} options.buildPlan
   * @param {CastleWindowLayout} options.windows Shared aperture plan for window visuals and collision.
   */
  constructor({ pc, parent, modelLibrary, materials, buildPlan, windows }) {
    this.#pc = pc;
    this.#parent = parent;
    this.#modelLibrary = modelLibrary;
    this.#materials = materials;
    this.#masonryBoxes = windows.cutBoxes(buildPlan.geometry.boxes, 0.002);
    this.#cameraCollisionBlocks = windows.cutBoxes(
      buildPlan.metadata.collision.cameraBlocks.map(CastleMasonry.#mapBlock2),
    ).map(CastleMasonry.#mapBox);
    for (const window of windows.windows) {
      const angle = window.yaw * Math.PI / 180;
      const crosswise = Math.abs(Math.sin(angle)) > 0.5;
      if (!window.open) {
        this.#cameraCollisionBlocks.push({
          x: window.position.x - Math.sin(angle) * window.depth * 0.315,
          y: window.position.y + window.height / 2,
          z: window.position.z - Math.cos(angle) * window.depth * 0.315,
          halfX: crosswise ? 0.025 : window.width / 2,
          halfY: window.height / 2,
          halfZ: crosswise ? window.width / 2 : 0.025,
        });
      }
    }
    this.#indexCollision();
    try {
      this.#rebuildMasonry();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  /**
   * Borrowed read-only snapshot; replaced after a successful breach.
   * @returns {ReadonlyArray<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>}
   */
  get collisionBlocks() {
    return this.#cameraCollisionBlocks;
  }

  /**
   * @returns {SurfaceSpatialIndex<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>}
   */
  get collisionIndex() {
    return this.#collisionIndex;
  }

  /**
   * Ownership and damage admission belong to the builder; successful widths
   * belong to this geometry so a failed rebuild can be retried.
   * @param {import("../../architecture/door/Door.js").Door} door
   * @param {number} width
   * @returns {boolean}
   */
  canBreach(door, width) {
    return (this.#breachedDoors.get(door) ?? 0) < width;
  }

  /**
   * Prepare a complete replacement before retiring the current native/render
   * resources. On failure the previous geometry and collision remain live.
   * @param {import("../../architecture/door/Door.js").Door} door
   * @param {number} width
   * @param {import("./CastleWindowLayout.js").WindowBounds} cut
   */
  breach(door, width, cut) {
    const boxes = this.#masonryBoxes;
    const blocks = this.#cameraCollisionBlocks;
    const root = this.#masonryRoot;
    const buffers = this.#vertexBuffers;
    this.#masonryBoxes = CastleWindowLayout.subtractBoxes(boxes, [cut]);
    this.#cameraCollisionBlocks = CastleWindowLayout.subtractBoxes(
      blocks.map(CastleMasonry.#mapBlock2), [cut],
    ).map(CastleMasonry.#mapBox);
    this.#masonryRoot = null;
    this.#vertexBuffers = [];
    try {
      this.#rebuildMasonry();
    } catch (error) {
      this.#destroyResources();
      this.#masonryBoxes = boxes;
      this.#cameraCollisionBlocks = blocks;
      this.#masonryRoot = root;
      this.#vertexBuffers = buffers;
      throw error;
    }
    root?.destroy();
    for (const buffer of buffers) {
      buffer?.destroy();
    }
    this.#indexCollision();
    this.#breachedDoors.set(door, width);
  }

  #indexCollision() {
    this.#collisionIndex = new SurfaceSpatialIndex();
    for (const block of this.#cameraCollisionBlocks) {
      this.#collisionIndex.add(block, {
        minX: block.x - block.halfX,
        maxX: block.x + block.halfX,
        minZ: block.z - block.halfZ,
        maxZ: block.z + block.halfZ,
      });
    }
  }

  #destroyResources() {
    this.#masonryRoot?.destroy();
    this.#masonryRoot = null;
    for (const buffer of this.#vertexBuffers) {
      buffer?.destroy();
    }
    this.#vertexBuffers = [];
  }

  destroy() {
    this.#destroyResources();
    this.#masonryBoxes = [];
    this.#cameraCollisionBlocks = [];
    this.#collisionIndex = new SurfaceSpatialIndex();
    this.#breachedDoors = new WeakMap();
  }

  /**
   *
   * @param {Map<string, Array<number>>} batches
   * @param {string} material
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} yaw
   * @param {number} sx
   * @param {number} sy
   * @param {number} sz
   */
  #addBoxMatrix(batches, material, x, y, z, yaw, sx, sy, sz) {
    const matrix = new this.#pc.Mat4();
    const rotation = new this.#pc.Quat();
    rotation.setFromEulerAngles(0, yaw, 0);
    matrix.setTRS(
      new this.#pc.Vec3(x, y - sy / 2, z),
      rotation,
      new this.#pc.Vec3(sx, sy, sz),
    );
    const data = batches.get(material) ?? [];
    for (const value of matrix.data) {
      data.push(value);
    }
    batches.set(material, data);
  }

  /**
   *
   * @param {Map<string, Array<number>>} batches
   */
  #createInstancedBatches(batches) {
    for (const [materialName, matrices] of batches.entries()) {
      if (!matrices.length) {
        continue;
      }
      const { entity, vertexBuffer } = this.#modelLibrary.instantiateMergedBatch(
        stoneBlockUrl, matrices,
        {
          name: `${materialName} authored castle masonry`,
          material: this.#materials.get(materialName),
          linearVertexColors: true,
          castShadows: true,
          receiveShadows: true,
        },
      );
      this.#vertexBuffers.push(vertexBuffer);
      this.#masonryRoot.addChild(entity);
    }
  }

  #rebuildMasonry() {
    this.#masonryRoot = new this.#pc.Entity("Castle destructible masonry");
    this.#parent.addChild(this.#masonryRoot);
    const batches = new Map();
    for (const box of this.#masonryBoxes) {
      this.#addBoxMatrix(batches, box.material, box.x, box.y, box.z, box.yaw, box.sx, box.sy, box.sz);
    }
    addGeneratedVoxelPhysics({
      pc: this.#pc,
      parent: this.#masonryRoot,
      name: "Castle masonry",
      voxels: createCastleMasonryVoxels(this.#cameraCollisionBlocks),
      friction: 0,
    });
    this.#createInstancedBatches(batches);
  }

  /**
   * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
   */
  static #mapBlock2(block) {
    return {
      ...block,
      sx: block.halfX * 2,
      sy: block.halfY * 2,
      sz: block.halfZ * 2,
      yaw: 0,
    };
  }

  /**
   * @param {import("./CastleWindowLayout.js").MasonryBox} box
   */
  static #mapBox(box) {
    return {
      x: box.x,
      y: box.y,
      z: box.z,
      halfX: box.sx / 2,
      halfY: box.sy / 2,
      halfZ: box.sz / 2,
    };
  }
}
