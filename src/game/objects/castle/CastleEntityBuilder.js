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
} from "../../castle-generation/CastleGenerationConfig.js";

export class CastleEntityBuilder {
  static get modelUrls() {
    return [
      CastleDoor.modelUrl,
      CastleDoorArch.modelUrl,
      CastleStairs.modelUrl,
      ...CastleAudienceRoom.modelUrls,
    ];
  }

  #pc;
  #app;
  #position;
  #doors;
  #buildPlan;
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
  #terraceActivity = null;
  #terraceContext = null;
  #royal = null;
  #servant = null;
  #groundCollisionColumns = [];
  #cameraCollisionBlocks = [];
  #animatedDoors = [];
  #doorArches = [];
  #updateHandle = null;
  #onRuntimeError;
  #updateFailed = false;
  #interiorDepth = 0;
  #interiorWidth = 0;

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

  attachRoyal(royal) {
    this.#royal = royal;
    this.#audienceRoom.occupant = royal.audienceActor;
    this.#connectResidents();
  }

  attachServant(servant) {
    this.#servant = servant;
    this.#connectResidents();
  }

  get royalActivityState() {
    return this.#terraceActivity?.state ?? null;
  }

  setRoyalActivityTriggered(triggered) {
    this.#terraceActivity?.setTriggered(triggered);
  }

  isRoyalActivityTriggerAt(position) {
    return this.#terraceActivity?.isTriggerAt(position) ?? false;
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
    return this.#intersectsGroundColumns(x, z, radius);
  }

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

  blocksCameraAt(x, y, z, radius = 0) {
    if (
      this.#animatedDoors.some((door) =>
        door.blocksCameraAt(x, y, z, radius),
      ) ||
      this.#terraceActivity?.blocksCameraAt(x, y, z, radius)
    ) {
      return true;
    }
    return this.#cameraCollisionBlocks.some((block) => {
      const distanceX = Math.max(Math.abs(x - block.x) - block.halfX, 0);
      const distanceY = Math.max(Math.abs(y - block.y) - block.halfY, 0);
      const distanceZ = Math.max(Math.abs(z - block.z) - block.halfZ, 0);
      return (
        distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ <=
        radius * radius
      );
    });
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

  beginWindGesture(hit) {
    this.#activeWindTarget = hit?.flag ? this.#flags : this.#banners;
    this.#activeWindTarget?.beginWindGesture(hit);
  }

  handlePointerDown({ hit }) {
    this.beginWindGesture(hit);
    return { capturePointer: true };
  }

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

  #render() {
    const { geometry, layout, metadata } = this.#buildPlan;
    if (layout.empty) {
      return;
    }

    this.#interiorDepth = metadata.runtime.interiorDepth;
    this.#interiorWidth = metadata.runtime.interiorWidth;
    this.#groundCollisionColumns = metadata.collision.groundColumns.map(
      (column) => ({ ...column }),
    );
    this.#cameraCollisionBlocks = metadata.collision.cameraBlocks.map(
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
