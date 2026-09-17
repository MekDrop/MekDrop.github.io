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
import groundCoverHeldVertexShader from "./GroundCoverHeld.vert?raw";
import groundCoverVertexShader from "./GroundCover.vert?raw";
import { GroundCoverCollectible } from "./GroundCoverCollectible.js";
import { GroundCoverHeldItem } from "./GroundCoverHeldItem.js";
import { GroundCoverInteraction } from "./GroundCoverInteraction.js";
import { GroundCoverItem } from "./GroundCoverItem.js";
import { FlowerPhysics } from "./FlowerPhysics.js";

const FLOWER_CATEGORY = "flower";
const MUSHROOM_CATEGORY = "mushroom";
const VARIANTS = Object.freeze({
  "daisy-patch": {
    modelUrl: daisyPatchModelUrl,
    category: FLOWER_CATEGORY,
    labelKey: "game.inventory.items.daisy_patch",
    icon: "🌼",
    interactionRadius: 0.38,
    horizontalScale: 1.5,
    verticalScale: 2,
    gripPoint: { x: 0, y: 0.055, z: 0 },
  },
  "buttercup-patch": {
    modelUrl: buttercupPatchModelUrl,
    category: FLOWER_CATEGORY,
    labelKey: "game.inventory.items.buttercup_patch",
    icon: "🌻",
    interactionRadius: 0.4,
    horizontalScale: 1.55,
    verticalScale: 2.05,
    gripPoint: { x: 0, y: 0.05, z: 0 },
  },
  "pink-flower-patch": {
    modelUrl: pinkFlowerPatchModelUrl,
    category: FLOWER_CATEGORY,
    labelKey: "game.inventory.items.pink_flower_patch",
    icon: "🌸",
    interactionRadius: 0.38,
    horizontalScale: 1.5,
    verticalScale: 2,
    gripPoint: { x: 0, y: 0.0525, z: 0 },
  },
  "blue-flower-patch": {
    modelUrl: blueFlowerPatchModelUrl,
    category: FLOWER_CATEGORY,
    labelKey: "game.inventory.items.blue_flower_patch",
    icon: "🪻",
    interactionRadius: 0.38,
    horizontalScale: 1.5,
    verticalScale: 2,
    gripPoint: { x: 0, y: 0.0575, z: 0 },
  },
  "clover-patch": {
    modelUrl: cloverPatchModelUrl,
    category: FLOWER_CATEGORY,
    labelKey: "game.inventory.items.clover_patch",
    icon: "☘️",
    interactionRadius: 0.34,
    horizontalScale: 1.15,
    verticalScale: 0.9,
    gripPoint: { x: 0.03, y: 0.09, z: -0.07 },
  },
  "red-mushroom": {
    modelUrl: redMushroomModelUrl,
    category: MUSHROOM_CATEGORY,
    labelKey: "game.inventory.items.red_mushroom",
    icon: "🍄",
    interactionRadius: 0.22,
    scale: 0.82,
    flexibility: 0.35,
    gripPoint: { x: 0, y: 0.075, z: 0 },
  },
  "golden-mushroom-pair": {
    modelUrl: goldenMushroomPairModelUrl,
    category: MUSHROOM_CATEGORY,
    labelKey: "game.inventory.items.golden_mushroom_pair",
    icon: "🍄",
    interactionRadius: 0.24,
    scale: 0.82,
    flexibility: 0.38,
    gripPoint: { x: -0.08, y: 0.0765, z: -0.01 },
  },
  "forest-mushroom-cluster": {
    modelUrl: forestMushroomClusterModelUrl,
    category: MUSHROOM_CATEGORY,
    labelKey: "game.inventory.items.forest_mushroom_cluster",
    icon: "🍄",
    interactionRadius: 0.26,
    scale: 0.82,
    flexibility: 0.32,
    gripPoint: { x: -0.12, y: 0.065, z: 0.03 },
  },
});
const GPU_CATEGORIES = Object.freeze({
  [FLOWER_CATEGORY]: {
    bendHeight: 0.14,
    flexibility: 0.82,
    colorBoost: [1.08, 1.04, 1.08],
  },
});
const MINIMUM_FACING_DOT = Math.cos((50 * Math.PI) / 180);
const STILL_ZOOM = 1;
const FULL_AMBIENT_MOTION_ZOOM = 1.1;

export class GroundCover {
  static get modelUrls() {
    return Object.values(VARIANTS).map(({ modelUrl }) => modelUrl);
  }

