import blueFlowerPatchModelUrl from "../../models/ground-cover/blue-flower-patch.glb?url";
import buttercupPatchModelUrl from "../../models/ground-cover/buttercup-patch.glb?url";
import cloverPatchModelUrl from "../../models/ground-cover/clover-patch.glb?url";
import daisyPatchModelUrl from "../../models/ground-cover/daisy-patch.glb?url";
import forestMushroomClusterModelUrl from "../../models/ground-cover/forest-mushroom-cluster.glb?url";
import goldenMushroomPairModelUrl from "../../models/ground-cover/golden-mushroom-pair.glb?url";
import pinkFlowerPatchModelUrl from "../../models/ground-cover/pink-flower-patch.glb?url";
import redMushroomModelUrl from "../../models/ground-cover/red-mushroom.glb?url";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import groundCoverFragmentShader from "./GroundCover.frag?raw";
import groundCoverVertexShader from "./GroundCover.vert?raw";
import { GroundCoverItem } from "./GroundCoverItem.js";

const FLOWER_CATEGORY = "flower";
const MUSHROOM_CATEGORY = "mushroom";
const VARIANTS = Object.freeze({
  "daisy-patch": {
    modelUrl: daisyPatchModelUrl,
    category: FLOWER_CATEGORY,
    horizontalScale: 1.5,
    verticalScale: 2,
  },
  "buttercup-patch": {
    modelUrl: buttercupPatchModelUrl,
    category: FLOWER_CATEGORY,
    horizontalScale: 1.55,
    verticalScale: 2.05,
  },
  "pink-flower-patch": {
    modelUrl: pinkFlowerPatchModelUrl,
    category: FLOWER_CATEGORY,
    horizontalScale: 1.5,
    verticalScale: 2,
  },
  "blue-flower-patch": {
    modelUrl: blueFlowerPatchModelUrl,
    category: FLOWER_CATEGORY,
    horizontalScale: 1.5,
    verticalScale: 2,
  },
  "clover-patch": {
    modelUrl: cloverPatchModelUrl,
    category: FLOWER_CATEGORY,
    horizontalScale: 1.15,
    verticalScale: 0.9,
  },
  "red-mushroom": {
    modelUrl: redMushroomModelUrl,
    category: MUSHROOM_CATEGORY,
    scale: 0.82,
    flexibility: 0.35,
  },
  "golden-mushroom-pair": {
    modelUrl: goldenMushroomPairModelUrl,
    category: MUSHROOM_CATEGORY,
    scale: 0.82,
    flexibility: 0.38,
  },
  "forest-mushroom-cluster": {
    modelUrl: forestMushroomClusterModelUrl,
    category: MUSHROOM_CATEGORY,
    scale: 0.82,
    flexibility: 0.32,
  },
});
const GPU_CATEGORIES = Object.freeze({
  [FLOWER_CATEGORY]: {
    bendHeight: 0.14,
    bloomHeight: 0.105,
    bloomSinkDepth: 0.065,
    bloomTiltAngle: 6,
    flexibility: 0.82,
    trampleAngle: 84,
    colorBoost: [1.08, 1.04, 1.08],
  },
});
const STEP_RADIUS = 0.38;
const WIND_RADIUS = 1.8;
const MINIMUM_RUNNING_SPEED = 4.7;
const MAXIMUM_RUNNING_SPEED = 6.3;
const HEIGHT_TOLERANCE = 0.8;
const HERO_RECOVERY_TIME = 0.42;

export class GroundCover {
  static get modelUrls() {
    return Object.values(VARIANTS).map(({ modelUrl }) => modelUrl);
  }

  #pc;
  #entity;
  #items = [];
  #materials = new Map();
  #vertexBuffers = [];
  #updateHandle = null;
  #elapsed = 0;
  #lastHeroMotionAt = Number.NEGATIVE_INFINITY;
  #heroPosition = [0, -1000, 0];
  #heroDirection = [0, 1];
  #heroInfluence = 0;

  constructor({ pc, app, mapData, modelLibrary }) {
    this.#pc = pc;
    this.#entity = new pc.Entity("GPU-instanced interactive ground cover");
    this.#createMaterials();
    this.#buildGroundCover(mapData, modelLibrary);
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  applyHeroInteraction({ x, y, z }, movement) {
    if (!movement) {
      return;
    }

    this.#heroPosition[0] = x;
    this.#heroPosition[1] = y;
    this.#heroPosition[2] = z;
    this.#heroDirection[0] = movement.direction.x;
    this.#heroDirection[1] = movement.direction.z;
    this.#heroInfluence = Math.min(
      1,
      0.28 +
        movement.speed / MAXIMUM_RUNNING_SPEED +
        (movement.running ? 0.12 : 0),
    );
    this.#lastHeroMotionAt = this.#elapsed;

    if (movement.speed <= 0.08) {
      return;
    }

    const speedStrength = Math.max(
      0,
      Math.min(
        1,
        (movement.speed - MINIMUM_RUNNING_SPEED) /
          (MAXIMUM_RUNNING_SPEED - MINIMUM_RUNNING_SPEED),
      ),
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

      const directionLength = Math.hypot(offsetX, offsetZ) || 1;
      const falloff = 1 - distance / WIND_RADIUS;
      item.applyWind(
        offsetX / directionLength,
        offsetZ / directionLength,
        falloff * falloff * (0.35 + speedStrength * 0.65),
      );
    }
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const vertexBuffer of this.#vertexBuffers) vertexBuffer.destroy();
    this.#vertexBuffers = [];
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    this.#items = [];
  }

