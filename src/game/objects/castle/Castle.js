import { CastleBanner } from "./CastleBanner.js";
import { CastleAudienceRoom } from "./CastleAudienceRoom.js";
import { CastleLeisureScene } from "./CastleLeisureScene.js";
import { CastleDoor } from "./CastleDoor.js";
import { CastleDoorArch } from "./CastleDoorArch.js";
import { CastleDoorTexture } from "./CastleDoorTexture.js";
import { CastleFire } from "./CastleFire.js";
import { CastleFlag } from "./CastleFlag.js";
import { CastleRoof } from "./CastleRoof.js";
import { CastleStairs } from "./CastleStairs.js";
import { CastleStoneTexture } from "./CastleStoneTexture.js";
import { CASTLE_BOUNDARY } from "../../enum/CastleBoundary.js";
import { CastlePlacementError } from "../../errors/castle/index.js";
import { colorFromHex } from "../../helpers/colors.js";

const CASTLE_MATERIAL_DEFINITIONS = {
  castleStoneDark: {
    color: 0x42494c,
    texture: "castleStone",
    gloss: 0.04,
  },
  castleStoneMid: {
    color: 0x5c6264,
    texture: "castleStone",
    gloss: 0.05,
  },
  castleStoneLight: {
    color: 0x767b7d,
    texture: "castleStone",
    gloss: 0.06,
  },
  castleArchStone: {
    color: 0xb0ada5,
    texture: "castleStone",
    gloss: 0.06,
  },
  castleAccent: {
    color: 0x8a8780,
    texture: "castleStone",
    gloss: 0.06,
  },
  castleDoor: { color: 0xffffff, texture: "castleDoor", gloss: 0.05 },
  castleDoorLight: {
    color: 0xe8c7a5,
    texture: "castleDoor",
    gloss: 0.06,
  },
  castleIron: { color: 0x171b1d, gloss: 0.16 },
};

const CASTLE_STYLES = [
  {
    id: "twin-tower",
    layout: "STRAIGHT",
    towerPlacements: ["FRONT_LEFT", "FRONT_RIGHT"],
    wallWings: [],
    wallHeightBlocks: 11,
    towerSpanBlocks: 8,
    towerHeightBlocks: 20,
    gateShoulderSpanBlocks: 2,
    gateCrownHeightBlocks: 24,
    battlementPeriod: 2,
    visualDepthBlocks: 20,
  },
  {
    id: "right-angle",
    layout: "L",
    towerPlacements: ["FRONT_RIGHT", "BACK_RIGHT"],
    wallWings: [CASTLE_BOUNDARY.RIGHT],
    wallHeightBlocks: 10,
    towerSpanBlocks: 9,
    towerHeightBlocks: 18,
    gateShoulderSpanBlocks: 4,
    gateCrownHeightBlocks: 22,
    battlementPeriod: 3,
    visualDepthBlocks: 24,
  },
  {
    id: "single-tower",
    layout: "SINGLE_TOWER",
    towerPlacements: ["FRONT_RIGHT"],
    wallWings: [],
    wallHeightBlocks: 12,
    towerSpanBlocks: 8,
    towerHeightBlocks: 22,
    gateShoulderSpanBlocks: 3,
    gateCrownHeightBlocks: 26,
    battlementPeriod: 2,
    visualDepthBlocks: 20,
  },
  {
    id: "left-angle",
    layout: "L",
    towerPlacements: ["FRONT_LEFT", "BACK_LEFT"],
    wallWings: [CASTLE_BOUNDARY.LEFT],
    wallHeightBlocks: 11,
    towerSpanBlocks: 8,
    towerHeightBlocks: 20,
    gateShoulderSpanBlocks: 2,
    gateCrownHeightBlocks: 24,
    battlementPeriod: 3,
    visualDepthBlocks: 24,
  },
];

const CUBE_SCALE = 1;
const CASTLE_BLOCK_SIZE = CUBE_SCALE / 4;
const CASTLE_BLOCKS_PER_TILE = CUBE_SCALE / CASTLE_BLOCK_SIZE;
const CASTLE_WALL_THICKNESS_BLOCKS = 2;
const CASTLE_WALL_HEIGHT_BLOCKS = 15;
const CASTLE_TOWER_SPAN_BLOCKS = 6;
const CASTLE_TOWER_HEIGHT_BLOCKS = 18;
const CASTLE_GATE_CROWN_HEIGHT_BLOCKS = 22;
const CASTLE_GATE_OPENING_HEIGHT_BLOCKS = 9;
const CASTLE_GATE_ARCH_SPRING_BLOCKS = 5;
const CASTLE_GATE_PYLON_SPAN_BLOCKS = 5;
const CASTLE_DOOR_WIDTH_TILES = 2;
const CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS = 18;
const CASTLE_AUDIENCE_ROOM_SIDE_INSET_BLOCKS = 3;

export class Castle {
  static get modelUrls() {
    return [
      CastleDoor.modelUrl,
      CastleDoorArch.modelUrl,
      CastleStairs.modelUrl,
      ...CastleAudienceRoom.modelUrls,
      ...CastleLeisureScene.modelUrls,
    ];
  }

  #pc;
  #app;
  #position;
  #doors;
  #styleId;
  #occupantSeed;
  #modelLibrary;
  #fireParticleTexture;
  #entity;
  #materials = new Map();
  #stoneTexture = null;
  #doorTexture = null;
  #blockMesh = null;
  #vertexBuffers = [];
  #fire = null;
  #banners = null;
  #flags = null;
  #activeWindTarget = null;
  #roofs = null;
  #stairs = null;
  #audienceRoom = null;
  #leisureScene = null;
  #groundCollisionColumns = [];
  #groundCollisionKeys = new Set();
  #animatedDoors = [];
  #doorArches = [];
  #updateHandle = null;
  #interiorDepth = 0;
  #interiorWidth = 0;

