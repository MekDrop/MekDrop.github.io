import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { RoundBush, WideBush } from "./bushes/index.js";
import {
  OakTree,
  PineTree,
  SaplingTree,
  TallTree,
} from "./trees/index.js";
import { VegetationInteraction } from "./VegetationInteraction.js";

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
  #tool = null;
  #onVegetationRemoved;

  constructor({
    pc,
    mapData,
    modelLibrary,
    onVegetationRemoved = () => {},
  }) {
    this.#entity = new pc.Entity("Voxel vegetation");
    this.#onVegetationRemoved = onVegetationRemoved;

    for (const vegetation of mapData.vegetationData ?? []) {
      const VegetationType = VEGETATION_TYPES[vegetation.variant];
      if (!VegetationType) continue;

      const x = vegetation.col - (mapData.cols - 1) / 2;
      const z = vegetation.row - (mapData.rows - 1) / 2;
      const y =
        mapData.heightmap[vegetation.row][vegetation.col] +
        GRASS_SURFACE_LIFT;
      const item = new VegetationType({
        modelLibrary,
        id: `${vegetation.row}:${vegetation.col}`,
        x,
        y,
        z,
        rotation: vegetation.rotation ?? 0,
      });
      this.#entity.addChild(item.entity);
      this.#items.push({
        item,
        col: vegetation.col,
        row: vegetation.row,
      });
    }
  }

  get entity() {
    return this.#entity;
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
    for (const { item, col, row } of this.#items) {
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
      closest = { item, col, row, distance };
    }
    return closest
      ? new VegetationInteraction({
          item: closest.item,
          hero,
          tool: this.#tool,
          onChange,
          onComplete,
          onDestroyed: ({ kind }) =>
            this.#onVegetationRemoved({
              col: closest.col,
              row: closest.row,
              kind,
            }),
        })
      : null;
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    return this.#items.some(({ item }) =>
      item.intersectsGroundFootprint(x, z, radius),
    );
  }

  grassWeightAt(x, z, elevation) {
    return this.#items.reduce(
      (weight, { item }) =>
        Math.max(weight, item.grassWeightAt(x, z, elevation)),
      0,
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
    this.#entity?.destroy();
    this.#entity = null;
    this.#items = [];
  }
}