  #createMaterials() {
    for (const [category, definition] of Object.entries(GPU_CATEGORIES)) {
      const material = new this.#pc.ShaderMaterial({
        uniqueName: `ground-cover-${category}`,
        vertexGLSL: groundCoverVertexShader,
        fragmentGLSL: groundCoverFragmentShader,
        attributes: {
          vertex_position: this.#pc.SEMANTIC_POSITION,
          vertex_normal: this.#pc.SEMANTIC_NORMAL,
          vertex_color: this.#pc.SEMANTIC_COLOR,
          instance_line1: this.#pc.SEMANTIC_ATTR11,
          instance_line2: this.#pc.SEMANTIC_ATTR12,
          instance_line3: this.#pc.SEMANTIC_ATTR14,
          instance_line4: this.#pc.SEMANTIC_ATTR15,
        },
      });
      material.name = `GPU ${category} ground cover`;
      material.cull = this.#pc.CULLFACE_NONE;
      material.setParameter("uTime", 0);
      material.setParameter("uHeroPosition", this.#heroPosition);
      material.setParameter("uHeroDirection", this.#heroDirection);
      material.setParameter("uHeroInfluence", 0);
      material.setParameter("uBendHeight", definition.bendHeight);
      material.setParameter("uBloomHeight", definition.bloomHeight);
      material.setParameter("uBloomSinkDepth", definition.bloomSinkDepth);
      material.setParameter(
        "uBloomTiltAngle",
        definition.bloomTiltAngle,
      );
      material.setParameter("uFlexibility", definition.flexibility);
      material.setParameter("uTrampleAngle", definition.trampleAngle);
      material.setParameter("uColorBoost", definition.colorBoost);
      material.setParameter("uLightDirection", [0.42, 0.82, 0.38]);
      material.update();
      this.#materials.set(category, material);
    }
  }

  #buildGroundCover(mapData, modelLibrary) {
    const matricesByVariant = new Map();
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

      if (definition.category === MUSHROOM_CATEGORY) {
        const item = new GroundCoverItem({
          pc: this.#pc,
          modelLibrary,
          modelUrl: definition.modelUrl,
          variant: decoration.variant,
          x,
          y,
          z,
          rotation: decoration.rotation,
          scale: decoration.scale * definition.scale,
          flexibility: definition.flexibility,
          stepReaction: "disappear",
          phase: decoration.phase,
        });
        this.#entity.addChild(item.entity);
        this.#items.push(item);
        continue;
      }

      const matrix = new this.#pc.Mat4();
      const horizontalScale =
        decoration.scale * definition.horizontalScale;
      const verticalScale = decoration.scale * definition.verticalScale;
      const rotation = new this.#pc.Quat().setFromEulerAngles(
        0,
        decoration.rotation,
        0,
      );
      matrix.setTRS(
        new this.#pc.Vec3(x, y, z),
        rotation,
        new this.#pc.Vec3(horizontalScale, verticalScale, horizontalScale),
      );
      const matrices = matricesByVariant.get(decoration.variant) ?? [];
      matrices.push(...matrix.data);
      matricesByVariant.set(decoration.variant, matrices);
    }

    for (const [variant, matrices] of matricesByVariant) {
      const definition = VARIANTS[variant];
      const batch = modelLibrary.instantiateMergedBatch(
        definition.modelUrl,
        matrices,
        {
          name: `Instanced ${variant}`,
          material: this.#materials.get(definition.category),
          castShadows: false,
          receiveShadows: false,
        },
      );
      if (!batch) continue;
      this.#vertexBuffers.push(batch.vertexBuffer);
      this.#entity.addChild(batch.entity);
    }
  }

  #update = (deltaTime) => {
    const frameTime = Math.min(deltaTime, 0.1);
    this.#elapsed += frameTime;
    const motionAge = this.#elapsed - this.#lastHeroMotionAt;
    const recovery = Math.max(0, 1 - motionAge / HERO_RECOVERY_TIME);
    const heroInfluence = this.#heroInfluence * recovery * recovery;

    for (const material of this.#materials.values()) {
      material.setParameter("uTime", this.#elapsed);
      material.setParameter("uHeroPosition", this.#heroPosition);
      material.setParameter("uHeroDirection", this.#heroDirection);
      material.setParameter("uHeroInfluence", heroInfluence);
    }
    for (const item of this.#items) item.advance(frameTime);
  };
}
