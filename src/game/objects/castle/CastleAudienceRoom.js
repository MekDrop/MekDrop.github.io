import { SeatedRoyal } from "./SeatedRoyal.js";
import { CastleThrone } from "./CastleThrone.js";
import { CastleFire } from "./CastleFire.js";
import { GAME_OVER_VIEW_ROTATION_BY_SIDE } from "../../enum/GameOverViewRotation.js";
import { colorFromHex } from "../../helpers/colors.js";

const ROOM_MATERIALS = {
  carpetDark: { color: 0x751f34, gloss: 0.05 },
  carpetLight: { color: 0xb5364c, gloss: 0.06 },
  carpetGold: { color: 0xd7a936, gloss: 0.22 },
  wood: { color: 0x4a281a, gloss: 0.05 },
  woodLight: { color: 0x6b3a22, gloss: 0.06 },
  gold: { color: 0xd8a936, gloss: 0.36, metalness: 0.28 },
  iron: { color: 0x171b1d, gloss: 0.16 },
  banner: { color: 0x234f9b, gloss: 0.05 },
  bannerLight: { color: 0x3974c7, gloss: 0.06 },
};

const EDGE_MARGIN = 0.82;
const MAX_ROOM_DEPTH = 4.1;
const VISIBILITY_MARGIN = 0.85;
const CARPET_ENTRANCE_INSET = 0.32;
const CARPET_REAR_CLEARANCE = 0.36;

/**
 * Visitor-facing castle audience chamber.
 *
 * `position` is the castle map footprint and `door` is one generated castle
 * door descriptor. Add `entity` to the castle root. `occupant` accepts
 * "king", "queen", or "princess".
 */
export class CastleAudienceRoom {
  static get modelUrls() {
    return [CastleThrone.modelUrl, ...SeatedRoyal.modelUrls];
  }

  static createOccupant({ pc, app, seed, modelLibrary }) {
    const modelUrls = SeatedRoyal.modelUrls;
    const modelUrl = modelUrls[(Number(seed) >>> 0) % modelUrls.length];
    return new SeatedRoyal({ pc, app, modelUrl, modelLibrary });
  }

  #pc;
  #position;
  #door;
  #occupant;
  #sharedMaterials;
  #modelLibrary;
  #entity;
  #materials = new Map();
  #fire = null;
  #royalPosition = null;
  #throne = null;
  #center;
  #inward;
  #tangent;
  #forwardCapacity;
  #roomWidth;
  #baseY;
  #availableDepth;
  #availableWidth;
  #obstacles = [];
  #heroWithinVisibility = false;
  #entranceVisible = false;
  #gameOverPerformance = false;
  #gameOverPerformanceStarted = false;
  #gameOverEndPosition = null;
  #getGameOverCameraPosition = null;

