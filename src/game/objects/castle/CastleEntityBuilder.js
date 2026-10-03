import { createCastleMasonryVoxels } from "./CastleMasonryPhysics.js";
import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";
import stoneBlockUrl from "../../models/castle/residential/masonry-block.glb?url";
import { DynamicRenderBatch } from "../../rendering/DynamicRenderBatch.js";
import { CastleBanner } from "./CastleBanner.js";
import { CastleAudienceRoom } from "./CastleAudienceRoom.js";
import { CastleDoor } from "./CastleDoor.js";
import { CastleDoorArch } from "./CastleDoorArch.js";
import { CastleFire } from "./CastleFire.js";
import { CastleRoof } from "./CastleRoof.js";
import { CastleStairs } from "./CastleStairs.js";
import { CastleResidence } from "./CastleResidence.js";
import { CastleWindowLayout } from "./CastleWindowLayout.js";
import { Window } from "../window/Window.js";
import { colorFromHex } from "../../helpers/colors.js";
import {
  CASTLE_BLOCK_SIZE,
  CASTLE_MATERIAL_DEFINITIONS,
  CASTLE_WALL_THICKNESS_BLOCKS,
} from "../../generator/castle/CastleGenerationConfig.js";

/**
 * @typedef {object} CastleTerraceContext
 * @property {typeof import("playcanvas")} pc
 * @property {import("src/game/models/GameModelLibrary.js").GameModelLibrary} modelLibrary
 * @property {import("playcanvas").Material} wallMaterial
 * @property {import("playcanvas").Material} woodMaterial
 * @property {{x: number, y: number, z: number}} position
 * @property {Array<{side: string, offset: number, width: number, approachElevation?: number}>} doors
 * @property {{x: number, y: number, z: number, yaw: number, depth: number, width: number}} layout
 * @property {(atThrone: boolean) => void} onRoyalAtThroneChange
 */

/**
 * @typedef {Parameters<CastleBanner["beginWindGesture"]>[0]} CastleWindHit
 */

