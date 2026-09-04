import blueFlowerPatchModelUrl from "../../models/ground-cover/blue-flower-patch.glb?url";
import broadleafTuftModelUrl from "../../models/ground-cover/broadleaf-tuft.glb?url";
import buttercupPatchModelUrl from "../../models/ground-cover/buttercup-patch.glb?url";
import cloverPatchModelUrl from "../../models/ground-cover/clover-patch.glb?url";
import daisyPatchModelUrl from "../../models/ground-cover/daisy-patch.glb?url";
import forestMushroomClusterModelUrl from "../../models/ground-cover/forest-mushroom-cluster.glb?url";
import goldenMushroomPairModelUrl from "../../models/ground-cover/golden-mushroom-pair.glb?url";
import grassTuftModelUrl from "../../models/ground-cover/grass-tuft.glb?url";
import meadowGrassModelUrl from "../../models/ground-cover/meadow-grass.glb?url";
import pinkFlowerPatchModelUrl from "../../models/ground-cover/pink-flower-patch.glb?url";
import redMushroomModelUrl from "../../models/ground-cover/red-mushroom.glb?url";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { GroundCoverItem } from "./GroundCoverItem.js";

const VARIANTS = Object.freeze({
  "grass-tuft": {
    modelUrl: grassTuftModelUrl,
    flexibility: 1,
    stepReaction: "none",
  },
  "broadleaf-tuft": {
    modelUrl: broadleafTuftModelUrl,
    flexibility: 0.9,
    stepReaction: "none",
  },
  "meadow-grass": {
    modelUrl: meadowGrassModelUrl,
    flexibility: 1.08,
    stepReaction: "none",
  },
  "daisy-patch": {
    modelUrl: daisyPatchModelUrl,
    flexibility: 0.9,
    stepReaction: "recover",
  },
  "buttercup-patch": {
    modelUrl: buttercupPatchModelUrl,
    flexibility: 0.95,
    stepReaction: "recover",
  },
  "pink-flower-patch": {
    modelUrl: pinkFlowerPatchModelUrl,
    flexibility: 0.92,
    stepReaction: "recover",
  },
  "blue-flower-patch": {
    modelUrl: blueFlowerPatchModelUrl,
    flexibility: 0.92,
    stepReaction: "recover",
  },
  "clover-patch": {
    modelUrl: cloverPatchModelUrl,
    flexibility: 0.8,
    stepReaction: "recover",
  },
  "red-mushroom": {
    modelUrl: redMushroomModelUrl,
    flexibility: 0.35,
    stepReaction: "disappear",
  },
  "golden-mushroom-pair": {
    modelUrl: goldenMushroomPairModelUrl,
    flexibility: 0.38,
    stepReaction: "disappear",
  },
  "forest-mushroom-cluster": {
    modelUrl: forestMushroomClusterModelUrl,
    flexibility: 0.32,
    stepReaction: "disappear",
  },
});
const WIND_RADIUS = 1.8;
const STEP_RADIUS = 0.38;
const MINIMUM_RUNNING_SPEED = 4.7;
const MAXIMUM_RUNNING_SPEED = 6.3;
const HEIGHT_TOLERANCE = 0.8;

export class GroundCover {
  static get modelUrls() {
    return Object.values(VARIANTS).map(({ modelUrl }) => modelUrl);
  }

  #entity;
  #items = [];
  #updateHandle = null;

  constructor({ pc, app, mapData, modelLibrary }) {
    this.#entity = new pc.Entity("Wind-responsive ground cover");

    for (const decoration of mapData.groundCoverData ?? []) {
      const definition = VARIANTS[decoration.variant];
      if (!definition) continue;
      const x =
        decoration.col - (mapData.cols - 1) / 2 + decoration.offsetX;
      const z =
        decoration.row - (mapData.rows - 1) / 2 + decoration.offsetZ;
      const y =
        mapData.heightmap[decoration.row][decoration.col] +
        GRASS_SURFACE_LIFT;
      const item = new GroundCoverItem({
        pc,
        modelLibrary,
        modelUrl: definition.modelUrl,
        variant: decoration.variant,
        x,
        y,
        z,
        rotation: decoration.rotation,
        scale: decoration.scale,
        flexibility: definition.flexibility,
        stepReaction: definition.stepReaction,
        phase: decoration.phase,
      });
      this.#entity.addChild(item.entity);
      this.#items.push(item);
    }

    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  applyHeroInteraction({ x, y, z }, movement) {
    if (!movement || movement.speed <= 0.08) return;

    const speedStrength = Math.min(
      1,
      (movement.speed - MINIMUM_RUNNING_SPEED) /
        (MAXIMUM_RUNNING_SPEED - MINIMUM_RUNNING_SPEED),
    );
    for (const item of this.#items) {
      const position = item.position;
      if (Math.abs(position.y - y) > HEIGHT_TOLERANCE) continue;
      const offsetX = position.x - x;
      const offsetZ = position.z - z;
      const distance = Math.hypot(offsetX, offsetZ);
      if (distance <= STEP_RADIUS) {
        item.stepOn(movement.direction.x, movement.direction.z);
      }
      if (
        !movement.running ||
        movement.speed < MINIMUM_RUNNING_SPEED ||
        distance >= WIND_RADIUS
      ) {
        continue;
      }

      const radialX = distance > 0.001 ? offsetX / distance : 0;
      const radialZ = distance > 0.001 ? offsetZ / distance : 0;
      const directionX = movement.direction.x * 0.72 + radialX * 0.28;
      const directionZ = movement.direction.z * 0.72 + radialZ * 0.28;
      const directionLength = Math.hypot(directionX, directionZ) || 1;
      const falloff = 1 - distance / WIND_RADIUS;
      item.applyWind(
        directionX / directionLength,
        directionZ / directionLength,
        falloff * falloff * (0.35 + speedStrength * 0.65),
      );
    }
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#items = [];
  }

  #update = (deltaTime) => {
    for (const item of this.#items) item.advance(deltaTime);
  };
}