  #pc;
  #entity;
  #items = [];
  #collectibles = [];
  #flowerPhysics;
  #materials = new Map();
  #heldMaterials = new Map();
  #vertexBuffers = [];
  #updateHandle = null;
  #elapsed = 0;
  #ambientMotion = 0;

  #onCollect;
  #onCollectibleRemoved;
  #tool = null;

  constructor({
    pc,
    app,
    mapData,
    modelLibrary,
    zoom = 1,
    onCollect = () => false,
    onCollectibleRemoved = () => {},
  }) {
    this.#pc = pc;
    this.#onCollect = onCollect;
    this.#onCollectibleRemoved = onCollectibleRemoved;
    this.#entity = new pc.Entity("GPU-instanced interactive ground cover");
    this.#flowerPhysics = new FlowerPhysics({ pc });
    this.#entity.addChild(this.#flowerPhysics.entity);
    this.#createMaterials();
    this.zoom = zoom;
    this.#buildGroundCover(mapData, modelLibrary);
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  set tool(tool) {
    this.#tool = tool;
  }

  set zoom(value) {
    const progress = Math.max(
      0,
      Math.min(
        1,
        (value - STILL_ZOOM) /
          (FULL_AMBIENT_MOTION_ZOOM - STILL_ZOOM),
      ),
    );
    const ambientMotion = progress * progress * (3 - 2 * progress);
    this.#ambientMotion = ambientMotion;
    for (const material of this.#materials.values()) {
      material.setParameter("uAmbientMotion", ambientMotion);
    }
    for (const item of this.#items) {
      item.ambientMotion = ambientMotion;
    }
  }

  applyHeroInteraction({ x, y, z }, movement) {
    this.#flowerPhysics.updateHeroPosition(
      { x, y, z },
      movement?.direction,
    );
  }

