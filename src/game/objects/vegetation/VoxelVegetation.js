import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { RoundBush, WideBush } from "./bushes/index.js";
import {
  OakTree,
  PineTree,
  SaplingTree,
  TallTree,
} from "./trees/index.js";
import { VegetationInteraction } from "./VegetationInteraction.js";
import { VegetationDirtPatch } from "./VegetationDirtPatch.js";

const VEGETATION_TYPES = Object.freeze({
  oak: OakTree,
  pine: PineTree,
  "tall-tree": TallTree,
  sapling: SaplingTree,
  "round-bush": RoundBush,
  "wide-bush": WideBush,
});
const MINIMUM_FACING_DOT = Math.cos((50 * Math.PI) / 180);

export class VoxelVegetation {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return Object.values(VEGETATION_TYPES).map(
      /**
       *
       * @param {typeof import("./DestructibleVegetation.js").DestructibleVegetation} VegetationType
       */
      (VegetationType) => VegetationType.modelUrl,
    );
  }

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {Array<{item: import("./DestructibleVegetation.js").DestructibleVegetation, col: number, row: number, rotation: number}>}
   */
  #items = [];
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   *
    * @type {Array<VegetationDirtPatch>}
   */
  #dirtPatches = [];
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").Application}
   */
  #app;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #tool = null;
  /**
   *
    * @type {({col, row, kind}: {col: number, row: number, kind: string}) => void}
   */
  #onVegetationRemoved;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, definitions: Array<{id: string, variant: string, position: {x: number, y: number, z: number}, tile: {col: number, row: number}, rotation?: number}>, modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, runtime: import("../ObjectTypes.js").MapObjectRuntime}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {Array<{id: string, variant: string, position: {x: number, y: number, z: number}, tile: {col: number, row: number}, rotation?: number}>} options.definitions
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("../ObjectTypes.js").MapObjectRuntime} options.runtime
   */
  constructor({
    pc,
    app,
    definitions,
    modelLibrary,
    runtime = {},
  }) {

    this.#entity = new pc.Entity("Voxel vegetation");

    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);

    this.#pc = pc;

    this.#app = app;
    /**
     *
     * @param {{col: number, row: number, kind: string}} options
     * @param {number} options.col
     * @param {number} options.row
     * @param {string} options.kind
     */
    this.#onVegetationRemoved = ({ col, row, kind }) =>
      runtime.onObjectRemoved?.({
        object: "Vegetation",
        tile: { col, row },
        kind,
      });

    for (const vegetation of definitions) {
      const VegetationType = VEGETATION_TYPES[vegetation.variant];
      if (!VegetationType) continue;

      const { x, y, z } = vegetation.position;
      const item = new VegetationType({
        pc,
        modelLibrary,
        id: vegetation.id,
        x,
        y,
        z,
        rotation: vegetation.rotation ?? 0,
      });
      this.#islandRoots.addChild(item.entity, vegetation.tile);
      this.#items.push({
        item,
        col: vegetation.tile.col,
        row: vegetation.tile.row,
        rotation: vegetation.rotation ?? 0,
      });
    }
  }

  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    this.#islandRoots.setOffsets(near, far);
  }

  get entity() {
    return this.#entity;
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
    * @returns {string}
   */
  get toolName() {
    return "AxeTool";
  }

  /**
   *
    * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() {
    return [this.#entity];
  }

  set tool(tool) {
    this.#tool = tool;
  }

  /**
   *
   * @param {{hero: import("src/game/objects/ObjectTypes.js").HeroLike, onChange: (value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void, onComplete: () => void, reach: number, heightTolerance: number}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroLike} options.hero
   * @param {(value: import("src/game/objects/ObjectTypes.js").InteractionLike|null) => void} options.onChange
   * @param {() => void} options.onComplete
   * @param {number} options.reach
   * @param {number} options.heightTolerance
   */
  findInteraction({
    hero,
    onChange = null,
    onComplete = null,
    reach = 0.78,
    heightTolerance = 0.6,
  }) {
    if (!hero || !this.#tool) {
      return null;
    }
    const position = hero.position;
    const facingDirection = hero.facingDirection;
    let closest = null;
    for (const { item, col, row, rotation } of this.#items) {
      if (!item.canInteract) {
        continue;
      }
      const description = item.describe();
      const offsetX = description.x - position.x;
      const offsetZ = description.z - position.z;
      const offsetLength = Math.hypot(offsetX, offsetZ);
      const facingDot =
        offsetLength > 0.001
          ? (offsetX * facingDirection.x + offsetZ * facingDirection.z) /
            offsetLength
          : 1;
      if (facingDot < MINIMUM_FACING_DOT) continue;

      const distance = item.interactionDistanceFrom(
        position,
        heightTolerance,
      );
      if (distance > reach || (closest && distance >= closest.distance)) {
        continue;
      }
      closest = { item, col, row, rotation, distance };
    }
    return closest
      ? new VegetationInteraction({
          item: closest.item,
          hero,
          tool: this.#tool,
          onChange,
          onComplete,
          /**
           *
           * @param {string} description
           */
          onDestroyed: (description) => {
            this.#leaveDirtPatch(description, closest.rotation, closest);
            this.#onVegetationRemoved({
              col: closest.col,
              row: closest.row,
              kind: description.kind,
            });
          },
        })
      : null;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsGroundFootprint(x, z, radius = 0) {
    return this.#items.some(/**
     *
     * @param {{item: import("./DestructibleVegetation.js").DestructibleVegetation}} options
     * @param {import("./DestructibleVegetation.js").DestructibleVegetation} options.item
     */
    ({ item }) =>
      item.intersectsGroundFootprint(x, z, radius),
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   */
  grassWeightAt(x, z, elevation) {
    const vegetationWeight = this.#items.reduce(
      /**
       *
       * @param {number} weight
       * @param {{item: import("./DestructibleVegetation.js").DestructibleVegetation}} options
       * @param {import("./DestructibleVegetation.js").DestructibleVegetation} options.item
       */
      (weight, { item }) =>
        Math.max(weight, item.grassWeightAt(x, z, elevation)),
      0,
    );
    return this.#dirtPatches.reduce(
      /**
       *
       * @param {number} weight
       * @param {import("./VegetationDirtPatch.js").VegetationDirtPatch} patch
       */
      (weight, patch) =>
        Math.max(weight, patch.grassWeightAt(x, z, elevation)),
      vegetationWeight,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  blocksMovementAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    return (
      this.collisionDepthAt(
        x,
        z,
        radius,
        elevation,
        stepClearance,
      ) > 0
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  collisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    return this.#items.reduce(
      /**
       *
       * @param {number} total
       * @param {{item: import("./DestructibleVegetation.js").DestructibleVegetation}} options
       * @param {import("./DestructibleVegetation.js").DestructibleVegetation} options.item
       */
      (total, { item }) =>
        total +
        item.collisionDepthAt(
          x,
          z,
          radius,
          elevation,
          stepClearance,
        ),
      0,
    );
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
    return this.#items.reduce(
      /**
       *
       * @param {number} total
       * @param {{item: import("./DestructibleVegetation.js").DestructibleVegetation}} options
       * @param {import("./DestructibleVegetation.js").DestructibleVegetation} options.item
       */
      (total, { item }) =>
        total +
        item.movementCollisionDepthAt(
          x,
          z,
          radius,
          elevation,
          stepClearance,
        ),
      0,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  surfaceHeightAt(x, z, radius = 0) {
    let highestSurface = null;
    for (const { item } of this.#items) {
      const surfaceHeight = item.surfaceHeightAt(x, z, radius);
      if (!Number.isFinite(surfaceHeight)) continue;
      highestSurface =
        highestSurface === null
          ? surfaceHeight
          : Math.max(highestSurface, surfaceHeight);
    }
    return highestSurface;
  }

  destroy() {
    for (const patch of this.#dirtPatches) {
      patch.destroy();
    }
    this.#entity?.destroy();
    this.#entity = null;
    this.#items = [];
    this.#dirtPatches = [];
    this.#pc = null;
    this.#app = null;
  }

  /**
   *
   * @param {{id: string, groundFootprint: {width: number, depth: number, offsetX?: number, offsetZ?: number}, x: number, y: number, z: number}} options
   * @param {string} options.id
   * @param {{width: number, depth: number, offsetX?: number, offsetZ?: number}} options.groundFootprint
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   * @param {number} rotation
   * @param {{col: number, row: number}} tile
   */
  #leaveDirtPatch({ id, groundFootprint, x, y, z }, rotation, tile) {
    const patch = new VegetationDirtPatch({
      pc: this.#pc,
      app: this.#app,
      id,
      footprint: groundFootprint,
      x,
      y,
      z,
      rotation,
    });
    this.#islandRoots.addChild(patch.entity, tile);
    this.#dirtPatches.push(patch);
  }
}
