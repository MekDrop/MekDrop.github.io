import { DynamicRenderBatch } from "../../rendering/DynamicRenderBatch.js";
import { CastleBanner } from "./CastleBanner.js";
import { CastleAudienceRoom } from "./CastleAudienceRoom.js";
import { CastleDoor } from "./CastleDoor.js";
import { CastleDoorArch } from "./CastleDoorArch.js";
import { CastleFire } from "./CastleFire.js";
import { CastleFlag } from "./CastleFlag.js";
import { CastleRoof } from "./CastleRoof.js";
import { CastleStairs } from "./CastleStairs.js";
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
 * @typedef {Parameters<CastleBanner["beginWindGesture"]>[0]|Parameters<CastleFlag["beginWindGesture"]>[0]} CastleWindHit
 */

export class CastleEntityBuilder {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      CastleDoor.modelUrl,
      CastleDoorArch.modelUrl,
      CastleStairs.modelUrl,
      ...CastleAudienceRoom.modelUrls,
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
    * @type {import("playcanvas").Mesh|null}
   */
  #blockMesh = null;
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
    * @type {CastleFlag|null}
   */
  #flags = null;
  /**
   *
    * @type {CastleBanner|CastleFlag|null}
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
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, buildPlan: import("src/game/generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, doorTexture: import("playcanvas").Texture, stoneTexture: import("playcanvas").Texture, fireParticleTexture: import("playcanvas").Texture, onRuntimeError: ((error: Error) => void)|null}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan} options.buildPlan
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("playcanvas").Texture} options.doorTexture
   * @param {import("playcanvas").Texture} options.stoneTexture
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
    this.#onRuntimeError = onRuntimeError;
    this.#entity = new pc.Entity("Castle");

    try {
      this.#createStructureResources();
      this.#createDecorations();
      this.#createStairs();
      this.#render();
      this.#createAudienceRoom();
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
    this.#audienceRoom.occupant = royal.audienceActor;
    this.#connectResidents();
  }

  /**
   *
   * @param {import("../servant/Servant.js").Servant} servant
   */
  attachServant(servant) {
    this.#servant = servant;
    this.#connectResidents();
  }

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
    // The room floor supports walking; it must not cancel its solid furniture,
    // walls, or closed doors when the collision world queries this aggregate.
    if (this.intersectsGroundFootprint(x, z, radius)) {
      return true;
    }
    return (
      this.#stairs?.blocksMovementAt(x, z, radius, elevation, stepClearance) ??
      false
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
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
   *
   * @param {number} x
   * @param {number} z
   */
  surfaceHeightAt(x, z) {
    return (
      this.#stairs?.surfaceHeightAt(x, z) ??
      this.#audienceRoom?.surfaceHeightAt(x, z) ??
      null
    );
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   */
  updateHeroPosition(position) {
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
    this.#activeWindTarget = hit?.flag ? this.#flags : this.#banners;
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
    this.#terraceActivity = null;
    this.#terraceContext = null;
    this.#royal = null;
    this.#servant = null;
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
    this.#stoneTexture = null;
    this.#doorTexture = null;
    this.#fireParticleTexture = null;
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
        material.diffuseMap = this.#stoneTexture;
        // The eye camera can reach a block's interior at wall contact. Keep
        // its exit faces solid instead of exposing the scene through backfaces.
        material.cull = this.#pc.CULLFACE_NONE;
        material.twoSidedLighting = true;
      } else if (definition.texture === "castleDoor") {
        material.diffuseMap = this.#doorTexture;
        material.cull = this.#pc.CULLFACE_NONE;
        material.twoSidedLighting = true;
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
    this.#audienceRoom = new CastleAudienceRoom({
      pc: this.#pc,
      app: this.#app,
      position: this.#position,
      door,
      occupant: null,
      materials: this.#materials,
      availableDepth: this.#interiorDepth,
      availableWidth: this.#interiorWidth,
      frontWallDepth: CASTLE_WALL_THICKNESS_BLOCKS * CASTLE_BLOCK_SIZE,
      modelLibrary: this.#modelLibrary,
      fireParticleTexture: this.#fireParticleTexture,
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
      new this.#pc.Vec3(x, y, z),
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

    const batches = new Map();
    for (const box of geometry.boxes) {
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
    for (const flag of geometry.decorations.flags) {
      this.#flags.add(flag);
    }
    for (const roof of geometry.decorations.roofs) {
      this.#roofs.add(roof);
    }

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
      this.#terraceActivity ||
      !this.#terraceContext ||
      !this.#royal ||
      !this.#servant
    ) {
      return;
    }
    this.#terraceActivity = this.#royal.connectToCastle({
      ...this.#terraceContext,
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
  }

}