  constructor({
    pc,
    app,
    position,
    door,
    occupant,
    materials = new Map(),
    availableDepth = MAX_ROOM_DEPTH,
    availableWidth = Number.POSITIVE_INFINITY,
    modelLibrary,
    fireParticleTexture,
  }) {
    this.#pc = pc;
    this.#position = position;
    this.#door = door;
    this.#occupant = occupant;
    this.#sharedMaterials = materials;
    this.#modelLibrary = modelLibrary;
    this.#availableDepth = availableDepth;
    this.#availableWidth = availableWidth;
    this.#entity = new pc.Entity("Castle audience chamber");
    this.#baseY = position.elevation ?? 0;
    this.#fire = new CastleFire({
      pc,
      app,
      particleTexture: fireParticleTexture,
    });
    this.#entity.addChild(this.#fire.entity);

    this.#resolveLayout();
    this.#createMaterials();
    this.#build();
    this.#entity.enabled = false;
  }

  get entity() {
    return this.#entity;
  }

  updateHeroPosition({ x, z }) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const lateral = deltaX * this.#tangent.x + deltaZ * this.#tangent.z;
    const forward = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    this.#heroWithinVisibility =
      Math.abs(lateral) <= this.#roomWidth / 2 + VISIBILITY_MARGIN &&
      forward >= -VISIBILITY_MARGIN &&
      forward <= this.#forwardCapacity + VISIBILITY_MARGIN;
    this.#syncVisibility();
  }

  set entranceVisible(visible) {
    this.#entranceVisible = visible;
    this.#syncVisibility();
  }

  beginGameOver(getCameraPosition) {
    if (this.#gameOverPerformance || !this.#occupant || !this.#royalPosition) {
      return null;
    }
    this.#gameOverPerformance = true;
    const endPosition = this.#point(0, -1.15, 0.05);
    this.#gameOverEndPosition = endPosition;
    this.#getGameOverCameraPosition = getCameraPosition;
    this.#syncVisibility();
    const visualBounds = this.#occupant.visualBounds;
    const currentPosition = this.#occupant.entity.getPosition();
    const endWorldPosition = this.#entity
      .getWorldTransform()
      .transformPoint(
        new this.#pc.Vec3(endPosition.x, endPosition.y, endPosition.z),
      );
    return {
      focus: {
        x: endWorldPosition.x + visualBounds.center.x - currentPosition.x,
        y: endWorldPosition.y + visualBounds.center.y - currentPosition.y,
        z: endWorldPosition.z + visualBounds.center.z - currentPosition.z,
      },
      visualSize: visualBounds.size,
      viewRotation: GAME_OVER_VIEW_ROTATION_BY_SIDE[this.#door.side] ?? 0,
    };
  }

  startGameOverPerformance() {
    if (
      !this.#gameOverPerformance ||
      this.#gameOverPerformanceStarted ||
      !this.#occupant ||
      !this.#royalPosition ||
      !this.#gameOverEndPosition
    ) {
      return;
    }
    this.#gameOverPerformanceStarted = true;
    this.#occupant.beginGameOver({
      startPosition: this.#royalPosition,
      endPosition: this.#gameOverEndPosition,
      getCameraPosition: this.#getGameOverCameraPosition,
    });
  }

  update(deltaTime) {
    this.#occupant?.update(deltaTime);
  }

  surfaceHeightAt(x, z) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const lateral = deltaX * this.#tangent.x + deltaZ * this.#tangent.z;
    const forward = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    const insideFloor =
      Math.abs(lateral) <= this.#roomWidth / 2 &&
      forward >= -0.08 &&
      forward <= this.#forwardCapacity;
    return insideFloor ? this.#baseY : null;
  }

  intersectsFootprint(x, z, radius = 0) {
    const deltaX = x - this.#center.x;
    const deltaZ = z - this.#center.z;
    const lateral = deltaX * this.#tangent.x + deltaZ * this.#tangent.z;
    const forward = deltaX * this.#inward.x + deltaZ * this.#inward.z;
    return this.#obstacles.some((obstacle) => {
      const distanceLateral = Math.max(
        Math.abs(lateral - obstacle.lateral) - obstacle.width / 2,
        0,
      );
      const distanceForward = Math.max(
        Math.abs(forward - obstacle.forward) - obstacle.depth / 2,
        0,
      );
      return (
        distanceLateral * distanceLateral + distanceForward * distanceForward <=
        radius * radius
      );
    });
  }

  destroy() {
    this.#fire?.destroy();
    this.#fire = null;
    this.#occupant?.destroy();
    this.#occupant = null;
    this.#throne?.destroy();
    this.#throne = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    this.#obstacles = [];
  }

  #resolveLayout() {
    const { x, z, width, depth } = this.#position;
    const doorWidth = this.#door.width ?? 2;
    const offset = this.#door.offset ?? 0;
    const definitions = {
      WEST: {
        center: { x, z: z + offset + doorWidth / 2 },
        inward: { x: 1, z: 0 },
        tangent: { x: 0, z: 1 },
        capacity: width,
        span: depth,
      },
      EAST: {
        center: { x: x + width, z: z + offset + doorWidth / 2 },
        inward: { x: -1, z: 0 },
        tangent: { x: 0, z: 1 },
        capacity: width,
        span: depth,
      },
      NORTH: {
        center: { x: x + offset + doorWidth / 2, z },
        inward: { x: 0, z: 1 },
        tangent: { x: 1, z: 0 },
        capacity: depth,
        span: width,
      },
      SOUTH: {
        center: { x: x + offset + doorWidth / 2, z: z + depth },
        inward: { x: 0, z: -1 },
        tangent: { x: 1, z: 0 },
        capacity: depth,
        span: width,
      },
    };
    const layout = definitions[this.#door.side] ?? definitions.NORTH;
    this.#center = layout.center;
    this.#inward = layout.inward;
    this.#tangent = layout.tangent;
    const footprintCapacity = Math.max(0, layout.capacity - EDGE_MARGIN * 2);
    const castleCapacity = Math.max(0, this.#availableDepth);
    this.#forwardCapacity = Math.min(
      MAX_ROOM_DEPTH,
      footprintCapacity,
      castleCapacity,
    );
    this.#roomWidth = Math.max(
      0,
      Math.min(
        layout.span - EDGE_MARGIN * 2,
        this.#availableWidth,
        6.4,
      ),
    );
  }

  #createMaterials() {
    for (const [name, definition] of Object.entries(ROOM_MATERIALS)) {
      const sharedName = {
        wood: "castleDoor",
        woodLight: "castleDoorLight",
        iron: "castleIron",
      }[name];
      const shared = sharedName ? this.#sharedMaterials.get(sharedName) : null;
      if (shared) continue;

      const material = new this.#pc.StandardMaterial();
      material.name = `Audience room ${name}`;
      material.diffuse = colorFromHex(this.#pc, definition.color);
      material.gloss = definition.gloss ?? 0.08;
      material.metalness = definition.metalness ?? 0;
      material.useMetalness = true;
      if (definition.emissive) {
        material.emissive = colorFromHex(this.#pc, definition.emissive);
        material.emissiveIntensity = 1.5;
      }
      material.update();
      this.#materials.set(name, material);
    }
  }

  #build() {
    const throneForward = Math.min(
      this.#forwardCapacity - 0.76,
      Math.max(3.05, this.#forwardCapacity * 0.78),
    );
    this.#buildFloor(throneForward);
    this.#buildThrone(throneForward);
    this.#buildColumns(throneForward);
    this.#buildBenches(throneForward);
    this.#buildBraziers(throneForward);
    this.#buildRearBanners(throneForward);
  }

  #buildFloor(throneForward) {
    this.#boxAt(
      "Audience wooden floor",
      "woodLight",
      0,
      this.#forwardCapacity / 2,
      0.025,
      [this.#roomWidth, 0.05, this.#forwardCapacity],
    );
    for (const lateral of [
      -this.#roomWidth / 2 + 0.05,
      this.#roomWidth / 2 - 0.05,
    ]) {
      this.#boxAt(
        "Audience floor border",
        "wood",
        lateral,
        this.#forwardCapacity / 2,
        0.057,
        [0.1, 0.025, this.#forwardCapacity],
      );
    }
    for (let forward = 0.75; forward < this.#forwardCapacity; forward += 0.75) {
      this.#boxAt("Audience floor plank seam", "wood", 0, forward, 0.057, [
        this.#roomWidth - 0.18,
        0.025,
        0.035,
      ]);
    }

    const runnerStart = CARPET_ENTRANCE_INSET;
    const runnerEnd = Math.min(
      throneForward - 0.07,
      this.#forwardCapacity - CARPET_REAR_CLEARANCE,
    );
    const runnerLength = Math.max(0, runnerEnd - runnerStart);
    const runnerCenter = runnerStart + runnerLength / 2;
    const runnerWidth = Math.min(1.2, this.#roomWidth - 0.36);
    const runnerInnerWidth = Math.max(0, runnerWidth - 0.34);
    const runnerEdge = runnerWidth / 2 - 0.08;
    this.#boxAt(
      "Audience carpet runner",
      "carpetDark",
      0,
      runnerCenter,
      0.045,
      [runnerWidth, 0.07, runnerLength],
    );
    this.#boxAt(
      "Audience carpet center",
      "carpetLight",
      0,
      runnerCenter,
      0.085,
      [runnerInnerWidth, 0.025, Math.max(0, runnerLength - 0.12)],
    );
    for (const lateral of [-runnerEdge, runnerEdge]) {
      this.#boxAt(
        "Audience carpet gold edge",
        "carpetGold",
        lateral,
        runnerCenter,
        0.1,
        [0.08, 0.02, runnerLength],
      );
    }
  }

  #buildThrone(throneForward) {
    this.#throne = new CastleThrone({ modelLibrary: this.#modelLibrary });
    const throne = this.#throne.entity;
    const thronePosition = this.#point(0, throneForward, 0);
    throne.setLocalPosition(
      thronePosition.x,
      thronePosition.y,
      thronePosition.z,
    );
    throne.setLocalEulerAngles(0, this.#roomYaw(), 0);
    this.#entity.addChild(throne);
    this.#obstacles.push({
      lateral: 0,
      forward: throneForward + 0.1,
      width: 2.6,
      depth: 1.55,
    });

    const royalPosition = this.#point(0, throneForward - 0.07, 0.37);
    this.#royalPosition = royalPosition;
    this.#occupant.entity.setLocalPosition(
      royalPosition.x,
      royalPosition.y,
      royalPosition.z,
    );
    this.#occupant.entity.setLocalEulerAngles(0, this.#visitorFacingYaw(), 0);
    this.#occupant.entity.setLocalScale(0.72, 0.72, 0.72);
    this.#entity.addChild(this.#occupant.entity);
  }
  #buildColumns(throneForward) {
    const lateral = Math.max(1.35, this.#roomWidth / 2 - 0.76);
    const rows = [Math.min(1.72, throneForward * 0.38), throneForward * 0.72];
    for (const forward of rows) {
      for (const side of [-1, 1]) {
        this.#boxAt(
          "Audience column plinth",
          "wood",
          side * lateral,
          forward,
          0.14,
          [0.62, 0.28, 0.62],
          true,
        );
        this.#boxAt(
          "Audience square column",
          "woodLight",
          side * lateral,
          forward,
          0.93,
          [0.38, 1.58, 0.38],
        );
        this.#boxAt(
          "Audience column capital",
          "gold",
          side * lateral,
          forward,
          1.78,
          [0.58, 0.14, 0.58],
        );
      }
    }
  }

  #buildBenches(throneForward) {
    const lateral = Math.max(1.35, this.#roomWidth / 2 - 0.78);
    for (const side of [-1, 1]) {
      for (const forward of [2.35, Math.min(3.8, throneForward - 1.35)]) {
        if (forward >= throneForward - 0.65) continue;
        this.#boxAt(
          "Court visitor bench",
          "woodLight",
          side * lateral,
          forward,
          0.34,
          [0.54, 0.24, 1.05],
          true,
        );
        this.#boxAt(
          "Court visitor bench back",
          "wood",
          side * (lateral + 0.22),
          forward,
          0.66,
          [0.16, 0.68, 1.05],
        );
      }
    }
  }

  #buildBraziers(throneForward) {
    const lateral = Math.min(1.48, this.#roomWidth / 2 - 0.42);
    const rows = [Math.min(1.15, throneForward * 0.32), throneForward - 1.15];
    for (const forward of rows) {
      for (const side of [-1, 1]) {
        this.#boxAt(
          "Royal torch pedestal",
          "iron",
          side * lateral,
          forward,
          0.49,
          [0.24, 0.98, 0.24],
          true,
        );
        this.#boxAt(
          "Royal torch bowl",
          "gold",
          side * lateral,
          forward,
          1.01,
          [0.58, 0.18, 0.58],
        );
        const flamePosition = this.#point(
          side * lateral,
          forward,
          1.12,
        );
        this.#fire.add({
          x: flamePosition.x,
          y: flamePosition.y,
          z: flamePosition.z,
          scale: 0.18,
          brazier: false,
          intensity: 0.72,
        });
      }
    }
  }

  #buildRearBanners(throneForward) {
    const lateral = Math.min(1.68, this.#roomWidth / 2 - 0.48);
    for (const side of [-1, 1]) {
      this.#boxAt(
        "Audience chamber banner",
        "banner",
        side * lateral,
        throneForward + 0.56,
        1.62,
        [0.78, 1.38, 0.08],
      );
      this.#boxAt(
        "Audience banner stripe",
        "bannerLight",
        side * lateral,
        throneForward + 0.51,
        1.65,
        [0.18, 1.18, 0.035],
      );
      this.#boxAt(
        "Audience banner rail",
        "gold",
        side * lateral,
        throneForward + 0.58,
        2.35,
        [0.98, 0.09, 0.11],
      );
    }
  }

  #boxAt(
    name,
    materialName,
    lateral,
    forward,
    y,
    scale,
    blocksMovement = false,
  ) {
    const position = this.#point(lateral, forward, y);
    const entity = new this.#pc.Entity(name);
    entity.addComponent("render", {
      type: "box",
      castShadows: true,
      receiveShadows: true,
    });
    for (const meshInstance of entity.render.meshInstances) {
      meshInstance.material = this.#material(materialName);
    }
    entity.setLocalPosition(position.x, position.y, position.z);
    entity.setLocalEulerAngles(0, this.#roomYaw(), 0);
    entity.setLocalScale(...scale);
    this.#entity.addChild(entity);
    if (blocksMovement) {
      this.#obstacles.push({
        lateral,
        forward,
        width: scale[0],
        depth: scale[2],
      });
    }
    return entity;
  }

  #point(lateral, forward, y) {
    return {
      x: this.#center.x + this.#tangent.x * lateral + this.#inward.x * forward,
      y: this.#baseY + y,
      z: this.#center.z + this.#tangent.z * lateral + this.#inward.z * forward,
    };
  }

  #roomYaw() {
    if (this.#inward.x > 0) {
      return 90;
    }
    if (this.#inward.x < 0) {
      return -90;
    }
    if (this.#inward.z < 0) {
      return 180;
    }
    return 0;
  }

  #visitorFacingYaw() {
    if (this.#inward.x > 0) {
      return -90;
    }
    if (this.#inward.x < 0) {
      return 90;
    }
    if (this.#inward.z > 0) {
      return 180;
    }
    return 0;
  }

  #syncVisibility() {
    this.#entity.enabled =
      this.#gameOverPerformance ||
      this.#heroWithinVisibility ||
      this.#entranceVisible;
  }

  #material(name) {
    const sharedName = {
      wood: "castleDoor",
      woodLight: "castleDoorLight",
      iron: "castleIron",
      stone: "castleStoneMid",
      stoneLight: "castleStoneLight",
    }[name];
    return this.#materials.get(name) ?? this.#sharedMaterials.get(sharedName);
  }

}
