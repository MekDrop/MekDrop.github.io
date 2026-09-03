import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import { HeroMeshFactory } from "./HeroMeshFactory.js";
import { HeroPaintedTexture } from "./HeroPaintedTexture.js";

const FIXED_STEP = 1 / 120;
const MAX_FRAME_TIME = 0.1;
const MOVE_SPEED = 4.2;
const RUN_SPEED = 6.3;
const GROUND_ACCELERATION = 24;
const AIR_ACCELERATION = 10;
const BRAKING = 30;
const GRAVITY = -22;
const MAX_JUMP_HEIGHT = 1.21;
const JUMP_VELOCITY = Math.sqrt(
  -2 * GRAVITY * MAX_JUMP_HEIGHT,
);
const MAX_JUMPS = 2;
const JUMP_ANIMATION_DURATION = 0.22;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.12;
const STEP_CLEARANCE = 0.22;
// Matches the widest part of the hero below one terrain level. The circle is
// still slightly narrower than a tile, leaving room to slide along ledges.
const HERO_RADIUS = 0.46;
const RESPAWN_HEIGHT = -4;
// Keeps the widest pose, including the pauldron and its outline, within one
// 1x1 terrain/path cube.
const HERO_MODEL_SCALE = 0.65;
const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.ENTRY,
]);
const STRUCTURE_SURFACE_TILES = new Set([
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);

function colorFromHex(pc, value) {
  return new pc.Color(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  );
}

export class Hero {
  #pc;
  #app;
  #mapData;
  #getViewRotation;
  #onPositionChange;
  #isStructureBlocked;
  #getStructureSurfaceHeight;
  #isGatewayBlocked;
  #entity;
  #modelRoot;
  #shadow;
  #materials = [];
  #textures = [];
  #meshes = [];
  #facetedMesh = null;
  #outlineMaterial = null;
  #parts = {};
  #spawn;
  #position;
  #velocity = { x: 0, y: 0, z: 0 };
  #input = { x: 0, y: 0 };
  #running = false;
  #grounded = true;
  #coyoteRemaining = COYOTE_TIME;
  #jumpBufferRemaining = 0;
  #jumpsUsed = 0;
  #jumpAnimationRemaining = 0;
  #accumulator = 0;
  #walkCycle = 0;
  #facingYaw = -25;
  #updateHandle = null;

  constructor({
    pc,
    app,
    mapData,
    getViewRotation,
    onPositionChange,
    isStructureBlocked,
    getStructureSurfaceHeight,
    isGatewayBlocked,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#getViewRotation = getViewRotation;
    this.#onPositionChange = onPositionChange;
    this.#isStructureBlocked = isStructureBlocked;
    this.#getStructureSurfaceHeight = getStructureSurfaceHeight;
    this.#isGatewayBlocked = isGatewayBlocked;
    this.#entity = new pc.Entity("Hero");
    this.#spawn = this.#findSpawn();
    this.#position = { ...this.#spawn };
    this.#entity.setPosition(
      this.#position.x,
      this.#position.y,
      this.#position.z,
    );

    this.#createModel();
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  setMovement(screenX, screenY, running = false) {
    this.#input.x = Math.max(-1, Math.min(1, screenX));
    this.#input.y = Math.max(-1, Math.min(1, screenY));
    this.#running = running;
  }

  jump() {
    this.#jumpBufferRemaining = JUMP_BUFFER_TIME;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;
    for (const material of this.#materials) material.destroy();
    this.#materials = [];
    for (const texture of this.#textures) texture.destroy();
    this.#textures = [];
    for (const mesh of this.#meshes) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#meshes = [];
    this.#facetedMesh = null;
    this.#outlineMaterial = null;
    this.#parts = {};
  }

  #update = (deltaTime) => {
    this.#accumulator = Math.min(
      this.#accumulator + Math.min(deltaTime, MAX_FRAME_TIME),
      MAX_FRAME_TIME,
    );
    while (this.#accumulator >= FIXED_STEP) {
      this.#step(FIXED_STEP);
      this.#accumulator -= FIXED_STEP;
    }
    this.#animate(deltaTime);
  };

  #step(deltaTime) {
    const previousX = this.#position.x;
    const previousY = this.#position.y;
    const previousZ = this.#position.z;
    if (this.#grounded) this.#jumpsUsed = 0;
    this.#jumpBufferRemaining = Math.max(
      0,
      this.#jumpBufferRemaining - deltaTime,
    );
    this.#coyoteRemaining = this.#grounded
      ? COYOTE_TIME
      : Math.max(0, this.#coyoteRemaining - deltaTime);
    if (
      !this.#grounded &&
      this.#coyoteRemaining === 0 &&
      this.#jumpsUsed === 0
    ) {
      this.#jumpsUsed = 1;
    }

    const desired = this.#desiredVelocity();
    const moving = Math.hypot(desired.x, desired.z) > 0.001;
    const acceleration = moving
      ? this.#grounded
        ? GROUND_ACCELERATION
        : AIR_ACCELERATION
      : BRAKING;
    this.#velocity.x = this.#approach(
      this.#velocity.x,
      desired.x,
      acceleration * deltaTime,
    );
    this.#velocity.z = this.#approach(
      this.#velocity.z,
      desired.z,
      acceleration * deltaTime,
    );

    const canGroundJump = this.#coyoteRemaining > 0;
    const canAirJump = !this.#grounded && this.#jumpsUsed < MAX_JUMPS;
    if (this.#jumpBufferRemaining > 0 && (canGroundJump || canAirJump)) {
      this.#velocity.y = JUMP_VELOCITY;
      this.#grounded = false;
      this.#coyoteRemaining = 0;
      this.#jumpBufferRemaining = 0;
      this.#jumpsUsed += 1;
      this.#jumpAnimationRemaining = JUMP_ANIMATION_DURATION;
    }

    this.#moveHorizontally(deltaTime);
    this.#moveVertically(deltaTime);

    if (this.#position.y < RESPAWN_HEIGHT) this.#respawn();
    this.#entity.setPosition(
      this.#position.x,
      this.#position.y,
      this.#position.z,
    );
    if (
      previousX !== this.#position.x ||
      previousY !== this.#position.y ||
      previousZ !== this.#position.z
    ) {
      this.#onPositionChange?.(this.#position);
    }
  }

  #desiredVelocity() {
    const length = Math.hypot(this.#input.x, this.#input.y);
    if (length < 0.001) return { x: 0, z: 0 };

    const screenX = this.#input.x / Math.max(1, length);
    const screenY = this.#input.y / Math.max(1, length);
    const yaw =
      Math.PI / 4 + (this.#getViewRotation?.() ?? 0) * (Math.PI / 2);
    const speed = this.#running ? RUN_SPEED : MOVE_SPEED;
    return {
      x: (Math.cos(yaw) * screenX - Math.sin(yaw) * screenY) * speed,
      z: (-Math.sin(yaw) * screenX - Math.cos(yaw) * screenY) * speed,
    };
  }

  #moveHorizontally(deltaTime) {
    const nextX = this.#position.x + this.#velocity.x * deltaTime;
    if (this.#canOccupy(nextX, this.#position.z)) {
      this.#position.x = nextX;
    } else {
      this.#velocity.x = 0;
    }

    const nextZ = this.#position.z + this.#velocity.z * deltaTime;
    if (this.#canOccupy(this.#position.x, nextZ)) {
      this.#position.z = nextZ;
    } else {
      this.#velocity.z = 0;
    }
  }

  #moveVertically(deltaTime) {
    const ground = this.#surfaceAt(this.#position.x, this.#position.z);
    if (
      this.#grounded &&
      ground !== null &&
      Math.abs(ground - this.#position.y) <= STEP_CLEARANCE
    ) {
      this.#position.y = ground;
      this.#velocity.y = 0;
      return;
    }

    this.#grounded = false;
    const previousY = this.#position.y;
    this.#velocity.y += GRAVITY * deltaTime;
    this.#position.y += this.#velocity.y * deltaTime;

    if (
      ground !== null &&
      this.#velocity.y <= 0 &&
      previousY >= ground - STEP_CLEARANCE &&
      this.#position.y <= ground
    ) {
      this.#position.y = ground;
      this.#velocity.y = 0;
      this.#grounded = true;
      this.#jumpsUsed = 0;
      this.#jumpAnimationRemaining = 0;
    }
  }

  #canOccupy(x, z) {
    const structureSurface = this.#getStructureSurfaceHeight?.(x, z) ?? null;
    if (
      Number.isFinite(structureSurface) &&
      structureSurface > this.#position.y + STEP_CLEARANCE
    ) {
      return false;
    }
    const gridX = x + (this.#mapData.cols - 1) / 2;
    const gridZ = z + (this.#mapData.rows - 1) / 2;
    const firstCol = Math.floor(gridX - HERO_RADIUS + 0.5);
    const lastCol = Math.floor(gridX + HERO_RADIUS + 0.5);
    const firstRow = Math.floor(gridZ - HERO_RADIUS + 0.5);
    const lastRow = Math.floor(gridZ + HERO_RADIUS + 0.5);

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let col = firstCol; col <= lastCol; col += 1) {
        if (!this.#circleOverlapsTile(x, z, col, row)) continue;
        if (
          col < 0 ||
          row < 0 ||
          col >= this.#mapData.cols ||
          row >= this.#mapData.rows
        ) {
          return false;
        }

        const type = this.#mapData.grid[row][col];
        const height = this.#mapData.heightmap[row][col];
        const isStairSurface =
          structureSurface !== null && STRUCTURE_SURFACE_TILES.has(type);
        if (
          (!WALKABLE_TILES.has(type) &&
            !STRUCTURE_SURFACE_TILES.has(type)) ||
          (!isStairSurface && height > this.#position.y + STEP_CLEARANCE)
        ) {
          const currentDistance = this.#circleDistanceSquaredToTile(
            this.#position.x,
            this.#position.z,
            col,
            row,
          );
          const nextDistance = this.#circleDistanceSquaredToTile(
            x,
            z,
            col,
            row,
          );
          if (
            currentDistance < HERO_RADIUS ** 2 &&
            nextDistance > currentDistance
          ) {
            continue;
          }
          return false;
        }
      }
    }
    if (this.#isStructureBlocked?.(x, z, HERO_RADIUS)) return false;
    if (this.#isGatewayBlocked?.(x, z, HERO_RADIUS)) return false;
    return true;
  }

  #circleOverlapsTile(x, z, col, row) {
    return (
      this.#circleDistanceSquaredToTile(x, z, col, row) < HERO_RADIUS ** 2
    );
  }

  #circleDistanceSquaredToTile(x, z, col, row) {
    const tileX = col - (this.#mapData.cols - 1) / 2;
    const tileZ = row - (this.#mapData.rows - 1) / 2;
    const distanceX = Math.max(Math.abs(x - tileX) - 0.5, 0);
    const distanceZ = Math.max(Math.abs(z - tileZ) - 0.5, 0);
    return distanceX * distanceX + distanceZ * distanceZ;
  }

  #surfaceAt(x, z) {
    const structureSurface = this.#getStructureSurfaceHeight?.(x, z);
    if (Number.isFinite(structureSurface)) return structureSurface;
    const tile = this.#tileAt(x, z);
    if (!tile) return null;
    if (WALKABLE_TILES.has(tile.type)) return tile.height;
    if (
      STRUCTURE_SURFACE_TILES.has(tile.type) &&
      !this.#isStructureBlocked?.(x, z, 0)
    ) {
      return tile.height;
    }
    return null;
  }

  #tileAt(x, z) {
    const col = Math.round(x + (this.#mapData.cols - 1) / 2);
    const row = Math.round(z + (this.#mapData.rows - 1) / 2);
    if (
      col < 0 ||
      row < 0 ||
      col >= this.#mapData.cols ||
      row >= this.#mapData.rows
    ) {
      return null;
    }
    const type = this.#mapData.grid[row][col];
    return {
      type,
      height:
        this.#mapData.heightmap[row][col] +
        (type === TileType.GRASS ? GRASS_SURFACE_LIFT : 0),
    };
  }

  #findSpawn() {
    const { castle, cols, rows } = this.#mapData;
    const grassTiles = [];
    const safeGrassTiles = [];
    const nearbyGrassTiles = [];
    const castleLeft = castle?.position?.col;
    const castleTop = castle?.position?.row;
    const castleRight = castleLeft + (castle?.position?.width ?? 0) - 1;
    const castleBottom = castleTop + (castle?.position?.depth ?? 0) - 1;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (this.#mapData.grid[row][col] !== TileType.GRASS) continue;
        const tile = { col, row };
        grassTiles.push(tile);
        if (!this.#hasSpawnExit(col, row)) continue;
        safeGrassTiles.push(tile);
        if (!Number.isFinite(castleLeft) || !Number.isFinite(castleTop)) {
          continue;
        }

        const distanceX = Math.max(castleLeft - col, 0, col - castleRight);
        const distanceZ = Math.max(castleTop - row, 0, row - castleBottom);
        const distance = Math.hypot(distanceX, distanceZ);
        if (distance >= 2 && distance <= 6) nearbyGrassTiles.push(tile);
      }
    }

    const candidates = nearbyGrassTiles.length
      ? nearbyGrassTiles
      : safeGrassTiles.length
        ? safeGrassTiles
        : grassTiles;
    if (candidates.length) {
      const tile = candidates[Math.floor(Math.random() * candidates.length)];
      return {
        x: tile.col - (cols - 1) / 2,
        y:
          this.#mapData.heightmap[tile.row][tile.col] + GRASS_SURFACE_LIFT,
        z: tile.row - (rows - 1) / 2,
      };
    }

    return { x: 0, y: 1, z: 0 };
  }

  #hasSpawnExit(col, row) {
    const height = this.#mapData.heightmap[row][col];
    let exits = 0;
    for (const [deltaCol, deltaRow] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const neighbourCol = col + deltaCol;
      const neighbourRow = row + deltaRow;
      if (
        neighbourCol < 0 ||
        neighbourRow < 0 ||
        neighbourCol >= this.#mapData.cols ||
        neighbourRow >= this.#mapData.rows
      ) {
        continue;
      }
      if (
        !WALKABLE_TILES.has(
          this.#mapData.grid[neighbourRow][neighbourCol],
        ) ||
        this.#mapData.heightmap[neighbourRow][neighbourCol] > height
      ) {
        continue;
      }
      exits += 1;
    }
    return exits >= 2;
  }

  #respawn() {
    this.#position = { ...this.#spawn };
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#coyoteRemaining = COYOTE_TIME;
    this.#jumpBufferRemaining = 0;
    this.#jumpsUsed = 0;
    this.#jumpAnimationRemaining = 0;
  }

  #animate(deltaTime) {
    if (!this.#entity || !this.#modelRoot) return;
    const horizontalSpeed = Math.hypot(this.#velocity.x, this.#velocity.z);
    const activeSpeed = this.#running ? RUN_SPEED : MOVE_SPEED;
    const movementAmount = Math.min(1, horizontalSpeed / activeSpeed);
    const runningPose =
      this.#running && this.#grounded && movementAmount > 0.08;
    const gaitSpeed = runningPose ? 1.72 : 1;
    const stride = runningPose ? 52 : 30;
    if (horizontalSpeed > 0.08) {
      const targetYaw =
        (Math.atan2(this.#velocity.x, this.#velocity.z) * 180) / Math.PI;
      this.#facingYaw = this.#lerpAngle(
        this.#facingYaw,
        targetYaw,
        Math.min(1, deltaTime * 14),
      );
    }
    let jumpAnimationProgress = 1;
    if (!this.#grounded && this.#jumpAnimationRemaining > 0) {
      this.#jumpAnimationRemaining = Math.max(
        0,
        this.#jumpAnimationRemaining - deltaTime,
      );
      jumpAnimationProgress =
        1 -
        this.#jumpAnimationRemaining / JUMP_ANIMATION_DURATION;
    }
    const jumpAnimationPulse = Math.sin(jumpAnimationProgress * Math.PI);

    if (this.#grounded && movementAmount > 0.02) {
      this.#walkCycle +=
        deltaTime * (9 + movementAmount * 4) * gaitSpeed;
    }
    const swing = this.#grounded
      ? Math.sin(this.#walkCycle) * stride * movementAmount
      : 0;
    const cycleSine = Math.sin(this.#walkCycle);
    const runLean = runningPose ? 11 * movementAmount : 0;
    const runRoll = runningPose ? cycleSine * 2.8 * movementAmount : 0;
    this.#modelRoot.setLocalEulerAngles(
      runLean,
      this.#facingYaw,
      runRoll,
    );
    const bob = this.#grounded
      ? Math.abs(Math.sin(this.#walkCycle * 2)) *
        (runningPose ? 0.075 : 0.035) *
        movementAmount
      : 0.06;
    const runCompression = runningPose
      ? Math.abs(Math.cos(this.#walkCycle * 2)) * 0.035 * movementAmount
      : 0;
    this.#modelRoot.setLocalPosition(
      0,
      bob - runCompression + jumpAnimationPulse * 0.04,
      runningPose ? -0.035 * movementAmount : 0,
    );
    const jumpStretch = this.#grounded
      ? 0
      : Math.max(-0.025, Math.min(0.08, this.#velocity.y * 0.008));
    const runSquash = runningPose ? runCompression * 0.42 : 0;
    this.#modelRoot.setLocalScale(
      HERO_MODEL_SCALE * (1 - jumpStretch * 0.35 + runSquash),
      HERO_MODEL_SCALE *
        (1 + jumpStretch + jumpAnimationPulse * 0.05 - runSquash),
      HERO_MODEL_SCALE * (1 - jumpStretch * 0.35 + runSquash),
    );
    const airborneArmPitch = -18 - jumpAnimationProgress * 37;
    const leftArmPitch = runningPose ? swing * 1.12 - 8 : swing;
    const rightArmPitch = runningPose ? -swing * 1.12 - 8 : -swing;
    this.#parts.leftArm.setLocalEulerAngles(
      this.#grounded ? leftArmPitch : airborneArmPitch,
      0,
      runningPose ? -10 : -18,
    );
    this.#parts.rightArm.setLocalEulerAngles(
      this.#grounded ? rightArmPitch : airborneArmPitch,
      0,
      runningPose ? 10 : 18,
    );
    const legSwingScale = runningPose ? 0.92 : 0.72;
    this.#parts.leftLeg.setLocalEulerAngles(
      this.#grounded
        ? -swing * legSwingScale
        : 55 - jumpAnimationProgress * 27,
      0,
      0,
    );
    this.#parts.rightLeg.setLocalEulerAngles(
      this.#grounded
        ? swing * legSwingScale
        : -55 + jumpAnimationProgress * 25,
      0,
      0,
    );
    const leftBootLift = runningPose
      ? Math.max(0, cycleSine) * 0.11 * movementAmount
      : 0;
    const rightBootLift = runningPose
      ? Math.max(0, -cycleSine) * 0.11 * movementAmount
      : 0;
    this.#parts.leftLeg.setLocalPosition(-0.2, 0.71 + leftBootLift, 0);
    this.#parts.rightLeg.setLocalPosition(0.2, 0.71 + rightBootLift, 0);

    const ground = this.#surfaceAt(this.#position.x, this.#position.z);
    this.#shadow.enabled = ground !== null && this.#position.y - ground < 3;
    if (this.#shadow.enabled) {
      const height = Math.max(0, this.#position.y - ground);
      const scale = Math.max(0.48, 1 - height * 0.16);
      this.#shadow.setLocalPosition(0, ground - this.#position.y + 0.012, 0);
      this.#shadow.setLocalScale(0.96 * scale, 0.018, 0.64 * scale);
    }
  }

  #createModel() {
    const colors = {
      hair: 0x086b83,
      hairDark: 0x064554,
      hairLight: 0x1594a8,
      skin: 0xb96f50,
      skinLight: 0xd58c68,
      armor: 0x0c5557,
      armorLight: 0x23877c,
      emerald: 0x168d59,
      emeraldLight: 0x70d267,
      scarf: 0xc68a1b,
      scarfLight: 0xe2ab32,
      tunic: 0x59321f,
      tunicLight: 0x74472b,
      trousers: 0x123f43,
      leather: 0x3b2218,
      leatherLight: 0x75452a,
      gold: 0xdda52f,
      eye: 0x172124,
      highlight: 0xf4ead2,
      outline: 0x102529,
      shadow: 0x07130f,
    };
    const materials = Object.fromEntries(
      Object.entries(colors).map(([name, color]) => [
        name,
        this.#createMaterial(
          name,
          color,
          ["hair", "hairLight", "armorLight", "emeraldLight"].includes(name)
            ? 0.48
            : 0.16,
        ),
      ]),
    );
    materials.shadow.opacity = 0.28;
    materials.shadow.blendType = this.#pc.BLEND_NORMAL;
    materials.shadow.depthWrite = false;
    materials.shadow.useLighting = false;
    materials.shadow.update();
    this.#outlineMaterial = materials.outline;
    this.#outlineMaterial.cull = this.#pc.CULLFACE_FRONT;
    this.#outlineMaterial.gloss = 0;
    this.#outlineMaterial.update();
    this.#facetedMesh = HeroMeshFactory.createFacetedVolume(
      this.#pc,
      this.#app.graphicsDevice,
    );
    this.#meshes.push(this.#facetedMesh);

    this.#shadow = this.#part(
      this.#entity,
      "Hero shadow",
      "cylinder",
      materials.shadow,
      [0, 0.012, 0],
      [0.96, 0.018, 0.64],
    );
    this.#modelRoot = new this.#pc.Entity("Hero model");
    this.#modelRoot.setLocalScale(
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
    );
    this.#entity.addChild(this.#modelRoot);

    this.#createLegs(materials);
    this.#createTorso(materials);
    this.#createArms(materials);
    this.#createHead(materials);
  }

  #createLegs(materials) {
    this.#parts.leftLeg = this.#pivot("Left leg", [-0.2, 0.71, 0]);
    this.#parts.rightLeg = this.#pivot("Right leg", [0.2, 0.71, 0]);
    for (const [side, pivot] of [
      [-1, this.#parts.leftLeg],
      [1, this.#parts.rightLeg],
    ]) {
      this.#part(
        pivot,
        "Thick trouser leg",
        "capsule",
        materials.trousers,
        [0, -0.16, 0],
        [0.23, 0.36, 0.23],
      );
      this.#part(
        pivot,
        "Rounded boot",
        "cylinder",
        materials.leather,
        [0, -0.48, 0.1],
        [0.4, 0.44, 0.51],
        [0, side * 2, 0],
      );
      this.#part(
        pivot,
        "Boot cuff",
        "cylinder",
        materials.leatherLight,
        [0, -0.25, 0],
        [0.33, 0.13, 0.34],
      );
      this.#part(
        pivot,
        "Boot band",
        "cylinder",
        materials.tunicLight,
        [0, -0.43, 0.08],
        [0.35, 0.1, 0.42],
      );
    }
  }

  #createTorso(materials) {
    this.#part(
      this.#modelRoot,
      "Short brown tunic",
      "sphere",
      materials.tunic,
      [0, 1.02, 0],
      [0.7, 0.69, 0.5],
    );
    this.#part(
      this.#modelRoot,
      "Tunic shadow hem",
      "cylinder",
      materials.leather,
      [0, 0.78, 0],
      [0.66, 0.14, 0.47],
    );
    this.#part(
      this.#modelRoot,
      "Brown lower tunic flap",
      "box",
      materials.tunicLight,
      [0, 0.68, 0.32],
      [0.36, 0.28, 0.12],
    );
    this.#part(
      this.#modelRoot,
      "Golden waist trim",
      "cylinder",
      materials.gold,
      [0, 0.83, 0],
      [0.66, 0.12, 0.48],
    );
    this.#part(
      this.#modelRoot,
      "Rounded chest armor",
      "sphere",
      materials.armor,
      [0, 1.1, 0.22],
      [0.61, 0.54, 0.27],
    );
    this.#part(
      this.#modelRoot,
      "Chest armor painted highlight",
      "sphere",
      materials.armorLight,
      [-0.14, 1.24, 0.42],
      [0.22, 0.13, 0.05],
      [0, 0, -18],
    );

    this.#part(
      this.#modelRoot,
      "Scarf lower fold",
      "cylinder",
      materials.scarf,
      [0, 1.38, 0],
      [0.75, 0.18, 0.62],
    );
    this.#part(
      this.#modelRoot,
      "Scarf middle fold",
      "cylinder",
      materials.scarfLight,
      [0, 1.46, 0.025],
      [0.69, 0.14, 0.58],
      [0, 7, 0],
    );
    this.#part(
      this.#modelRoot,
      "Scarf upper fold",
      "cylinder",
      materials.scarf,
      [0, 1.53, -0.015],
      [0.63, 0.12, 0.54],
      [0, -8, 0],
    );
    this.#part(
      this.#modelRoot,
      "Scarf painted highlight",
      "box",
      materials.scarfLight,
      [-0.24, 1.47, 0.32],
      [0.2, 0.11, 0.05],
      [0, 0, -8],
    );
    this.#part(
      this.#modelRoot,
      "Scarf tail",
      "box",
      materials.scarf,
      [-0.24, 1.27, -0.34],
      [0.2, 0.38, 0.1],
      [14, 0, -15],
    );
  }

  #createArms(materials) {
    this.#parts.leftArm = this.#pivot("Left arm", [-0.49, 1.24, 0]);
    this.#parts.rightArm = this.#pivot("Right arm", [0.47, 1.22, 0]);
    this.#parts.leftArm.setLocalEulerAngles(0, 0, -18);
    this.#parts.rightArm.setLocalEulerAngles(0, 0, 18);

    this.#part(
      this.#parts.leftArm,
      "Emerald spherical pauldron",
      "sphere",
      materials.emerald,
      [-0.025, 0, 0.01],
      [0.39, 0.36, 0.38],
    );
    this.#part(
      this.#parts.leftArm,
      "Pauldron painted highlight",
      "sphere",
      materials.emeraldLight,
      [-0.12, 0.09, 0.2],
      [0.15, 0.12, 0.07],
    );
    this.#part(
      this.#parts.leftArm,
      "Short teal sleeve",
      "capsule",
      materials.armor,
      [0, -0.23, 0],
      [0.2, 0.35, 0.21],
    );
    this.#part(
      this.#parts.leftArm,
      "Teal forearm bracer",
      "cylinder",
      materials.armorLight,
      [0, -0.4, 0.02],
      [0.23, 0.22, 0.23],
    );
    this.#part(
      this.#parts.leftArm,
      "Left mitten glove",
      "sphere",
      materials.leather,
      [0, -0.55, 0.05],
      [0.24, 0.22, 0.25],
    );

    this.#part(
      this.#parts.rightArm,
      "Leather upper sleeve",
      "capsule",
      materials.leatherLight,
      [0, -0.17, 0],
      [0.24, 0.42, 0.24],
    );
    this.#part(
      this.#parts.rightArm,
      "Leather gauntlet",
      "capsule",
      materials.leather,
      [0, -0.42, 0.02],
      [0.24, 0.36, 0.25],
    );
    for (const y of [-0.33, -0.44]) {
      this.#part(
        this.#parts.rightArm,
        "Narrow golden gauntlet strap",
        "cylinder",
        materials.gold,
        [0, y, 0.02],
        [0.25, 0.055, 0.26],
      );
    }
    this.#part(
      this.#parts.rightArm,
      "Right mitten glove",
      "sphere",
      materials.leather,
      [0, -0.61, 0.06],
      [0.25, 0.23, 0.26],
    );
  }

  #createHead(materials) {
    this.#part(
      this.#modelRoot,
      "Helmet shaped hair mass",
      "sphere",
      materials.hairDark,
      [0, 1.92, -0.03],
      [1.01, 1.03, 0.9],
    );
    this.#part(
      this.#modelRoot,
      "Round minimal face",
      "sphere",
      materials.skin,
      [0, 1.82, 0.38],
      [0.73, 0.72, 0.32],
    );
    this.#part(
      this.#modelRoot,
      "Glossy petrol hair cap",
      "sphere",
      materials.hair,
      [0, 2.12, -0.03],
      [0.99, 0.65, 0.86],
    );

    for (const [x, y, scale, rotation] of [
      [-0.27, 2.07, [0.27, 0.27, 0.13], -11],
      [0, 2.02, [0.29, 0.32, 0.14], 0],
      [0.27, 2.07, [0.27, 0.27, 0.13], 11],
    ]) {
      this.#part(
        this.#modelRoot,
        "Heavy segmented bang",
        "box",
        materials.hair,
        [x, y, 0.46],
        scale,
        [0, 0, rotation],
      );
    }
    this.#part(
      this.#modelRoot,
      "Left upper side lock",
      "box",
      materials.hair,
      [-0.44, 1.79, 0.3],
      [0.18, 0.36, 0.17],
      [0, 0, -6],
    );
    this.#part(
      this.#modelRoot,
      "Right upper side lock",
      "box",
      materials.hair,
      [0.44, 1.79, 0.3],
      [0.18, 0.36, 0.17],
      [0, 0, 6],
    );
    this.#part(
      this.#modelRoot,
      "Left lower side lock",
      "box",
      materials.hairDark,
      [-0.45, 1.6, 0.29],
      [0.15, 0.2, 0.15],
      [0, 0, -10],
    );
    this.#part(
      this.#modelRoot,
      "Right lower side lock",
      "box",
      materials.hairDark,
      [0.45, 1.6, 0.29],
      [0.15, 0.2, 0.15],
      [0, 0, 10],
    );
    this.#part(
      this.#modelRoot,
      "Hair broad painted highlight",
      "sphere",
      materials.hairLight,
      [-0.25, 2.25, 0.37],
      [0.23, 0.13, 0.06],
    );

    this.#part(
      this.#modelRoot,
      "Left ear",
      "sphere",
      materials.skinLight,
      [-0.42, 1.79, 0.21],
      [0.14, 0.19, 0.12],
    );
    this.#part(
      this.#modelRoot,
      "Right ear",
      "sphere",
      materials.skinLight,
      [0.42, 1.79, 0.21],
      [0.14, 0.19, 0.12],
    );
    for (const x of [-0.14, 0.14]) {
      this.#part(
        this.#modelRoot,
        "Tiny oval eye",
        "sphere",
        materials.eye,
        [x, 1.82, 0.56],
        [0.05, 0.075, 0.028],
      );
      this.#part(
        this.#modelRoot,
        "Eye pinpoint highlight",
        "sphere",
        materials.highlight,
        [x - 0.012, 1.844, 0.584],
        [0.014, 0.019, 0.009],
      );
    }
    this.#part(
      this.#modelRoot,
      "Subtle nose",
      "sphere",
      materials.skinLight,
      [0, 1.74, 0.56],
      [0.045, 0.035, 0.025],
    );
    this.#part(
      this.#modelRoot,
      "Subtle mouth",
      "box",
      materials.eye,
      [0, 1.68, 0.558],
      [0.065, 0.015, 0.012],
    );

    this.#part(
      this.#modelRoot,
      "High rear ponytail knot",
      "sphere",
      materials.hair,
      [0, 2.38, -0.46],
      [0.32, 0.29, 0.32],
    );
    this.#part(
      this.#modelRoot,
      "Small golden ponytail band",
      "cylinder",
      materials.gold,
      [0, 2.3, -0.46],
      [0.22, 0.1, 0.22],
    );
    for (const [name, position, rotation, material] of [
      ["Ponytail upper tuft", [0, 2.54, -0.48], [0, 0, 0], materials.hairLight],
      ["Ponytail left tuft", [-0.15, 2.48, -0.5], [0, 0, 20], materials.hair],
      ["Ponytail right tuft", [0.15, 2.48, -0.5], [0, 0, -20], materials.hair],
      ["Ponytail rear tuft", [0, 2.42, -0.64], [48, 0, 0], materials.hairDark],
    ]) {
      this.#part(
        this.#modelRoot,
        name,
        "cone",
        material,
        position,
        [0.22, 0.24, 0.22],
        rotation,
      );
    }
  }

  #pivot(name, position) {
    const pivot = new this.#pc.Entity(name);
    pivot.setLocalPosition(...position);
    this.#modelRoot.addChild(pivot);
    return pivot;
  }

  #part(parent, name, type, material, position, scale, rotation = [0, 0, 0]) {
    const entity = new this.#pc.Entity(name);
    const usesFacetedMesh = ["sphere", "capsule"].includes(type);
    if (usesFacetedMesh) {
      entity.addComponent("render", {
        meshInstances: [
          new this.#pc.MeshInstance(this.#facetedMesh, material),
        ],
        castShadows: false,
        receiveShadows: true,
      });
    } else {
      entity.addComponent("render", {
        type,
        castShadows: false,
        receiveShadows: true,
      });
    }
    for (const meshInstance of entity.render.meshInstances) {
      meshInstance.material = material;
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = true;
    }
    entity.setLocalPosition(...position);
    entity.setLocalScale(...scale);
    entity.setLocalEulerAngles(...rotation);
    if (
      this.#outlineMaterial &&
      material !== this.#outlineMaterial &&
      ![
        "shadow",
        "glint",
        "panel",
        "cheek",
        "highlight",
        "strap",
        "bang",
        "eye",
        "nose",
        "mouth",
      ].some((partName) => name.toLowerCase().includes(partName))
    ) {
      const outline = new this.#pc.Entity(`${name} outline`);
      if (usesFacetedMesh) {
        outline.addComponent("render", {
          meshInstances: [
            new this.#pc.MeshInstance(
              this.#facetedMesh,
              this.#outlineMaterial,
            ),
          ],
          castShadows: false,
          receiveShadows: false,
        });
      } else {
        outline.addComponent("render", {
          type,
          castShadows: false,
          receiveShadows: false,
        });
      }
      for (const meshInstance of outline.render.meshInstances) {
        meshInstance.material = this.#outlineMaterial;
        meshInstance.castShadow = false;
        meshInstance.receiveShadow = false;
      }
      outline.setLocalScale(1.055, 1.055, 1.055);
      entity.addChild(outline);
    }
    parent.addChild(entity);
    return entity;
  }

  #createMaterial(name, color, gloss) {
    const material = new this.#pc.StandardMaterial();
    material.name = `Hero ${name}`;
    material.diffuse = colorFromHex(this.#pc, color);
    if (!["outline", "shadow", "eye", "highlight"].includes(name)) {
      const texture = HeroPaintedTexture.create(
        this.#pc,
        this.#app.graphicsDevice,
        name,
        color,
      );
      material.diffuse = new this.#pc.Color(1, 1, 1);
      material.diffuseMap = texture;
      this.#textures.push(texture);
    }
    material.gloss = gloss;
    material.metalness = name.includes("armor") ? 0.12 : 0;
    material.useMetalness = true;
    material.update();
    this.#materials.push(material);
    return material;
  }

  #approach(value, target, amount) {
    if (value < target) return Math.min(value + amount, target);
    return Math.max(value - amount, target);
  }

  #lerpAngle(from, to, amount) {
    const difference = ((to - from + 540) % 360) - 180;
    return from + difference * amount;
  }
}