export class CastleEntityBuilder {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      stoneBlockUrl,
      CastleRoof.modelUrl,
      ...CastleFire.modelUrls,
      ...CastleBanner.modelUrls,
      ...CastleDoor.modelUrls,
      CastleDoorArch.modelUrl,
      CastleStairs.modelUrl,
      ...CastleAudienceRoom.modelUrls,
      ...CastleResidence.modelUrls,
      ...Window.modelUrls,
    ];
  }

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
   * @type {DynamicRenderBatch|null}
   */
  #renderBatch = null;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {Array<{side: string, offset: number, width: number, approachElevation?: number}>}
   */
  #doors;
  /**
   *
    * @type {import("src/game/generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan}
   */
  #buildPlan;
  /**
   *
    * @type {import("src/game/models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
    * @type {import("playcanvas").Texture}
   */
  #fireParticleTexture;

  /**
   * @type {import("playcanvas").Texture}
   */
  #carpetTexture;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {Map<string, import("playcanvas").StandardMaterial>}
   */
  #materials = new Map();
  /**
   *
    * @type {import("playcanvas").Texture|null}
   */
  #stoneTexture = null;
  /**
   *
    * @type {import("playcanvas").Texture|null}
   */
  #doorTexture = null;
  /**
   *
    * @type {Array<import("playcanvas").VertexBuffer>}
   */
  #vertexBuffers = [];
  /**
   *
    * @type {CastleFire|null}
   */
  #fire = null;
  /**
   *
    * @type {CastleBanner|null}
   */
  #banners = null;
  /**
   *
    * @type {CastleBanner|null}
   */
  #activeWindTarget = null;
  /**
   *
    * @type {CastleRoof|null}
   */
  #roofs = null;
  /**
   *
    * @type {CastleStairs|null}
   */
  #stairs = null;
  /**
   * @type {CastleStairs|null}
   */
  #serviceStairs = null;
  /**
   *
    * @type {CastleAudienceRoom|null}
   */
  #audienceRoom = null;
  /**
   *
    * @type {import("./CastleTerraceActivity.js").CastleTerraceActivity|null}
   */
  #terraceActivity = null;
  /**
   *
    * @type {CastleTerraceContext|null}
   */
  #terraceContext = null;
  /**
   *
    * @type {import("../royal/AbstractRoyal.js").AbstractRoyal|null}
   */
  #royal = null;
  /**
   *
    * @type {import("../servant/Servant.js").Servant|null}
   */
  #servant = null;
  /**
   *
    * @type {Array<{x: number, z: number}>}
   */
  #groundCollisionColumns = [];
  /**
   *
    * @type {Array<{x: number, y: number, z: number, halfX: number, halfY: number, halfZ: number}>}
   */
  #cameraCollisionBlocks = [];
  /**
   *
    * @type {Array<CastleDoor>}
   */
  #animatedDoors = [];
  /**
   *
    * @type {Array<CastleDoorArch>}
   */
  #doorArches = [];
  /**
   *
    * @type {{off: () => void}|null}
   */
  #updateHandle = null;
  /**
   *
    * @type {((error: Error) => void)|null}
   */
  #onRuntimeError;
  /**
   *
    * @type {boolean}
   */
  #updateFailed = false;
  /**
   *
    * @type {number}
   */
  #interiorDepth = 0;
  /**
   *
    * @type {number}
   */
  #interiorWidth = 0;

  /**
   * @type {CastleResidence|null}
   */
  #residence = null;
  /**
   * @type {number}
   */
  #heroElevation = 0;
  /**
   * @type {boolean}
   */
  #residentsConnected = false;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, buildPlan: import("src/game/generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, doorTexture: import("playcanvas").Texture, stoneTexture: import("playcanvas").Texture, fireParticleTexture: import("playcanvas").Texture, carpetTexture: import("playcanvas").Texture, onRuntimeError: ((error: Error) => void)|null}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan} options.buildPlan
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("playcanvas").Texture} options.doorTexture
   * @param {import("playcanvas").Texture} options.stoneTexture
   * @param {import("playcanvas").Texture|null} options.gardenTexture
   * @param {import("playcanvas").Texture} options.carpetTexture
   * @param {import("playcanvas").Texture} options.fireParticleTexture
   * @param {((error: Error) => void)|null} options.onRuntimeError
   */
  constructor({
    pc,
    app,
    buildPlan,
    modelLibrary,
    doorTexture,
    stoneTexture,
    fireParticleTexture,
    carpetTexture,
    gardenTexture = null,
    onRuntimeError = null,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#buildPlan = buildPlan;
    this.#position = buildPlan.input.position;
    this.#doors = buildPlan.input.doors;
    this.#modelLibrary = modelLibrary;
    this.#doorTexture = doorTexture;
    this.#stoneTexture = stoneTexture;
    this.#fireParticleTexture = fireParticleTexture;
    this.#carpetTexture = carpetTexture;
    this.#onRuntimeError = onRuntimeError;
    this.#entity = new pc.Entity("Castle");

    try {
      this.#createStructureResources();
      this.#createDecorations();
      this.#createStairs();
      this.#render();
      if (!buildPlan.layout.empty && buildPlan.metadata.runtime.residential) {
        this.#residence = new CastleResidence({ pc, buildPlan, modelLibrary, gardenTexture });
        this.#entity.addChild(this.#residence.entity);
      }
      this.#createAudienceRoom();
      this.#heroElevation = this.#position.elevation ?? 0;
      this.#updateHandle = app.on("update", this.#update);
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @param {import("../royal/AbstractRoyal.js").AbstractRoyal} royal
   */
  attachRoyal(royal) {
    this.#royal = royal;
    if (this.#audienceRoom) {
      this.#audienceRoom.occupant = royal.audienceActor;
    }
    this.#connectResidents();
  }

  /**
   *
   * @param {import("../servant/Servant.js").Servant} servant
   */
  attachServant(servant) {
    this.#servant = servant;
    if (this.#residence) {
      this.#residence.servant = servant;
      servant.bindResidence({ pc: this.#pc, modelLibrary: this.#modelLibrary, residence: this.#residence });
    }
    this.#connectResidents();
  }

  /**
   * @returns {CastleResidence|null}
   */
  get residence() { return this.#residence; }

  /**
   *
    * @returns {number}
   */
  get royalActivityState() {
    return this.#terraceActivity?.state ?? null;
  }

  /**
   *
   * @param {boolean} triggered
   */
  setRoyalActivityTriggered(triggered) {
    this.#terraceActivity?.setTriggered(triggered);
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   */
  isRoyalActivityTriggerAt(position) {
    return this.#terraceActivity?.isTriggerAt(position) ?? false;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  intersectsGroundFootprint(x, z, radius = 0) {
    if (this.#audienceRoom?.intersectsFootprint(x, z, radius)) {
      return true;
    }
    if (
      this.#animatedDoors.some(/**
       *
       * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
       */
      (door) => door.intersectsFootprint(x, z, radius))
    ) {
      return true;
    }
    return this.#intersectsGroundColumns(x, z, radius);
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} elevation
   * @param {number} stepClearance
   */
  blocksMovementAt(x, z, radius = 0, elevation = -Infinity, stepClearance = 0) {
    if (this.residence?.blocksMovementAt(x, z, radius, elevation)) {
      return true;
    }
    if (this.residence && Number.isFinite(elevation)) {
      // Navigation queries use the authored engine collider dimensions at the
      // actor's current level; ground columns cannot describe multiple floors.
      return this.#animatedDoors.some(/**
       * @param {CastleDoor} door
       */ (door) => door.blocksCameraAt(x, elevation + 0.4, z, radius)) ||
        this.#cameraCollisionBlocks.some(/**
         * @param {{x: number, y: number, z: number, halfX: number, halfY: number, halfZ: number}} block
         */ (block) => {
          if (block.y + block.halfY <= elevation + Math.max(0.02, stepClearance) + 0.000001 || block.y - block.halfY >= elevation + 0.8) {
            return false;
          }
          const dx = Math.max(Math.abs(x - block.x) - block.halfX, 0);
          const dz = Math.max(Math.abs(z - block.z) - block.halfZ, 0);
          return dx * dx + dz * dz <= radius * radius;
        });
    }
    // The room floor supports walking; it must not cancel its solid furniture,
    // walls, or closed doors when the collision world queries this aggregate.
    if (this.intersectsGroundFootprint(x, z, radius)) {
      return true;
    }
    return Boolean(this.#stairs?.blocksMovementAt(x, z, radius, elevation, stepClearance) ||
      this.#serviceStairs?.blocksMovementAt(x, z, radius, elevation, stepClearance));
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
    if (this.#residence?.blocksCameraAt(x, y, z, radius)) {
      return true;
    }
    if (
      this.#animatedDoors.some(/**
       *
       * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
       */
      (door) =>
        door.blocksCameraAt(x, y, z, radius),
      ) ||
      this.#terraceActivity?.blocksCameraAt(x, y, z, radius)
    ) {
      return true;
    }
    return this.#cameraCollisionBlocks.some(/**
     *
     * @param {{x: number, y: number, z: number, halfX: number, halfY: number, halfZ: number}} block
     */
    (block) => {
      const distanceX = Math.max(Math.abs(x - block.x) - block.halfX, 0);
      const distanceY = Math.max(Math.abs(y - block.y) - block.halfY, 0);
      const distanceZ = Math.max(Math.abs(z - block.z) - block.halfZ, 0);
      return (
        distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ <=
        radius * radius
      );
    });
  }

  /**
   * Spiral treads use Ammo contact support rather than the flat-floor boot-edge guard.
   * @param {number} x
   * @param {number} z
   * @returns {number|null}
   */
  physicsSurfaceHeightAt(x, z) {
    // Planned room floors and masonry have their own engine bodies. Sampling them
    // into the terrain would freeze an extra floor at the hero's current storey.
    if (this.#buildPlan.metadata.runtime.residential?.version === 2) {
      return this.#stairs?.surfaceHeightAt(x, z) ?? this.#serviceStairs?.surfaceHeightAt(x, z) ?? null;
    }
    if (this.#residence?.layout.stairSurfaceHeightAt(x, z, this.#heroElevation) != null) { return null; }
    return this.surfaceHeightAt(x, z);
  }

  /**
   * @param {number} x
   * @param {number} z
   */
  surfaceHeightAt(x, z) {
    return (
      this.#residence?.surfaceHeightAt(x, z, this.#heroElevation) ??
      this.#stairs?.surfaceHeightAt(x, z) ??
      this.#serviceStairs?.surfaceHeightAt(x, z) ??
      this.#audienceRoom?.surfaceHeightAt(x, z) ??
      null
    );
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   */
  updateHeroPosition(position) {
    this.#heroElevation = position.y;
    for (const door of this.#animatedDoors) {
      door.updateHeroPosition(position);
    }
    this.#syncAudienceRoomVisibility();
    this.#audienceRoom?.updateHeroPosition(position);
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getBannerHit(rayStart, rayEnd) {
    return this.#banners?.getBannerHit(rayStart, rayEnd) ?? null;
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    const bannerHit = this.getBannerHit(rayStart, rayEnd);
    const pointerBannerHit = bannerHit
      ? { ...bannerHit, pointerTarget: this }
      : null;
    const doorHit = this.#getDoorHit(rayStart, rayEnd);
    if (!pointerBannerHit) {
      return doorHit;
    }
    if (!doorHit) {
      return pointerBannerHit;
    }
    return doorHit.distance < pointerBannerHit.distance
      ? doorHit
      : pointerBannerHit;
  }

  /**
   *
   * @param {CastleWindHit} hit
   */
  beginWindGesture(hit) {
    this.#activeWindTarget = this.#banners;
    this.#activeWindTarget?.beginWindGesture(hit);
  }

  /**
   *
   * @param {{hit: CastleWindHit}} options
   * @param {CastleWindHit} options.hit
   */
  handlePointerDown({ hit }) {
    this.beginWindGesture(hit);
    return { capturePointer: true };
  }

  /**
   *
   * @param {{ray: number, deltaTime: number}} options
   * @param {number} options.ray
   * @param {number} options.deltaTime
   */
  handlePointerMove({ ray, deltaTime }) {
    this.applyMouseWind(ray.start, ray.end, deltaTime);
    return true;
  }

  handlePointerUp() {
    this.endWindGesture();
    return true;
  }

  handlePointerCancel() {
    this.endWindGesture();
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   * @param {number} deltaTime
   */
  applyMouseWind(rayStart, rayEnd, deltaTime) {
    this.#activeWindTarget?.applyMouseWind(rayStart, rayEnd, deltaTime);
  }

  endWindGesture() {
    this.#activeWindTarget?.endWindGesture();
    this.#activeWindTarget = null;
  }

  onSceneReady() {
    this.#renderBatch ??= new DynamicRenderBatch(
      this.#app,
      this.#entity,
      this.#pc.BUFFER_STATIC,
    );
  }

  destroy() {
    this.#renderBatch?.destroy();
    this.#renderBatch = null;
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.endWindGesture();
    for (const door of this.#animatedDoors) door.destroy();
    this.#animatedDoors = [];
    for (const arch of this.#doorArches) arch.destroy();
    this.#doorArches = [];
    this.#audienceRoom?.destroy();
    this.#audienceRoom = null;
    this.#residence?.destroy();
    this.#residence = null;
    this.#terraceActivity = null;
    this.#terraceContext = null;
    this.#royal = null;
    this.#servant = null;
    this.#fire?.destroy();
    this.#fire = null;
    this.#banners?.destroy();
    this.#banners = null;
    this.#roofs?.destroy();
    this.#roofs = null;
    this.#stairs?.destroy();
    this.#stairs = null;
    this.#serviceStairs?.destroy();
    this.#serviceStairs = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    this.#stoneTexture = null;
    this.#doorTexture = null;
    this.#fireParticleTexture = null;
    this.#carpetTexture = null;
    this.#groundCollisionColumns = [];
    this.#cameraCollisionBlocks = [];
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   */
  #intersectsGroundColumns(x, z, radius) {
    const radiusSquared = radius * radius;
    if (this.#buildPlan?.layout.basePlanId) {
      return this.#cameraCollisionBlocks.some(/**
       * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
       */
      (block) => block.y + block.halfY > this.#position.elevation + 0.25 &&
        block.y - block.halfY < this.#position.elevation + 0.8 &&
        Math.max(Math.abs(x - block.x) - block.halfX, 0) ** 2 +
        Math.max(Math.abs(z - block.z) - block.halfZ, 0) ** 2 <= radiusSquared);
    }
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

  /**
   *
   * @param {number} deltaTime
    * @type {boolean}
   */
  #update = (deltaTime) => {
    if (this.#updateFailed) {
      return;
    }
    try {
      for (const door of this.#animatedDoors) door.update(deltaTime);
      this.#syncAudienceRoomVisibility();
    } catch (error) {
      this.#updateFailed = true;
      this.#terraceActivity?.stop();
      if (this.#onRuntimeError) {
        this.#onRuntimeError(error);
        return;
      }
      throw error;
    }
  };

  #syncAudienceRoomVisibility() {
    if (this.#audienceRoom) {
      this.#audienceRoom.royalVisible = true;
    }
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  #getDoorHit(rayStart, rayEnd) {
    let closest =
      this.#terraceActivity?.getPointerHit(rayStart, rayEnd) ?? null;
    for (const door of this.#animatedDoors) {
      const hit = door.getPointerHit(rayStart, rayEnd);
      if (!hit || (closest && hit.distance >= closest.distance)) {
        continue;
      }
      closest = hit;
    }
    return closest;
  }

  #createStructureResources() {
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
        material.diffuseVertexColor = false;
        material.diffuseMap = this.#stoneTexture;
        // Closed masonry has outward faces on both sides of each wall.
        // Rendering its hidden reverse faces causes coincident internal seams.
        material.cull = this.#pc.CULLFACE_BACK;
      } else if (definition.texture === "castleDoor") {
        material.diffuseMap = this.#doorTexture;
        material.cull = this.#pc.CULLFACE_NONE;
        material.twoSidedLighting = true;
      }
      material.update();
      this.#materials.set(name, material);
    }


  }

  #createDecorations() {
    this.#fire = new CastleFire({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      app: this.#app,
      particleTexture: this.#fireParticleTexture,
    });
    this.#entity.addChild(this.#fire.entity);
    this.#banners = new CastleBanner({ pc: this.#pc, app: this.#app, modelLibrary: this.#modelLibrary });
    this.#entity.addChild(this.#banners.entity);
    this.#roofs = new CastleRoof({ pc: this.#pc, modelLibrary: this.#modelLibrary });
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
    const serviceEntry = this.#buildPlan.metadata.runtime.residential?.serviceEntry;
    if (serviceEntry) {
      this.#serviceStairs = new CastleStairs({ pc: this.#pc, position: this.#position,
        doors: [serviceEntry], cubeSize: CASTLE_BLOCK_SIZE, modelLibrary: this.#modelLibrary,
        materials: this.#materials });
      this.#entity.addChild(this.#serviceStairs.entity);
    }
  }

  #createAudienceRoom() {
    const door = this.#doors[0];
    if (!door) {
      return;
    }
    const serviceStair = this.#residence?.layout.serviceStair;
    this.#audienceRoom = new CastleAudienceRoom({
      pc: this.#pc,
      app: this.#app,
      position: this.#position,
      door,
      occupant: null,
      materials: this.#materials,
      availableDepth: this.#interiorDepth,
      availableWidth: this.#interiorWidth,
      residentialLayout: this.#residence?.layout ?? null,
      frontWallDepth: CASTLE_WALL_THICKNESS_BLOCKS * CASTLE_BLOCK_SIZE,
      serviceOpening: serviceStair
        ? { ...serviceStair.center, radius: serviceStair.radius }
        : null,
      modelLibrary: this.#modelLibrary,
      fireParticleTexture: this.#fireParticleTexture,
      carpetTexture: this.#carpetTexture,
    });
    this.#entity.addChild(this.#audienceRoom.entity);
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
    for (const value of matrix.data) data.push(value);
    batches.set(material, data);
  }

  /**
   *
   * @param {Map<string, Array<number>>} batches
   */
  #createInstancedBatches(batches) {
    for (const [materialName, matrices] of batches.entries()) {
      if (!matrices.length) continue;
      const { entity, vertexBuffer } = this.#modelLibrary.instantiateMergedBatch(
        stoneBlockUrl, matrices,
        { name: `${materialName} authored castle masonry`, material: this.#materials.get(materialName), linearVertexColors: true, castShadows: true, receiveShadows: true },
      );
      this.#vertexBuffers.push(vertexBuffer);
      this.#entity.addChild(entity);
    }
  }

  #render() {
    const { geometry, layout, metadata } = this.#buildPlan;
    if (layout.empty) {
      return;
    }

    this.#interiorDepth = metadata.runtime.interiorDepth;
    this.#interiorWidth = metadata.runtime.interiorWidth;
    this.#groundCollisionColumns = metadata.collision.groundColumns.map(
      /**
       *
       * @param {number} column
       */
      (column) => ({ ...column }),
    );
    this.#cameraCollisionBlocks = metadata.collision.cameraBlocks.map(
      /**
       *
       * @param {{x: number, y: number, z: number, halfX: number, halfY: number, halfZ: number}} block
       */
      (block) => ({ ...block }),
    );

    const windows = new CastleWindowLayout(this.#buildPlan);
    // Use the same subtraction for masonry and camera collision. The glazing
    // closes each recess while preserving the visible depth of its stone reveal.
    this.#cameraCollisionBlocks = windows.cutBoxes(this.#cameraCollisionBlocks.map(
      /**
       * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
       */
      (block) => ({ ...block, sx: block.halfX * 2, sy: block.halfY * 2, sz: block.halfZ * 2, yaw: 0 }),
    )).map(
      /**
       * @param {import("./CastleWindowLayout.js").MasonryBox} box
       */
      (box) => ({ x: box.x, y: box.y, z: box.z, halfX: box.sx / 2, halfY: box.sy / 2, halfZ: box.sz / 2 }),
    );
    for (const window of windows.windows) {
      const angle = window.yaw * Math.PI / 180;
      const crosswise = Math.abs(Math.sin(angle)) > 0.5;
      this.#cameraCollisionBlocks.push({ x: window.position.x - Math.sin(angle) * window.depth * 0.315,
        y: window.position.y + window.height / 2, z: window.position.z - Math.cos(angle) * window.depth * 0.315,
        halfX: crosswise ? 0.025 : window.width / 2, halfY: window.height / 2, halfZ: crosswise ? window.width / 2 : 0.025 });
      const alongX = Math.abs(Math.sin(window.yaw * Math.PI / 180)) < 0.5;
      const half = window.width / 2;
      Window.addVisual(this.#pc, this.#modelLibrary, this.#entity, {
        id: `castle-${window.role}-window`, object: Window.name,
        from: { x: window.position.x - (alongX ? half : 0), y: window.position.y, z: window.position.z - (alongX ? 0 : half) },
        to: { x: window.position.x + (alongX ? half : 0), y: window.position.y + window.height, z: window.position.z + (alongX ? 0 : half) },
        depth: window.depth, variant: window.role,
        facing: (alongX ? Math.cos(window.yaw * Math.PI / 180) : Math.sin(window.yaw * Math.PI / 180)) >= 0 ? 1 : -1,
    }, this.#materials.get("castleStoneMid"));
    }
    const batches = new Map();
    for (const box of windows.cutBoxes(geometry.boxes)) {
      this.#addBoxMatrix(
        batches,
        box.material,
        box.x,
        box.y,
        box.z,
        box.yaw,
        box.sx,
        box.sy,
        box.sz,
      );
    }
    for (const flame of geometry.decorations.flames) {
      this.#fire.add(flame);
    }
    for (const banner of geometry.decorations.banners) {
      this.#banners.add(banner);
    }
    for (const roof of geometry.decorations.roofs) {
      this.#roofs.add(roof);
    }

    // Solid masonry owns engine contact at every storey, including window glazing.
    addGeneratedVoxelPhysics({ pc: this.#pc, parent: this.#entity, name: "Castle masonry",
      voxels: createCastleMasonryVoxels(this.#cameraCollisionBlocks), friction: 0 });
    this.#createInstancedBatches(batches);
    this.#createAnimatedDoors();
    if (metadata.runtime.terrace) {
      this.#terraceContext = {
        pc: this.#pc,
        modelLibrary: this.#modelLibrary,
        wallMaterial: this.#materials.get("castleStoneMid"),
        woodMaterial: this.#materials.get("castleDoor"),
        position: this.#position,
        doors: this.#doors,
        layout: { ...metadata.runtime.terrace },
        /**
         *
         * @param {boolean} atThrone
         */
        onRoyalAtThroneChange: (atThrone) => {
          this.#audienceRoom.royalVisible = atThrone;
        },
      };
      this.#connectResidents();
    }
  }
  #connectResidents() {
    if (
      this.#residentsConnected ||
      this.#terraceActivity ||
      !this.#terraceContext ||
      !this.#royal ||
      !this.#servant
    ) {
      return;
    }
    this.#residentsConnected = true;
    this.#terraceActivity = this.#royal.connectToCastle({
      ...this.#terraceContext,
      emptyBalcony: Boolean(this.#residence),
      servant: this.#servant,
      audienceRoom: this.#audienceRoom,
      /**
       *
       * @param {number} x
       * @param {number} z
       * @param {number} radius
       */
      isBlocked: (x, z, radius) => this.#intersectsGroundColumns(x, z, radius),
      prepareGameOver: () => {
        this.#terraceActivity?.stop();
        this.#syncAudienceRoomVisibility();
        for (const door of this.#animatedDoors) {
          door.openTemporarily(10);
        }
      },
    });
  }

  #createAnimatedDoors() {
    for (const doorData of this.#doors) {
      if (this.#buildPlan.layout.basePlanId) {
        const residential = this.#buildPlan.metadata.runtime.residential;
        const opening = residential.openings.find(/**
         * @param {{exteriorEntrance:boolean}} aperture
         */ (aperture) => aperture.exteriorEntrance);
        const arch = new CastleDoorArch({ castlePosition: this.#position, door: doorData,
          modelLibrary: this.#modelLibrary, placement: { ...residential.origin, height: opening.height - 0.05 } });
        this.#entity.addChild(arch.entity);
        this.#doorArches.push(arch);
        const door = new CastleDoor({ pc: this.#pc, castlePosition: this.#position, door: doorData,
          placement: { ...residential.origin, height: opening.height - 0.05, openingInset: 0, arched: true },
          modelLibrary: this.#modelLibrary, woodMaterial: this.#materials.get("castleDoor") });
        this.#entity.addChild(door.entity);
        this.#animatedDoors.push(door);
        continue;
      }
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
        woodMaterial: this.#materials.get("castleDoor"),
      });
      this.#entity.addChild(door.entity);
      this.#animatedDoors.push(door);
    }
    const residential = this.#buildPlan.metadata.runtime.residential;
    for (const upperDoor of [residential?.upperDoor, residential?.sideDoor, residential?.serviceDoor, ...(residential?.secondaryDoors ?? []), ...(this.#buildPlan.metadata.runtime.roomDoors ?? [])].filter(Boolean)) {
      const door = new CastleDoor({
        pc: this.#pc,
        castlePosition: this.#position,
        door: { side: this.#doors[0].side, width: upperDoor.width },
        placement: upperDoor,
        modelLibrary: this.#modelLibrary,
        woodMaterial: this.#materials.get("castleDoor"),
      });
      this.#entity.addChild(door.entity);
      this.#animatedDoors.push(door);
    }

  }

}
