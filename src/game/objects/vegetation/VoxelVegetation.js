import oakModelUrl from "../../models/vegetation/oak.glb?url";
import pineModelUrl from "../../models/vegetation/pine.glb?url";
import tallTreeModelUrl from "../../models/vegetation/tall-tree.glb?url";
import saplingModelUrl from "../../models/vegetation/sapling.glb?url";
import roundBushModelUrl from "../../models/vegetation/round-bush.glb?url";
import wideBushModelUrl from "../../models/vegetation/wide-bush.glb?url";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";

const MODEL_URLS = Object.freeze({
  oak: oakModelUrl,
  pine: pineModelUrl,
  "tall-tree": tallTreeModelUrl,
  sapling: saplingModelUrl,
  "round-bush": roundBushModelUrl,
  "wide-bush": wideBushModelUrl,
});

const COLLISION_SIZES = Object.freeze({
  oak: { width: 0.75, depth: 0.75, height: 1.5 },
  pine: { width: 0.75, depth: 0.75, height: 1.5 },
  "tall-tree": {
    width: 0.75,
    depth: 0.75,
    height: 1.75,
  },
  sapling: { width: 0.75, depth: 0.75, height: 1 },
  "round-bush": {
    width: 0.75,
    depth: 0.75,
    height: 0.75,
  },
  "wide-bush": {
    width: 1.25,
    depth: 0.75,
    height: 0.5,
  },
});

export class VoxelVegetation {
  static get modelUrls() {
    return Object.values(MODEL_URLS);
  }

  #entity;
  #collisionFootprints = [];

  constructor({ pc, mapData, modelLibrary }) {
    this.#entity = new pc.Entity("Voxel vegetation");

    for (const vegetation of mapData.vegetationData ?? []) {
      const modelUrl = MODEL_URLS[vegetation.variant];
      if (!modelUrl) continue;

      const model = modelLibrary.instantiate(modelUrl);
      const x = vegetation.col - (mapData.cols - 1) / 2;
      const z = vegetation.row - (mapData.rows - 1) / 2;
      const y =
        mapData.heightmap[vegetation.row][vegetation.col] +
        GRASS_SURFACE_LIFT;
      model.name = `Voxel ${vegetation.variant}`;
      model.setLocalPosition(x, y, z);
      model.setLocalEulerAngles(0, vegetation.rotation ?? 0, 0);
      this.#entity.addChild(model);

      const baseSize = COLLISION_SIZES[vegetation.variant];
      const rotated = Math.abs(vegetation.rotation ?? 0) % 180 === 90;
      this.#collisionFootprints.push({
        x,
        z,
        width: rotated ? baseSize.depth : baseSize.width,
        depth: rotated ? baseSize.width : baseSize.depth,
        surfaceHeight: y + baseSize.height,
      });
    }
  }

  get entity() {
    return this.#entity;
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    const radiusSquared = radius * radius;
    return this.#collisionFootprints.some((footprint) => {
      const distanceX = Math.max(
        Math.abs(x - footprint.x) - footprint.width / 2,
        0,
      );
      const distanceZ = Math.max(
        Math.abs(z - footprint.z) - footprint.depth / 2,
        0,
      );
      return distanceX * distanceX + distanceZ * distanceZ <= radiusSquared;
    });
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
    let totalDepth = 0;
    for (const footprint of this.#collisionFootprints) {
      if (
        Number.isFinite(footprint.surfaceHeight) &&
        footprint.surfaceHeight <= elevation + stepClearance
      ) {
        continue;
      }
      const deltaX = Math.abs(x - footprint.x) - footprint.width / 2;
      const deltaZ = Math.abs(z - footprint.z) - footprint.depth / 2;
      const signedDistance =
        deltaX <= 0 && deltaZ <= 0
          ? Math.max(deltaX, deltaZ)
          : Math.hypot(Math.max(deltaX, 0), Math.max(deltaZ, 0));
      totalDepth += Math.max(0, radius - signedDistance);
    }
    return totalDepth;
  }

  surfaceHeightAt(x, z, radius = 0) {
    let highestSurface = null;
    for (const footprint of this.#collisionFootprints) {
      if (!Number.isFinite(footprint.surfaceHeight)) continue;
      const distanceX = Math.max(
        Math.abs(x - footprint.x) - footprint.width / 2,
        0,
      );
      const distanceZ = Math.max(
        Math.abs(z - footprint.z) - footprint.depth / 2,
        0,
      );
      if (distanceX * distanceX + distanceZ * distanceZ > radius * radius) {
        continue;
      }
      highestSurface =
        highestSurface === null
          ? footprint.surfaceHeight
          : Math.max(highestSurface, footprint.surfaceHeight);
    }
    return highestSurface;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#collisionFootprints = [];
  }
}