  findInteraction({
    hero,
    onChange = null,
    onComplete = null,
    reach = 0.62,
    heightTolerance = 0.6,
  }) {
    if (!hero) {
      return null;
    }

    const heroPosition = hero.position;
    const facingDirection = hero.facingDirection;
    let closest = null;
    for (const collectible of this.#collectibles) {
      if (!collectible.canInteract) {
        continue;
      }
      const position = collectible.position;
      if (Math.abs(position.y - heroPosition.y) > heightTolerance) {
        continue;
      }
      const centerDistance = Math.hypot(
        position.x - heroPosition.x,
        position.z - heroPosition.z,
      );
      const facingDot =
        centerDistance > 0.001
          ? ((position.x - heroPosition.x) * facingDirection.x +
              (position.z - heroPosition.z) * facingDirection.z) /
            centerDistance
          : 1;
      if (facingDot < MINIMUM_FACING_DOT) {
        continue;
      }
      const distance = Math.max(
        0,
        centerDistance - collectible.interactionRadius,
      );
      if (distance > reach || (closest && distance >= closest.distance)) {
        continue;
      }
      closest = { collectible, distance };
    }

    return closest
      ? new GroundCoverInteraction({
          collectible: closest.collectible,
          hero,
          tool: this.#tool,
          onChange,
          onComplete,
        })
      : null;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#flowerPhysics?.destroy();
    this.#flowerPhysics = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const vertexBuffer of this.#vertexBuffers) vertexBuffer.destroy();
    this.#vertexBuffers = [];
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    for (const material of this.#heldMaterials.values()) material.destroy();
    this.#heldMaterials.clear();
    this.#items = [];
    this.#collectibles = [];
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
      material.setParameter("uBendHeight", definition.bendHeight);
      material.setParameter("uFlexibility", definition.flexibility);
      material.setParameter("uAmbientMotion", 0);
      material.setParameter("uColorBoost", definition.colorBoost);
      material.setParameter("uLightDirection", [0.42, 0.82, 0.38]);
      material.update();
      this.#materials.set(category, material);

      const heldMaterial = new this.#pc.ShaderMaterial({
        uniqueName: `held-ground-cover-${category}`,
        vertexGLSL: groundCoverHeldVertexShader,
        fragmentGLSL: groundCoverFragmentShader,
        attributes: {
          vertex_position: this.#pc.SEMANTIC_POSITION,
          vertex_normal: this.#pc.SEMANTIC_NORMAL,
          vertex_color: this.#pc.SEMANTIC_COLOR,
        },
      });
      heldMaterial.name = `Held ${category} ground cover`;
      heldMaterial.cull = this.#pc.CULLFACE_NONE;
      heldMaterial.setParameter("uBendHeight", definition.bendHeight);
      heldMaterial.setParameter("uColorBoost", definition.colorBoost);
      heldMaterial.setParameter("uLightDirection", [0.42, 0.82, 0.38]);
      heldMaterial.update();
      this.#heldMaterials.set(category, heldMaterial);
    }
  }

  #buildGroundCover(mapData, modelLibrary) {
    const matricesByVariant = new Map();
    for (const [decorationIndex, decoration] of (
      mapData.groundCoverData ?? []
    ).entries()) {
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
          stepReaction: "none",
          phase: decoration.phase,
          ambientMotion: this.#ambientMotion,
        });
        this.#entity.addChild(item.entity);
        this.#items.push(item);
        this.#collectibles.push(
          this.#createCollectible({
            decoration,
            decorationIndex,
            definition,
            modelLibrary,
            position: { x, y, z },
            onHide: () => item.collect(),
          }),
        );
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
      const batch = matricesByVariant.get(decoration.variant) ?? {
        matrices: [],
      };
      const matrixIndex = batch.matrices.length / 16;
      batch.matrices.push(...matrix.data);
      const flower = this.#flowerPhysics.addFlower({
        variant: decoration.variant,
        matrixIndex,
        position: { x, y, z },
        rotation: decoration.rotation,
        horizontalScale,
        verticalScale,
        interactionRadius:
          definition.interactionRadius * decoration.scale,
      });
      matricesByVariant.set(decoration.variant, batch);
      this.#collectibles.push(
        this.#createCollectible({
          decoration,
          decorationIndex,
          definition,
          modelLibrary,
          position: { x, y, z },
          onHide: () => this.#flowerPhysics.hide(flower),
        }),
      );
    }

    for (const [variant, { matrices }] of matricesByVariant) {
      const definition = VARIANTS[variant];
      const batch = modelLibrary.instantiateMergedBatch(
        definition.modelUrl,
        matrices,
        {
          name: `Instanced ${variant}`,
          material: this.#materials.get(definition.category),
          castShadows: false,
          receiveShadows: false,
          dynamic: true,
        },
      );
      if (!batch) continue;
      this.#vertexBuffers.push(batch.vertexBuffer);
      this.#flowerPhysics.setBatch(variant, batch.vertexBuffer);
      this.#entity.addChild(batch.entity);
    }
  }

  #createCollectible({
    decoration,
    decorationIndex,
    definition,
    modelLibrary,
    position,
    onHide,
  }) {
    return new GroundCoverCollectible({
      id: `${decoration.row}:${decoration.col}:${decorationIndex}`,
      variant: decoration.variant,
      category: definition.category,
      labelKey: definition.labelKey,
      icon: definition.icon,
      modelUrl: definition.modelUrl,
      interactionRadius:
        definition.interactionRadius * decoration.scale,
      position,
      onCollect: this.#onCollect,
      onHide: () => {
        onHide();
        this.#onCollectibleRemoved({
          col: decoration.col,
          row: decoration.row,
          category: definition.category,
        });
      },
      createHeldItem: () =>
        new GroundCoverHeldItem({
          pc: this.#pc,
          modelLibrary,
          modelUrl: definition.modelUrl,
          name: decoration.variant,
          scale:
            definition.category === FLOWER_CATEGORY
              ? {
                  x: decoration.scale * definition.horizontalScale,
                  y: decoration.scale * definition.verticalScale,
                  z: decoration.scale * definition.horizontalScale,
                }
              : decoration.scale * definition.scale,
          material:
            definition.category === FLOWER_CATEGORY
              ? this.#heldMaterials.get(definition.category)
              : null,
          castShadows: definition.category !== FLOWER_CATEGORY,
          receiveShadows: definition.category !== FLOWER_CATEGORY,
          sourceParent: this.#entity,
          sourcePosition: position,
          sourceRotation: decoration.rotation,
          gripPoint: definition.gripPoint,
        }),
    });
  }

  #update = (deltaTime) => {
    const frameTime = Math.min(deltaTime, 0.1);
    this.#elapsed += frameTime;

    for (const material of this.#materials.values()) {
      material.setParameter("uTime", this.#elapsed);
    }
    this.#flowerPhysics.updateMatrices();
    for (const item of this.#items) item.advance(frameTime);
  };
}
