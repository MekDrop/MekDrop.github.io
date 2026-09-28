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
  static get modelUrls() {
    return Object.values(VEGETATION_TYPES).map(
      (VegetationType) => VegetationType.modelUrl,
    );
  }

  #entity;
  #items = [];
  #dirtPatches = [];
  #pc;
  #app;
  #tool = null;
  #onVegetationRemoved;

  constructor({
    pc,
    app,
    definitions,
    modelLibrary,
    runtime = {},
  }) {
    this.#entity = new pc.Entity("Voxel vegetation");
    this.#pc = pc;
    this.#app = app;
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
      this.#entity.addChild(item.entity);
      this.#items.push({
        item,
        col: vegetation.tile.col,
        row: vegetation.tile.row,
        rotation: vegetation.rotation ?? 0,
      });
    }
  }

  get entity() {
    return this.#entity;
  }

  get isGroundCollider() {
    return true;
  }

  get physicsSurface() {
    return false;
  }

  get toolName() {
    return "AxeTool";
  }

  get visualRoots() {
    return [this.#entity];
  }

  set tool(tool) {
    this.#tool = tool;
  }

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
          onDestroyed: (description) => {
            this.#leaveDirtPatch(description, closest.rotation);
            this.#onVegetationRemoved({
              col: closest.col,
              row: closest.row,
              kind: description.kind,
            });
          },
        })
      : null;
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    return this.#items.some(({ item }) =>
      item.intersectsGroundFootprint(x, z, radius),
    );
  }

  grassWeightAt(x, z, elevation) {
    const vegetationWeight = this.#items.reduce(
      (weight, { item }) =>
        Math.max(weight, item.grassWeightAt(x, z, elevation)),
      0,
    );
    return this.#dirtPatches.reduce(
      (weight, patch) =>
        Math.max(weight, patch.grassWeightAt(x, z, elevation)),
      vegetationWeight,
    );
  }

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

  collisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    return this.#items.reduce(
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

  movementCollisionDepthAt(
    x,
    z,
    radius = 0,
    elevation = -Infinity,
    stepClearance = 0,
  ) {
    return this.#items.reduce(
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

  #leaveDirtPatch({ id, groundFootprint, x, y, z }, rotation) {
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
    this.#entity.addChild(patch.entity);
    this.#dirtPatches.push(patch);
  }
}