  constructor({
    pc,
    app,
    position,
    doors = [],
    style = null,
    occupantSeed = 0,
    modelLibrary,
    fireParticleTexture,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#position = position;
    this.#doors = doors;
    this.#styleId = style;
    this.#occupantSeed = occupantSeed;
    this.#modelLibrary = modelLibrary;
    this.#fireParticleTexture = fireParticleTexture;
    this.#entity = new pc.Entity("Castle");

    this.#createStructureResources();
    this.#createDecorations();
    this.#createStairs();
    this.#render();
    this.#createAudienceRoom();
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  get leisureState() {
    return this.#leisureScene?.state ?? null;
  }

  setLeisurePresent(present) {
    this.#leisureScene?.setVisitorPresent(present);
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    if (this.#audienceRoom?.intersectsFootprint(x, z, radius)) {
      return true;
    }
    if (
      this.#animatedDoors.some((door) => door.intersectsFootprint(x, z, radius))
    ) {
      return true;
    }
    const radiusSquared = radius * radius;
    for (const column of this.#groundCollisionColumns) {
      const distanceX = Math.max(
        Math.abs(x - column.x) - CASTLE_BLOCK_SIZE / 2,
        0,
      );
      const distanceZ = Math.max(
        Math.abs(z - column.z) - CASTLE_BLOCK_SIZE / 2,
        0,
      );
      if (distanceX * distanceX + distanceZ * distanceZ <= radiusSquared) {
        return true;
      }
    }
    return false;
  }

  blocksMovementAt(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    // The room floor supports walking; it must not cancel its solid furniture,
    // walls, or closed doors when the collision world queries this aggregate.
    if (this.intersectsGroundFootprint(x, z, radius)) {
      return true;
    }
    return this.#stairs?.blocksMovementAt(
      x,
      z,
      radius,
      elevation,
      stepClearance,
    ) ?? false;
  }

  surfaceHeightAt(x, z) {
    return (
      this.#stairs?.surfaceHeightAt(x, z) ??
      this.#audienceRoom?.surfaceHeightAt(x, z) ??
      null
    );
  }

  updateHeroPosition(position) {
    for (const door of this.#animatedDoors) {
      door.updateHeroPosition(position);
    }
    this.#leisureScene?.updateHeroPosition(position);
    this.#syncAudienceRoomVisibility();
    this.#audienceRoom?.updateHeroPosition(position);
  }

  getBannerHit(rayStart, rayEnd) {
    const bannerHit = this.#banners?.getBannerHit(rayStart, rayEnd) ?? null;
    const flagHit = this.#flags?.getFlagHit(rayStart, rayEnd) ?? null;
    if (!bannerHit) {
      return flagHit;
    }
    if (!flagHit) {
      return bannerHit;
    }
    return flagHit.distance < bannerHit.distance ? flagHit : bannerHit;
  }

  getDoorHit(rayStart, rayEnd) {
    let closest = null;
    for (const door of this.#animatedDoors) {
      const hit = door.getHit(rayStart, rayEnd);
      if (!hit || (closest && hit.distance >= closest.distance)) continue;
      closest = hit;
    }
    return closest;
  }

  openDoor(hit) {
    if (!hit?.door) {
      return false;
    }
    hit.door.openTemporarily();
    this.#syncAudienceRoomVisibility();
    return true;
  }

  beginGameOver(getCameraPosition) {
    this.#leisureScene?.stop();
    this.#syncAudienceRoomVisibility();
    for (const door of this.#animatedDoors) door.openTemporarily(10);
    return this.#audienceRoom?.beginGameOver(getCameraPosition) ?? null;
  }

  startGameOverPerformance() {
    this.#audienceRoom?.startGameOverPerformance();
  }

  beginWindGesture(hit) {
    this.#activeWindTarget = hit?.flag ? this.#flags : this.#banners;
    this.#activeWindTarget?.beginWindGesture(hit);
  }

  applyMouseWind(rayStart, rayEnd, deltaTime) {
    this.#activeWindTarget?.applyMouseWind(rayStart, rayEnd, deltaTime);
  }

  endWindGesture() {
    this.#activeWindTarget?.endWindGesture();
    this.#activeWindTarget = null;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.endWindGesture();
    for (const door of this.#animatedDoors) door.destroy();
    this.#animatedDoors = [];
    for (const arch of this.#doorArches) arch.destroy();
    this.#doorArches = [];
    this.#audienceRoom?.destroy();
    this.#audienceRoom = null;
    this.#leisureScene?.destroy();
    this.#leisureScene = null;
    this.#fire?.destroy();
    this.#fire = null;
    this.#banners?.destroy();
    this.#banners = null;
    this.#flags?.destroy();
    this.#flags = null;
    this.#roofs?.destroy();
    this.#roofs = null;
    this.#stairs?.destroy();
    this.#stairs = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
    this.#blockMesh?.decRefCount();
    if (this.#blockMesh?.refCount < 1) this.#blockMesh.destroy();
    this.#blockMesh = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    this.#stoneTexture?.destroy();
    this.#stoneTexture = null;
    this.#doorTexture?.destroy();
    this.#doorTexture = null;
    this.#fireParticleTexture = null;
    this.#groundCollisionColumns = [];
    this.#groundCollisionKeys.clear();
  }

  #update = (deltaTime) => {
    this.#leisureScene?.update(deltaTime);
    for (const door of this.#animatedDoors) door.update(deltaTime);
    this.#audienceRoom?.update(deltaTime);
    this.#syncAudienceRoomVisibility();
  };

  #syncAudienceRoomVisibility() {
    if (this.#audienceRoom) {
      this.#audienceRoom.royalVisible = !this.#leisureScene?.active;
      this.#audienceRoom.entranceVisible =
        this.#animatedDoors[0]?.revealsInterior ?? false;
    }
  }

  #createStructureResources() {
    this.#stoneTexture = CastleStoneTexture.create(
      this.#pc,
      this.#app.graphicsDevice,
    );
    this.#doorTexture = CastleDoorTexture.create(
      this.#pc,
      this.#app.graphicsDevice,
    );
    for (const [name, definition] of Object.entries(
      CASTLE_MATERIAL_DEFINITIONS,
    )) {
      const material = new this.#pc.StandardMaterial();
      material.name = name;
      material.diffuse = colorFromHex(this.#pc, definition.color);
      material.gloss = definition.gloss ?? 0.08;
      material.metalness = 0;
      material.useMetalness = true;
      if (definition.texture === "castleStone") {
        material.diffuseMap = this.#stoneTexture;
      } else if (definition.texture === "castleDoor") {
        material.diffuseMap = this.#doorTexture;
      }
      material.update();
      this.#materials.set(name, material);
    }

    this.#blockMesh = this.#pc.Mesh.fromGeometry(
      this.#app.graphicsDevice,
      new this.#pc.BoxGeometry(),
    );
    this.#blockMesh.incRefCount();
  }

  #createDecorations() {
    this.#fire = new CastleFire({
      pc: this.#pc,
      app: this.#app,
      particleTexture: this.#fireParticleTexture,
    });
    this.#entity.addChild(this.#fire.entity);
    this.#banners = new CastleBanner({ pc: this.#pc, app: this.#app });
    this.#entity.addChild(this.#banners.entity);
    this.#flags = new CastleFlag({ pc: this.#pc, app: this.#app });
    this.#entity.addChild(this.#flags.entity);
    this.#roofs = new CastleRoof({ pc: this.#pc, app: this.#app });
    this.#entity.addChild(this.#roofs.entity);
  }

  #createStairs() {
    this.#stairs = new CastleStairs({
      pc: this.#pc,
      position: this.#position,
      doors: this.#doors,
      cubeSize: CASTLE_BLOCK_SIZE,
      modelLibrary: this.#modelLibrary,
      materials: this.#materials,
    });
    this.#entity.addChild(this.#stairs.entity);
  }

  #createAudienceRoom() {
    const door = this.#doors[0];
    if (!door) {
      return;
    }
    const occupant = CastleAudienceRoom.createOccupant({
      pc: this.#pc,
      app: this.#app,
      seed: this.#occupantSeed,
      modelLibrary: this.#modelLibrary,
    });
    this.#audienceRoom = new CastleAudienceRoom({
      pc: this.#pc,
      app: this.#app,
      position: this.#position,
      door,
      occupant,
      materials: this.#materials,
      availableDepth: this.#interiorDepth,
      availableWidth: this.#interiorWidth,
      modelLibrary: this.#modelLibrary,
      fireParticleTexture: this.#fireParticleTexture,
    });
    this.#entity.addChild(this.#audienceRoom.entity);
  }

  #addBoxMatrix(batches, material, x, y, z, yaw, sx, sy, sz) {
    const matrix = new this.#pc.Mat4();
    const rotation = new this.#pc.Quat();
    rotation.setFromEulerAngles(0, yaw, 0);
    matrix.setTRS(
      new this.#pc.Vec3(x, y, z),
      rotation,
      new this.#pc.Vec3(sx, sy, sz),
    );
    const data = batches.get(material) ?? [];
    for (const value of matrix.data) data.push(value);
    batches.set(material, data);
  }

  #createInstancedBatches(batches) {
    for (const [materialName, matrices] of batches.entries()) {
      if (!matrices.length) continue;
      const vertexBuffer = new this.#pc.VertexBuffer(
        this.#app.graphicsDevice,
        this.#pc.VertexFormat.getDefaultInstancingFormat(
          this.#app.graphicsDevice,
        ),
        matrices.length / 16,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const meshInstance = new this.#pc.MeshInstance(
        this.#blockMesh,
        this.#materials.get(materialName),
      );
      meshInstance.setInstancing(vertexBuffer, false);
      meshInstance.castShadow = true;
      meshInstance.receiveShadow = true;

      const entity = new this.#pc.Entity(`${materialName} castle blocks`);
      entity.addComponent("render", {
        meshInstances: [meshInstance],
        castShadows: true,
        receiveShadows: true,
      });
      this.#entity.addChild(entity);
    }
  }

  #selectStyle(openings, facadeSpan, inwardCapacity) {
    const preferredStyle = CASTLE_STYLES.find(
      (candidate) => candidate.id === this.#styleId,
    );
    const styles = preferredStyle
      ? [
          preferredStyle,
          ...CASTLE_STYLES.filter(
            (candidate) => candidate !== preferredStyle,
          ),
        ]
      : [...CASTLE_STYLES];
    const style = styles.find((candidate) =>
      this.#styleFits(candidate, openings, facadeSpan, inwardCapacity),
    );
    if (style) {
      return style;
    }

    throw new CastlePlacementError();
  }

  #styleFits(style, openings, facadeSpan, inwardCapacity) {
    const towerSpan = style.towerSpanBlocks ?? CASTLE_TOWER_SPAN_BLOCKS;
    const requiredDepth = Math.max(
      style.visualDepthBlocks ?? CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
      CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
    );
    const castleDepth = Math.min(requiredDepth, inwardCapacity);
    if (
      towerSpan > inwardCapacity ||
      towerSpan > facadeSpan ||
      requiredDepth > inwardCapacity
    ) {
      return false;
    }

    const requiredDoorWidth = CASTLE_DOOR_WIDTH_TILES * CASTLE_BLOCKS_PER_TILE;
    return openings.every((opening) => {
      if (opening.end - opening.start !== requiredDoorWidth) {
        return false;
      }
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (
        opening.start < CASTLE_GATE_PYLON_SPAN_BLOCKS ||
        opening.end > horizontalLimit - CASTLE_GATE_PYLON_SPAN_BLOCKS
      ) {
        return false;
      }

      const towerRanges = [];
      for (const placement of style.towerPlacements ?? []) {
        const boundaryRanges = {
          FRONT_LEFT: {
            [CASTLE_BOUNDARY.FRONT]: [0, towerSpan],
            [CASTLE_BOUNDARY.LEFT]: [0, towerSpan],
          },
          FRONT_RIGHT: {
            [CASTLE_BOUNDARY.FRONT]: [facadeSpan - towerSpan, facadeSpan],
            [CASTLE_BOUNDARY.RIGHT]: [0, towerSpan],
          },
          BACK_LEFT: {
            [CASTLE_BOUNDARY.BACK]: [0, towerSpan],
            [CASTLE_BOUNDARY.LEFT]: [castleDepth - towerSpan, castleDepth],
          },
          BACK_RIGHT: {
            [CASTLE_BOUNDARY.BACK]: [facadeSpan - towerSpan, facadeSpan],
            [CASTLE_BOUNDARY.RIGHT]: [castleDepth - towerSpan, castleDepth],
          },
        };
        const range = boundaryRanges[placement]?.[opening.boundary];
        if (range) towerRanges.push(range);
      }

      return towerRanges.every(
        ([start, end]) => opening.end <= start || opening.start >= end,
      );
    });
  }

  #render() {
    const position = this.#position;
    const doors = this.#doors;
    if (!position || !doors.length) {
      return;
    }

    const widthBlocks = position.width * CASTLE_BLOCKS_PER_TILE;
    const depthBlocks = position.depth * CASTLE_BLOCKS_PER_TILE;
    const worldLeft = position.x;
    const worldTop = position.z;
    const baseY = Math.max(0, position.elevation ?? 3);
    const primarySide = doors[0].side;
    const inwardCapacity =
      primarySide === "WEST" || primarySide === "EAST"
        ? widthBlocks
        : depthBlocks;
    const facadeSpan =
      primarySide === "WEST" || primarySide === "EAST"
        ? depthBlocks
        : widthBlocks;
    const rawOpenings = doors.map((door) => {
      return {
        side: door.side,
        start: door.offset * CASTLE_BLOCKS_PER_TILE,
        end: (door.offset + door.width) * CASTLE_BLOCKS_PER_TILE,
      };
    });
    const localBoundary = (side) => {
      const boundaries = {
        WEST: {
          WEST: CASTLE_BOUNDARY.FRONT,
          EAST: CASTLE_BOUNDARY.BACK,
          NORTH: CASTLE_BOUNDARY.LEFT,
          SOUTH: CASTLE_BOUNDARY.RIGHT,
        },
        EAST: {
          EAST: CASTLE_BOUNDARY.FRONT,
          WEST: CASTLE_BOUNDARY.BACK,
          NORTH: CASTLE_BOUNDARY.LEFT,
          SOUTH: CASTLE_BOUNDARY.RIGHT,
        },
        NORTH: {
          NORTH: CASTLE_BOUNDARY.FRONT,
          SOUTH: CASTLE_BOUNDARY.BACK,
          WEST: CASTLE_BOUNDARY.LEFT,
          EAST: CASTLE_BOUNDARY.RIGHT,
        },
        SOUTH: {
          SOUTH: CASTLE_BOUNDARY.FRONT,
          NORTH: CASTLE_BOUNDARY.BACK,
          WEST: CASTLE_BOUNDARY.LEFT,
          EAST: CASTLE_BOUNDARY.RIGHT,
        },
      };
      return boundaries[primarySide]?.[side] ?? CASTLE_BOUNDARY.FRONT;
    };
    const openings = rawOpenings.map((opening) => {
      const boundary = localBoundary(opening.side);
      const reverse =
        (primarySide === "EAST" &&
          [CASTLE_BOUNDARY.LEFT, CASTLE_BOUNDARY.RIGHT].includes(boundary)) ||
        (primarySide === "SOUTH" &&
          [CASTLE_BOUNDARY.LEFT, CASTLE_BOUNDARY.RIGHT].includes(boundary));
      const axisLength =
        opening.side === "WEST" || opening.side === "EAST"
          ? depthBlocks
          : widthBlocks;
      return {
        boundary,
        start: reverse ? axisLength - opening.end : opening.start,
        end: reverse ? axisLength - opening.start : opening.end,
      };
    });
    const style = this.#selectStyle(openings, facadeSpan, inwardCapacity);
    const wallHeight = style.wallHeightBlocks ?? CASTLE_WALL_HEIGHT_BLOCKS;
    const towerSpan = style.towerSpanBlocks ?? CASTLE_TOWER_SPAN_BLOCKS;
    const towerHeight = style.towerHeightBlocks ?? CASTLE_TOWER_HEIGHT_BLOCKS;
    const battlementPeriod = style.battlementPeriod ?? 2;
    const hasSecondarySide = openings.some(
      (opening) => opening.boundary !== CASTLE_BOUNDARY.FRONT,
    );
    const castleDepth = hasSecondarySide
      ? inwardCapacity
      : Math.min(
          Math.max(
            style.visualDepthBlocks ?? CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
            CASTLE_AUDIENCE_ROOM_DEPTH_BLOCKS,
          ),
          inwardCapacity,
        );
    this.#interiorDepth =
      (castleDepth - CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
    const audienceOpening = openings.find(
      (opening) => opening.boundary === CASTLE_BOUNDARY.FRONT,
    );
    const gatehouseDepth = Math.min(towerSpan, castleDepth);
    const roofDoorWidth = 4;
    const roofDoorStart = audienceOpening
      ? Math.floor(
          (audienceOpening.start + audienceOpening.end - roofDoorWidth) / 2,
        )
      : 0;
    const roofDoorBase = wallHeight + 1;
    const stairwellStart = Math.max(1, gatehouseDepth - 5);
    const isTerraceAccessVoid = (blockU, blockY, blockV) =>
      Boolean(audienceOpening) &&
      blockV >= roofDoorStart &&
      blockV < roofDoorStart + roofDoorWidth &&
      ((blockU >= 1 &&
        blockU < gatehouseDepth &&
        blockY >= roofDoorBase &&
        blockY < roofDoorBase + 5) ||
        (blockU >= stairwellStart &&
          blockU < gatehouseDepth &&
          blockY === wallHeight));
    const batches = new Map();
    const occupied = new Set();
    const materialFor = (blockU, blockY, blockV, role) => {
      const roleMaterials = {
        accent: "castleAccent",
        door: "castleDoor",
        doorLight: "castleDoorLight",
        iron: "castleIron",
        trim: "castleStoneLight",
        arch: "castleArchStone",
      };
      if (roleMaterials[role]) {
        return roleMaterials[role];
      }
      const hash =
        Math.imul(blockU + 11, 73856093) ^
        Math.imul(blockY + 17, 19349663) ^
        Math.imul(blockV + 23, 83492791);
      return [
        "castleStoneDark",
        "castleStoneMid",
        "castleStoneMid",
        "castleStoneMid",
        "castleStoneMid",
        "castleStoneMid",
        "castleStoneMid",
        "castleStoneDark",
      ][(hash >>> 0) % 8];
    };
    const localToBlock = (blockU, blockV) => {
      let blockX;
      let blockZ;
      if (primarySide === "EAST") {
        blockX = widthBlocks - 1 - blockU;
        blockZ = blockV;
      } else if (primarySide === "NORTH") {
        blockX = blockV;
        blockZ = blockU;
      } else if (primarySide === "SOUTH") {
        blockX = blockV;
        blockZ = depthBlocks - 1 - blockU;
      } else {
        blockX = blockU;
        blockZ = blockV;
      }
      return { blockX, blockZ };
    };
    const localToWorld = (blockU, blockV) => {
      const { blockX, blockZ } = localToBlock(blockU, blockV);
      return {
        x: worldLeft + (blockX + 0.5) * CASTLE_BLOCK_SIZE,
        z: worldTop + (blockZ + 0.5) * CASTLE_BLOCK_SIZE,
      };
    };
    const addFlame = (blockU, blockY, blockV, scale = 1) => {
      const position = localToWorld(blockU, blockV);
      this.#fire.add({
        x: position.x,
        y: baseY + blockY * CASTLE_BLOCK_SIZE,
        z: position.z,
        scale: scale * CASTLE_BLOCK_SIZE,
      });
    };
    const boundaryNormal = (boundary) => {
      const normals = {
        WEST: {
          [CASTLE_BOUNDARY.FRONT]: { x: -1, z: 0 },
          [CASTLE_BOUNDARY.BACK]: { x: 1, z: 0 },
          [CASTLE_BOUNDARY.LEFT]: { x: 0, z: -1 },
          [CASTLE_BOUNDARY.RIGHT]: { x: 0, z: 1 },
        },
        EAST: {
          [CASTLE_BOUNDARY.FRONT]: { x: 1, z: 0 },
          [CASTLE_BOUNDARY.BACK]: { x: -1, z: 0 },
          [CASTLE_BOUNDARY.LEFT]: { x: 0, z: -1 },
          [CASTLE_BOUNDARY.RIGHT]: { x: 0, z: 1 },
        },
        NORTH: {
          [CASTLE_BOUNDARY.FRONT]: { x: 0, z: -1 },
          [CASTLE_BOUNDARY.BACK]: { x: 0, z: 1 },
          [CASTLE_BOUNDARY.LEFT]: { x: -1, z: 0 },
          [CASTLE_BOUNDARY.RIGHT]: { x: 1, z: 0 },
        },
        SOUTH: {
          [CASTLE_BOUNDARY.FRONT]: { x: 0, z: 1 },
          [CASTLE_BOUNDARY.BACK]: { x: 0, z: -1 },
          [CASTLE_BOUNDARY.LEFT]: { x: -1, z: 0 },
          [CASTLE_BOUNDARY.RIGHT]: { x: 1, z: 0 },
        },
      };
      return normals[primarySide][boundary];
    };
    const addBanner = (
      blockU,
      blockY,
      blockV,
      widthBlocks,
      heightBlocks,
      boundary = CASTLE_BOUNDARY.FRONT,
    ) => {
      const position = localToWorld(blockU, blockV);
      const normal = boundaryNormal(boundary);
      this.#banners.add({
        x: position.x,
        y: baseY + (blockY + 0.5 + heightBlocks / 2) * CASTLE_BLOCK_SIZE,
        z: position.z,
        yaw: (Math.atan2(normal.x, normal.z) * 180) / Math.PI,
        width: widthBlocks * CASTLE_BLOCK_SIZE,
        height: heightBlocks * CASTLE_BLOCK_SIZE,
      });
    };
    const addFlag = (
      blockU,
      blockY,
      blockV,
      boundary = CASTLE_BOUNDARY.FRONT,
    ) => {
      const position = localToWorld(blockU, blockV);
      const normal = boundaryNormal(boundary);
      this.#flags.add({
        x: position.x,
        y: baseY + blockY * CASTLE_BLOCK_SIZE,
        z: position.z,
        yaw: (Math.atan2(normal.x, normal.z) * 180) / Math.PI,
        width: 5 * CASTLE_BLOCK_SIZE,
        height: 2.5 * CASTLE_BLOCK_SIZE,
        poleHeight: 5 * CASTLE_BLOCK_SIZE,
      });
    };
    const addRoof = (
      blockU,
      blockY,
      blockV,
      widthBlocks,
      depthBlocks,
      heightBlocks,
      boundary = CASTLE_BOUNDARY.FRONT,
    ) => {
      const position = localToWorld(blockU, blockV);
      const normal = boundaryNormal(boundary);
      this.#roofs.add({
        x: position.x,
        y: baseY + blockY * CASTLE_BLOCK_SIZE,
        z: position.z,
        yaw: (Math.atan2(normal.x, normal.z) * 180) / Math.PI,
        width: widthBlocks * CASTLE_BLOCK_SIZE,
        depth: depthBlocks * CASTLE_BLOCK_SIZE,
        height: heightBlocks * CASTLE_BLOCK_SIZE,
      });
    };
    const addLocalBox = (
      blockU,
      blockY,
      blockV,
      scaleU,
      scaleY,
      scaleV,
      role = "stone",
    ) => {
      const material = materialFor(
        Math.round(blockU),
        Math.round(blockY),
        Math.round(blockV),
        role,
      );
      const position = localToWorld(blockU, blockV);
      const rotated = primarySide === "NORTH" || primarySide === "SOUTH";
      this.#addBoxMatrix(
        batches,
        material,
        position.x,
        baseY + (blockY + 0.5) * CASTLE_BLOCK_SIZE,
        position.z,
        0,
        (rotated ? scaleV : scaleU) * CASTLE_BLOCK_SIZE,
        scaleY * CASTLE_BLOCK_SIZE,
        (rotated ? scaleU : scaleV) * CASTLE_BLOCK_SIZE,
      );
    };
    const addBlock = (blockU, blockY, blockV, role = "stone") => {
      if (isTerraceAccessVoid(blockU, blockY, blockV)) {
        return;
      }
      const { blockX, blockZ } = localToBlock(blockU, blockV);
      if (
        blockX < 0 ||
        blockX >= widthBlocks ||
        blockZ < 0 ||
        blockZ >= depthBlocks
      ) {
        return;
      }
      const key = blockU + "," + blockY + "," + blockV;
      if (occupied.has(key)) {
        return;
      }
      occupied.add(key);
      if (blockY === 0) {
        const collisionKey = `${blockX},${blockZ}`;
        if (!this.#groundCollisionKeys.has(collisionKey)) {
          const position = localToWorld(blockU, blockV);
          this.#groundCollisionKeys.add(collisionKey);
          this.#groundCollisionColumns.push(position);
        }
      }
      addLocalBox(blockU, blockY, blockV, 1, 1, 1, role);
    };
    const addRoofFireTurret = (centerU, centerV, baseBlockY) => {
      const turretU = Math.round(centerU);
      const turretV = Math.round(centerV);
      const turretHeight = 3;
      for (
        let blockY = baseBlockY;
        blockY < baseBlockY + turretHeight;
        blockY += 1
      ) {
        for (let offsetU = -1; offsetU <= 1; offsetU += 1) {
          for (let offsetV = -1; offsetV <= 1; offsetV += 1) {
            const topCourse = blockY === baseBlockY + turretHeight - 1;
            const edge = Math.abs(offsetU) === 1 || Math.abs(offsetV) === 1;
            addBlock(
              turretU + offsetU,
              blockY,
              turretV + offsetV,
              topCourse && edge ? "trim" : "stone",
            );
          }
        }
      }
      for (const [offsetU, offsetV] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [0, 0],
      ]) {
        addBlock(
          turretU + offsetU,
          baseBlockY + turretHeight,
          turretV + offsetV,
          "trim",
        );
      }
      return {
        blockU: turretU,
        blockV: turretV,
        flameBlockY: baseBlockY + turretHeight + 1,
      };
    };
    const openingAt = (boundary, horizontalBlock, blockY) => {
      const opening = openings.find(
        (candidate) =>
          candidate.boundary === boundary &&
          horizontalBlock >= candidate.start &&
          horizontalBlock < candidate.end,
      );
      if (!opening) {
        return false;
      }

      const width = opening.end - opening.start;
      const localBlock = horizontalBlock - opening.start;
      const distanceFromEdge = Math.min(localBlock, width - 1 - localBlock);
      const halfWidth = width / 2;
      const normalizedRadius = Math.min(
        1,
        distanceFromEdge / Math.max(1, halfWidth - 1),
      );
      const archHeight = Math.min(
        CASTLE_GATE_OPENING_HEIGHT_BLOCKS,
        Math.round(
          CASTLE_GATE_ARCH_SPRING_BLOCKS +
            (CASTLE_GATE_OPENING_HEIGHT_BLOCKS -
              CASTLE_GATE_ARCH_SPRING_BLOCKS) *
              Math.sqrt(1 - (1 - normalizedRadius) ** 2),
        ),
      );
      return blockY < archHeight;
    };

    this.#buildCastleWallShell(
      addBlock,
      openingAt,
      castleDepth,
      facadeSpan,
      towerSpan,
      wallHeight,
      battlementPeriod,
      style.wallWings,
    );
    if (audienceOpening) {
      this.#interiorWidth = this.#buildCastleAudienceWing(
        addBlock,
        audienceOpening,
        castleDepth,
        facadeSpan,
        towerSpan,
        wallHeight,
        battlementPeriod,
      );
    }

    const towerPositions = {
      FRONT_LEFT: { u: 0, v: 0, front: true },
      FRONT_RIGHT: { u: 0, v: facadeSpan - towerSpan, front: true },
      BACK_LEFT: { u: castleDepth - towerSpan, v: 0, front: false },
      BACK_RIGHT: {
        u: castleDepth - towerSpan,
        v: facadeSpan - towerSpan,
        front: false,
      },
    };
    for (const placement of style.towerPlacements ?? []) {
      const tower = towerPositions[placement];
      if (!tower) continue;
      this.#buildCastleTower(
        addBlock,
        tower.u,
        tower.v,
        towerSpan,
        towerSpan,
        0,
        towerHeight,
        battlementPeriod,
      );
      const centerU = tower.u + (towerSpan - 1) / 2;
      const centerV = tower.v + (towerSpan - 1) / 2;
      if (tower.front) {
        for (const ledgeHeight of [2, towerHeight - 5]) {
          addLocalBox(
            -0.58,
            ledgeHeight,
            centerV,
            0.32,
            0.62,
            towerSpan + 0.7,
            "trim",
          );
        }
        addBanner(-0.76, towerHeight - 8, centerV, 2.5, 4.5);
      }
      const fireTurret = addRoofFireTurret(centerU, centerV, towerHeight);
      addFlame(
        fireTurret.blockU,
        fireTurret.flameBlockY,
        fireTurret.blockV,
        1.05,
      );
    }

    for (const opening of openings) {
      this.#buildCastleGatehouse(
        addBlock,
        addLocalBox,
        addFlame,
        addBanner,
        addFlag,
        addRoof,
        opening,
        castleDepth,
        facadeSpan,
        towerSpan,
        towerHeight,
        battlementPeriod,
        opening.boundary === CASTLE_BOUNDARY.FRONT ? style : null,
      );
    }
    this.#createInstancedBatches(batches);
    this.#createAnimatedDoors();
    if (audienceOpening) {
      const gatehouseDepth = Math.min(towerSpan, castleDepth);
      const doorStart = Math.floor(
        (audienceOpening.start + audienceOpening.end - 4) / 2,
      );
      const terracePosition = localToWorld(gatehouseDepth - 0.68, doorStart + 1.5);
      this.#leisureScene = new CastleLeisureScene({
        pc: this.#pc,
        modelLibrary: this.#modelLibrary,
        seed: this.#occupantSeed,
        position: this.#position,
        doors: this.#doors,
        layout: {
          ...terracePosition,
          y: baseY + (wallHeight + 1) * CASTLE_BLOCK_SIZE,
          yaw: { WEST: 90, EAST: -90, NORTH: 0, SOUTH: 180 }[primarySide],
          depth: (castleDepth - gatehouseDepth - 1) * CASTLE_BLOCK_SIZE,
          width: this.#interiorWidth,
        },
      });
      this.#entity.addChild(this.#leisureScene.entity);
    }
  }

  #createAnimatedDoors() {
    for (const doorData of this.#doors) {
      const arch = new CastleDoorArch({
        castlePosition: this.#position,
        door: doorData,
        modelLibrary: this.#modelLibrary,
      });
      this.#entity.addChild(arch.entity);
      this.#doorArches.push(arch);
      const door = new CastleDoor({
        pc: this.#pc,
        castlePosition: this.#position,
        door: doorData,
        modelLibrary: this.#modelLibrary,
      });
      this.#entity.addChild(door.entity);
      this.#animatedDoors.push(door);
    }
  }

  #buildCastleWallShell(
    addBlock,
    openingAt,
    castleDepth,
    facadeSpan,
    towerSpan,
    wallHeight,
    battlementPeriod,
    wallWings = [],
  ) {
    const wallDepth = Math.min(castleDepth, towerSpan);
    const hasLeftWing = wallWings.includes(CASTLE_BOUNDARY.LEFT);
    const hasRightWing = wallWings.includes(CASTLE_BOUNDARY.RIGHT);
    const facadeInset =
      hasLeftWing || hasRightWing ? 0 : Math.min(1, wallDepth - 1);
    for (let blockU = 0; blockU < castleDepth; blockU += 1) {
      for (let blockV = 0; blockV < facadeSpan; blockV += 1) {
        for (let blockY = 0; blockY < wallHeight; blockY += 1) {
          const role =
            blockY === 2 || blockY === wallHeight - 3 ? "trim" : "stone";
          const crossesLeftGate =
            blockV < CASTLE_WALL_THICKNESS_BLOCKS &&
            openingAt(CASTLE_BOUNDARY.LEFT, blockU, blockY);
          const crossesRightGate =
            blockV >= facadeSpan - CASTLE_WALL_THICKNESS_BLOCKS &&
            openingAt(CASTLE_BOUNDARY.RIGHT, blockU, blockY);
          if (
            blockU >= facadeInset &&
            blockU < wallDepth &&
            !openingAt(CASTLE_BOUNDARY.FRONT, blockV, blockY) &&
            !crossesLeftGate &&
            !crossesRightGate
          ) {
            addBlock(blockU, blockY, blockV, role);
          }
          if (
            hasLeftWing &&
            blockU < castleDepth &&
            blockV < towerSpan &&
            !openingAt(CASTLE_BOUNDARY.LEFT, blockU, blockY)
          ) {
            addBlock(blockU, blockY, blockV, role);
          }
          if (
            hasRightWing &&
            blockU < castleDepth &&
            blockV >= facadeSpan - towerSpan &&
            !openingAt(CASTLE_BOUNDARY.RIGHT, blockU, blockY)
          ) {
            addBlock(blockU, blockY, blockV, role);
          }
        }

        const isEdge =
          (blockU >= facadeInset &&
            blockU < facadeInset + CASTLE_WALL_THICKNESS_BLOCKS) ||
          (blockU >= wallDepth - CASTLE_WALL_THICKNESS_BLOCKS &&
            blockU < wallDepth) ||
          (hasLeftWing &&
            (blockV < CASTLE_WALL_THICKNESS_BLOCKS ||
              (blockV >= towerSpan - CASTLE_WALL_THICKNESS_BLOCKS &&
                blockV < towerSpan))) ||
          (hasRightWing &&
            (blockV >= facadeSpan - CASTLE_WALL_THICKNESS_BLOCKS ||
              (blockV >= facadeSpan - towerSpan &&
                blockV <
                  facadeSpan - towerSpan + CASTLE_WALL_THICKNESS_BLOCKS)));
        if (isEdge && (blockU + blockV) % battlementPeriod === 0) {
          addBlock(blockU, wallHeight, blockV, "trim");
        }
      }
    }
  }

  #buildCastleAudienceWing(
    addBlock,
    opening,
    castleDepth,
    facadeSpan,
    towerSpan,
    wallHeight,
    battlementPeriod,
  ) {
    const roomCenter = (opening.start + opening.end) / 2;
    const roomStart = Math.max(
      CASTLE_WALL_THICKNESS_BLOCKS,
      Math.floor(roomCenter - facadeSpan / 2) +
        CASTLE_AUDIENCE_ROOM_SIDE_INSET_BLOCKS,
    );
    const roomEnd = Math.min(
      facadeSpan - CASTLE_WALL_THICKNESS_BLOCKS,
      Math.ceil(roomCenter + facadeSpan / 2) -
        CASTLE_AUDIENCE_ROOM_SIDE_INSET_BLOCKS,
    );
    const sideWallStarts = [roomStart, roomEnd - CASTLE_WALL_THICKNESS_BLOCKS];
    const openingCenter = roomCenter * CASTLE_BLOCK_SIZE;
    const interiorStart =
      (roomStart + CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
    const interiorEnd =
      (roomEnd - CASTLE_WALL_THICKNESS_BLOCKS) * CASTLE_BLOCK_SIZE;
    const interiorWidth =
      Math.min(openingCenter - interiorStart, interiorEnd - openingCenter) * 2;
    const gatehouseDepth = Math.min(towerSpan, castleDepth);
    const roofDoorWidth = 4;
    const roofDoorStart = Math.floor(
      (opening.start + opening.end - roofDoorWidth) / 2,
    );
    const stairwellStart = Math.max(0, gatehouseDepth - 5);
    const isStairwellOpening = (blockU, blockV) =>
      blockU >= stairwellStart &&
      blockU < gatehouseDepth &&
      blockV >= roofDoorStart &&
      blockV < roofDoorStart + roofDoorWidth;

    for (const wallV of sideWallStarts) {
      for (let blockU = 0; blockU < castleDepth; blockU += 1) {
        for (
          let offsetV = 0;
          offsetV < CASTLE_WALL_THICKNESS_BLOCKS;
          offsetV += 1
        ) {
          for (let blockY = 0; blockY < wallHeight; blockY += 1) {
            const role =
              blockY === 2 || blockY === wallHeight - 3 ? "trim" : "stone";
            addBlock(blockU, blockY, wallV + offsetV, role);
          }
          if (blockU % battlementPeriod === 0) {
            addBlock(blockU, wallHeight, wallV + offsetV, "trim");
          }
        }
      }
    }

    for (
      let blockU = castleDepth - CASTLE_WALL_THICKNESS_BLOCKS;
      blockU < castleDepth;
      blockU += 1
    ) {
      for (let blockV = roomStart; blockV < roomEnd; blockV += 1) {
        for (let blockY = 0; blockY < wallHeight; blockY += 1) {
          const role =
            blockY === 2 || blockY === wallHeight - 3 ? "trim" : "stone";
          addBlock(blockU, blockY, blockV, role);
        }
        if ((blockV - roomStart) % battlementPeriod === 0) {
          addBlock(blockU, wallHeight, blockV, "trim");
        }
      }
    }

    this.#buildCastleAudienceRoof(
      addBlock,
      roomStart,
      roomEnd,
      castleDepth,
      wallHeight,
      battlementPeriod,
      isStairwellOpening,
    );
    return interiorWidth;
  }

  #buildCastleAudienceRoof(
    addBlock,
    roomStart,
    roomEnd,
    castleDepth,
    wallHeight,
    battlementPeriod,
    isStairwellOpening,
  ) {
    for (let blockU = 0; blockU < castleDepth; blockU += 1) {
      for (let blockV = roomStart; blockV < roomEnd; blockV += 1) {
        if (isStairwellOpening(blockU, blockV)) {
          continue;
        }
        const isEdge =
          blockU === 0 ||
          blockU === castleDepth - 1 ||
          blockV === roomStart ||
          blockV === roomEnd - 1;
        addBlock(blockU, wallHeight, blockV, isEdge ? "trim" : "stone");
        if (isEdge && (blockU + blockV) % battlementPeriod === 0) {
          addBlock(blockU, wallHeight + 1, blockV, "trim");
        }
      }
    }
  }

  #buildCastleTower(
    addBlock,
    startU,
    startV,
    spanU,
    spanV,
    baseBlockY,
    bodyHeight,
    battlementPeriod,
  ) {
    for (
      let blockY = baseBlockY;
      blockY < baseBlockY + bodyHeight;
      blockY += 1
    ) {
      const topInset =
        blockY >= baseBlockY + bodyHeight - 4 && spanU >= 7 && spanV >= 7
          ? 1
          : 0;
      for (let localU = topInset; localU < spanU - topInset; localU += 1) {
        for (let localV = topInset; localV < spanV - topInset; localV += 1) {
          const rearWindowCourse =
            blockY >= baseBlockY + 6 && blockY <= baseBlockY + 7;
          const rearWindowColumn = localV === Math.floor(spanV / 2);
          const rearWindowTunnel =
            rearWindowCourse && rearWindowColumn && localU >= spanU - 2;
          if (rearWindowTunnel) continue;
          const rearWindowInterior =
            rearWindowCourse && rearWindowColumn && localU === spanU - 3;
          const isShell =
            localU === topInset ||
            localU === spanU - 1 - topInset ||
            localV === topInset ||
            localV === spanV - 1 - topInset ||
            blockY === baseBlockY + bodyHeight - 1 ||
            rearWindowInterior;
          if (isShell) {
            const isTrimCourse =
              blockY === baseBlockY + 2 ||
              blockY === baseBlockY + bodyHeight - 5;
            addBlock(
              startU + localU,
              blockY,
              startV + localV,
              rearWindowInterior ? "iron" : isTrimCourse ? "trim" : "stone",
            );
          }
        }
      }
    }

    const crownInset = spanU >= 7 && spanV >= 7 ? 1 : 0;
    for (let localU = crownInset; localU < spanU - crownInset; localU += 1) {
      for (let localV = crownInset; localV < spanV - crownInset; localV += 1) {
        const isEdge =
          localU === crownInset ||
          localU === spanU - 1 - crownInset ||
          localV === crownInset ||
          localV === spanV - 1 - crownInset;
        if (isEdge && (localU + localV) % battlementPeriod === 0) {
          addBlock(
            startU + localU,
            baseBlockY + bodyHeight,
            startV + localV,
            "trim",
          );
        }
      }
    }
  }

  #buildCastleGatehouse(
    addBlock,
    addLocalBox,
    addFlame,
    addBanner,
    addFlag,
    addRoof,
    opening,
    castleDepth,
    facadeSpan,
    towerSpan,
    towerHeight,
    battlementPeriod,
    primaryStyle,
  ) {
    const pylonSpan = CASTLE_GATE_PYLON_SPAN_BLOCKS;
    const gatehouseDepth = Math.min(towerSpan, castleDepth);
    const gatehouseHeight = towerHeight;
    const gateFaceDepth = Math.min(1, gatehouseDepth - 1);
    const roofDoorWidth = 4;
    const roofDoorHeight = 5;
    const roofDoorStart = Math.floor(
      (opening.start + opening.end - roofDoorWidth) / 2,
    );
    const roofDoorBase =
      (primaryStyle?.wallHeightBlocks ?? CASTLE_WALL_HEIGHT_BLOCKS) + 1;
    const isRoofDoorOpening = (depth, horizontal, blockY) =>
      Boolean(primaryStyle) &&
      depth >= gateFaceDepth &&
      depth < gatehouseDepth &&
      horizontal >= roofDoorStart &&
      horizontal < roofDoorStart + roofDoorWidth &&
      blockY >= roofDoorBase &&
      blockY < roofDoorBase + roofDoorHeight;
    const placeBoundaryBlock = (depth, horizontal, blockY, role) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addBlock(castleDepth - 1 - depth, blockY, horizontal, role);
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addBlock(horizontal, blockY, depth, role);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addBlock(horizontal, blockY, facadeSpan - 1 - depth, role);
      } else {
        addBlock(depth, blockY, horizontal, role);
      }
    };
    const placeBoundaryDecoration = (
      depth,
      horizontal,
      blockY,
      scaleDepth,
      scaleY,
      scaleHorizontal,
      role,
    ) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addLocalBox(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          scaleDepth,
          scaleY,
          scaleHorizontal,
          role,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addLocalBox(
          horizontal,
          blockY,
          depth,
          scaleHorizontal,
          scaleY,
          scaleDepth,
          role,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addLocalBox(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          scaleHorizontal,
          scaleY,
          scaleDepth,
          role,
        );
      } else {
        addLocalBox(
          depth,
          blockY,
          horizontal,
          scaleDepth,
          scaleY,
          scaleHorizontal,
          role,
        );
      }
    };
    const placeBoundaryFlame = (depth, horizontal, blockY, scale = 1) => {
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (horizontal < 0 || horizontal >= horizontalLimit) {
        return;
      }
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addFlame(castleDepth - 1 - depth, blockY, horizontal, scale);
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addFlame(horizontal, blockY, depth, scale);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addFlame(horizontal, blockY, facadeSpan - 1 - depth, scale);
      } else {
        addFlame(depth, blockY, horizontal, scale);
      }
    };
    const placeBoundaryRoofFireTurret = (
      centerDepth,
      centerHorizontal,
      baseBlockY,
    ) => {
      const turretDepth = Math.round(centerDepth);
      const turretHorizontal = Math.round(centerHorizontal);
      const turretHeight = 3;
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (
        turretDepth - 1 < 0 ||
        turretDepth + 1 >= gatehouseDepth ||
        turretHorizontal - 1 < 0 ||
        turretHorizontal + 1 >= horizontalLimit
      ) {
        return;
      }

      for (
        let blockY = baseBlockY;
        blockY < baseBlockY + turretHeight;
        blockY += 1
      ) {
        for (let depthOffset = -1; depthOffset <= 1; depthOffset += 1) {
          for (
            let horizontalOffset = -1;
            horizontalOffset <= 1;
            horizontalOffset += 1
          ) {
            const topCourse = blockY === baseBlockY + turretHeight - 1;
            const edge =
              Math.abs(depthOffset) === 1 || Math.abs(horizontalOffset) === 1;
            placeBoundaryBlock(
              turretDepth + depthOffset,
              turretHorizontal + horizontalOffset,
              blockY,
              topCourse && edge ? "trim" : "stone",
            );
          }
        }
      }
      for (const [depthOffset, horizontalOffset] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [0, 0],
      ]) {
        placeBoundaryBlock(
          turretDepth + depthOffset,
          turretHorizontal + horizontalOffset,
          baseBlockY + turretHeight,
          "trim",
        );
      }
      placeBoundaryFlame(
        turretDepth,
        turretHorizontal,
        baseBlockY + turretHeight + 1,
        1.05,
      );
    };
    const placeBoundaryBanner = (depth, horizontal, blockY, width, height) => {
      const horizontalLimit = [
        CASTLE_BOUNDARY.FRONT,
        CASTLE_BOUNDARY.BACK,
      ].includes(opening.boundary)
        ? facadeSpan
        : castleDepth;
      if (horizontal < 0 || horizontal >= horizontalLimit) {
        return;
      }
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addBanner(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          width,
          height,
          opening.boundary,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addBanner(horizontal, blockY, depth, width, height, opening.boundary);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addBanner(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          width,
          height,
          opening.boundary,
        );
      } else {
        addBanner(depth, blockY, horizontal, width, height, opening.boundary);
      }
    };
    const placeBoundaryFlag = (depth, horizontal, blockY) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addFlag(castleDepth - 1 - depth, blockY, horizontal, opening.boundary);
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addFlag(horizontal, blockY, depth, opening.boundary);
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addFlag(horizontal, blockY, facadeSpan - 1 - depth, opening.boundary);
      } else {
        addFlag(depth, blockY, horizontal, opening.boundary);
      }
    };
    const placeBoundaryRoof = (
      depth,
      horizontal,
      blockY,
      width,
      roofDepth,
      height,
    ) => {
      if (opening.boundary === CASTLE_BOUNDARY.BACK) {
        addRoof(
          castleDepth - 1 - depth,
          blockY,
          horizontal,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.LEFT) {
        addRoof(
          horizontal,
          blockY,
          depth,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      } else if (opening.boundary === CASTLE_BOUNDARY.RIGHT) {
        addRoof(
          horizontal,
          blockY,
          facadeSpan - 1 - depth,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      } else {
        addRoof(
          depth,
          blockY,
          horizontal,
          width,
          roofDepth,
          height,
          opening.boundary,
        );
      }
    };
    const pylonRanges = [
      [opening.start - pylonSpan, opening.start - 1],
      [opening.end, opening.end + pylonSpan - 1],
    ];

    for (const [rangeStart, rangeEnd] of pylonRanges) {
      for (
        let horizontal = rangeStart;
        horizontal <= rangeEnd;
        horizontal += 1
      ) {
        for (let depth = 0; depth < gatehouseDepth; depth += 1) {
          for (let blockY = 0; blockY < gatehouseHeight; blockY += 1) {
            const topInset = blockY >= gatehouseHeight - 3 ? 1 : 0;
            const horizontalLimit = [
              CASTLE_BOUNDARY.FRONT,
              CASTLE_BOUNDARY.BACK,
            ].includes(opening.boundary)
              ? facadeSpan
              : castleDepth;
            const withinSteppedCrown =
              horizontal >= rangeStart + topInset &&
              horizontal <= rangeEnd - topInset &&
              depth >= topInset &&
              depth < gatehouseDepth - topInset;
            if (
              horizontal >= 0 &&
              horizontal < horizontalLimit &&
              withinSteppedCrown
            ) {
              const framesGate =
                depth === 0 &&
                (horizontal === opening.start - 1 ||
                  horizontal === opening.end);
              const isTrimCourse =
                blockY === 2 ||
                blockY === gatehouseHeight - 4 ||
                (framesGate && blockY < CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4);
              placeBoundaryBlock(
                depth,
                horizontal,
                blockY,
                isTrimCourse ? "trim" : "stone",
              );
            }
          }
        }
      }
    }

    for (const [rangeStart, rangeEnd] of pylonRanges) {
      for (
        let horizontal = rangeStart + 1;
        horizontal <= rangeEnd - 1;
        horizontal += 1
      ) {
        if ((horizontal - rangeStart) % battlementPeriod === 0) {
          placeBoundaryBlock(1, horizontal, gatehouseHeight, "trim");
          placeBoundaryBlock(
            gatehouseDepth - 2,
            horizontal,
            gatehouseHeight,
            "trim",
          );
        }
      }
      for (let depth = 2; depth < gatehouseDepth - 2; depth += 1) {
        if (depth % battlementPeriod === 0) {
          placeBoundaryBlock(depth, rangeStart + 1, gatehouseHeight, "trim");
          placeBoundaryBlock(depth, rangeEnd - 1, gatehouseHeight, "trim");
        }
      }
    }

    for (const [rangeStart, rangeEnd] of pylonRanges) {
      const center = (rangeStart + rangeEnd) / 2;
      for (const ledgeHeight of [2, gatehouseHeight - 4]) {
        placeBoundaryDecoration(
          -0.58,
          center,
          ledgeHeight,
          0.32,
          0.62,
          pylonSpan + 0.7,
          "trim",
        );
      }
    }

    for (
      let horizontal = opening.start;
      horizontal < opening.end;
      horizontal += 1
    ) {
      for (let depth = 0; depth < CASTLE_WALL_THICKNESS_BLOCKS; depth += 1) {
        for (
          let blockY = CASTLE_GATE_OPENING_HEIGHT_BLOCKS;
          blockY < CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4;
          blockY += 1
        ) {
          placeBoundaryBlock(depth, horizontal, blockY, "accent");
          if (depth === 0 && !isRoofDoorOpening(gatehouseDepth - 1, horizontal, blockY)) {
            placeBoundaryBlock(
              gatehouseDepth - 1,
              horizontal,
              blockY,
              "accent",
            );
          }
        }
      }
    }

    for (
      let horizontal = opening.start;
      horizontal < opening.end;
      horizontal += 1
    ) {
      for (let depth = gateFaceDepth; depth < gatehouseDepth; depth += 1) {
        for (
          let blockY = CASTLE_GATE_OPENING_HEIGHT_BLOCKS;
          blockY < gatehouseHeight;
          blockY += 1
        ) {
          if (isRoofDoorOpening(depth, horizontal, blockY)) continue;
          placeBoundaryBlock(depth, horizontal, blockY);
        }
      }
    }

    const towerCenters = [
      opening.start - pylonSpan / 2,
      opening.end + pylonSpan / 2 - 1,
    ];
    for (const horizontal of towerCenters) {
      placeBoundaryBanner(-0.76, horizontal, gatehouseHeight - 7, 2.5, 4.5);
      if (!primaryStyle) {
        placeBoundaryRoofFireTurret(
          (gatehouseDepth - 1) / 2,
          horizontal,
          gatehouseHeight,
        );
      }
    }

    const torchHeight = Math.min(7, gatehouseHeight - 5);
    for (const horizontal of [opening.start - 2, opening.end + 1]) {
      if (horizontal < 0) continue;
      placeBoundaryDecoration(
        -0.55,
        horizontal,
        torchHeight - 0.5,
        0.45,
        0.5,
        0.45,
        "iron",
      );
      placeBoundaryFlame(-0.62, horizontal, torchHeight, 0.72);
    }

    const horizontalLimit = [
      CASTLE_BOUNDARY.FRONT,
      CASTLE_BOUNDARY.BACK,
    ].includes(opening.boundary)
      ? facadeSpan
      : castleDepth;

    if (!primaryStyle) {
      return;
    }

    const crownShoulder = primaryStyle.gateShoulderSpanBlocks ?? 3;
    const crownHeight = Math.max(
      gatehouseHeight + 2,
      primaryStyle.gateCrownHeightBlocks ?? CASTLE_GATE_CROWN_HEIGHT_BLOCKS,
    );
    const crownBase = CASTLE_GATE_OPENING_HEIGHT_BLOCKS + 4;
    const crownDepth = Math.min(gatehouseDepth, castleDepth);
    const crownStart = Math.max(0, opening.start - crownShoulder);
    const crownEnd = Math.min(
      horizontalLimit - 1,
      opening.end + crownShoulder - 1,
    );

    for (let blockY = crownBase; blockY < crownHeight; blockY += 1) {
      const topInset = blockY >= crownHeight - 3 ? 1 : 0;
      for (
        let horizontal = crownStart + topInset;
        horizontal <= crownEnd - topInset;
        horizontal += 1
      ) {
        for (let depth = 0; depth < crownDepth; depth += 1) {
          const isShell =
            horizontal === crownStart + topInset ||
            horizontal === crownEnd - topInset ||
            depth === 0 ||
            depth === crownDepth - 1 ||
            blockY === crownBase ||
            blockY === crownHeight - 1;
          if (isShell && !isRoofDoorOpening(depth, horizontal, blockY)) {
            const isCrownEdge =
              horizontal === crownStart + topInset ||
              horizontal === crownEnd - topInset ||
              depth === 0 ||
              depth === crownDepth - 1;
            const isTrimCourse =
              blockY === crownBase ||
              (blockY === crownHeight - 1 && isCrownEdge);
            placeBoundaryBlock(
              depth,
              horizontal,
              blockY,
              isTrimCourse ? "trim" : "stone",
            );
          }
        }
      }
    }

    const crownCenter = Math.round((crownStart + crownEnd) / 2);
    const roofRadius = Math.min(
      2,
      Math.floor((crownDepth - 1) / 2),
      Math.floor((crownEnd - crownStart) / 2),
    );
    const roofDepthCenter = Math.max(
      roofRadius,
      Math.min(crownDepth - 1 - roofRadius, Math.round((crownDepth - 1) / 2)),
    );
    const roofHorizontalCenter = Math.max(
      crownStart + roofRadius,
      Math.min(crownEnd - roofRadius, crownCenter),
    );
    const roofTowerHeight = 5;
    const roofDepthStart = roofDepthCenter - roofRadius;
    const roofDepthEnd = roofDepthCenter + roofRadius;
    const roofHorizontalStart = roofHorizontalCenter - roofRadius;
    const roofHorizontalEnd = roofHorizontalCenter + roofRadius;
    for (
      let blockY = crownHeight;
      blockY < crownHeight + roofTowerHeight;
      blockY += 1
    ) {
      for (let depth = roofDepthStart; depth <= roofDepthEnd; depth += 1) {
        for (
          let horizontal = roofHorizontalStart;
          horizontal <= roofHorizontalEnd;
          horizontal += 1
        ) {
          const windowCourse =
            blockY >= crownHeight + 2 && blockY <= crownHeight + 3;
          const frontWindowTunnel =
            horizontal === roofHorizontalCenter && depth <= roofDepthStart + 1;
          const backWindowTunnel =
            horizontal === roofHorizontalCenter && depth >= roofDepthEnd - 1;
          const leftWindowTunnel =
            depth === roofDepthCenter && horizontal <= roofHorizontalStart + 1;
          const rightWindowTunnel =
            depth === roofDepthCenter && horizontal >= roofHorizontalEnd - 1;
          if (
            windowCourse &&
            (frontWindowTunnel ||
              backWindowTunnel ||
              leftWindowTunnel ||
              rightWindowTunnel)
          ) {
            continue;
          }
          const topCourse = blockY === crownHeight + roofTowerHeight - 1;
          const edge =
            depth === roofDepthStart ||
            depth === roofDepthEnd ||
            horizontal === roofHorizontalStart ||
            horizontal === roofHorizontalEnd;
          const windowInterior =
            windowCourse &&
            depth === roofDepthCenter &&
            horizontal === roofHorizontalCenter;
          placeBoundaryBlock(
            depth,
            horizontal,
            blockY,
            windowInterior ? "iron" : topCourse && edge ? "trim" : "stone",
          );
        }
      }
    }
    const roofSpan = roofRadius * 2 + 1;
    const roofHeight = Math.max(2.5, roofSpan * 0.68);
    const roofBaseBlockY = crownHeight + roofTowerHeight;
    placeBoundaryRoof(
      roofDepthCenter,
      roofHorizontalCenter,
      roofBaseBlockY,
      roofSpan + 0.6,
      roofSpan + 0.6,
      roofHeight,
    );

    for (
      let horizontal = crownStart + 1;
      horizontal < crownEnd;
      horizontal += 1
    ) {
      if ((horizontal - crownStart) % battlementPeriod === 0) {
        placeBoundaryBlock(0, horizontal, crownHeight, "trim");
        placeBoundaryBlock(crownDepth - 1, horizontal, crownHeight, "trim");
      }
    }
    for (let depth = 1; depth < crownDepth - 1; depth += 1) {
      if (depth % battlementPeriod === 0) {
        placeBoundaryBlock(depth, crownStart + 1, crownHeight, "trim");
        placeBoundaryBlock(depth, crownEnd - 1, crownHeight, "trim");
      }
    }

    placeBoundaryFlag(
      roofDepthCenter,
      roofHorizontalCenter,
      roofBaseBlockY + roofHeight - 1,
    );
  }
}
