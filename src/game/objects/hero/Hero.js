import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import heroModelUrl from "../../models/hero/hero.glb?url";

const FIXED_STEP = 1 / 120;
const MAX_FRAME_TIME = 0.1;
const MOVE_SPEED = 4.2;
const RUN_SPEED = 6.3;
const GROUND_ACCELERATION = 24;
const AIR_ACCELERATION = 10;
const BRAKING = 30;
const GRAVITY = -22;
const MAX_JUMP_HEIGHT = 1.21;
const JUMP_VELOCITY = Math.sqrt(-2 * GRAVITY * MAX_JUMP_HEIGHT);
const MAX_JUMPS = 2;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.12;
const STEP_CLEARANCE = 0.22;
const ANIMATION_BLEND_TIME = 0.14;
const BORED_IDLE_DELAY = 5;
const BORED_BREAK_MIN = 2.5;
const BORED_BREAK_VARIANCE = 2;
const OCCUPANCY = Object.freeze({
  open: "open",
  blocked: "blocked",
  edge: "edge",
});
const HERO_ANIMATION = Object.freeze({
  idle: "Idle",
  walk: "Walk",
  run: "Run",
  jump: "Jump",
  blocked: "BlockedPush",
  edge: "EdgeRefuse",
  repelled: "Repelled",
  summonAxe: "SummonAxe",
  dismissAxe: "DismissAxe",
  cut: Object.freeze({
    low: "ChopLow",
    middle: "ChopMiddle",
    high: "ChopHigh",
  }),
  bored: Object.freeze(["BoredLook", "BoredStretch", "BoredTap"]),
});
const HERO_ANIMATION_NAMES = Object.freeze([
  HERO_ANIMATION.idle,
  HERO_ANIMATION.walk,
  HERO_ANIMATION.run,
  HERO_ANIMATION.jump,
  HERO_ANIMATION.blocked,
  HERO_ANIMATION.edge,
  HERO_ANIMATION.repelled,
  HERO_ANIMATION.summonAxe,
  HERO_ANIMATION.dismissAxe,
  ...Object.values(HERO_ANIMATION.cut),
  ...HERO_ANIMATION.bored,
]);
const LOOPING_ANIMATIONS = new Set([
  HERO_ANIMATION.idle,
  HERO_ANIMATION.walk,
  HERO_ANIMATION.run,
  HERO_ANIMATION.blocked,
]);
const BORED_ANIMATION_DURATIONS = Object.freeze({
  BoredLook: 3,
  BoredStretch: 3.5,
  BoredTap: 3,
});
// Matches the widest part of the hero below one terrain level. The circle is
// still slightly narrower than a tile, leaving room to slide along ledges.
const HERO_RADIUS = 0.46;
// Ledge checks follow the hero's planted feet instead of the widest parts of
// the model. This lets the hero approach a drop before refusing to step off.
const LEDGE_RADIUS = 0.27;
const RESPAWN_HEIGHT = -4;
// Keeps the widest pose, including the pauldron and its outline, within one
// 1x1 terrain/path cube.
const HERO_MODEL_SCALE = 0.65;
const WALKABLE_TILES = new Set([TileType.GRASS, TileType.PATH, TileType.ENTRY]);
const CUT_DURATION = 0.8;
const CUT_IMPACT_TIME = 0.44;
const SUMMON_AXE_DURATION = 0.57;
const DISMISS_AXE_DURATION = 0.57;
const GATEWAY_REPEL_DURATION = 0.5;
const GATEWAY_REPEL_SPEED = 2.2;
const GATEWAY_REPEL_COOLDOWN = 0.2;

export class Hero {
  static get modelUrl() {
    return heroModelUrl;
  }

  #pc;
  #mapData;
  #getViewRotation;
  #onPositionChange;
  #onFacingChange;
  #getGatewayRepulsion;
  #collisionWorld;
  #modelLibrary;
  #entity;
  #modelRoot;
  #axeEntity;
  #spawn;
  #position;
  #velocity = { x: 0, y: 0, z: 0 };
  #input = { x: 0, y: 0 };
  #running = false;
  #movementBlocked = false;
  #edgeRefusal = false;
  #grounded = true;
  #coyoteRemaining = COYOTE_TIME;
  #jumpBufferRemaining = 0;
  #jumpsUsed = 0;
  #accumulator = 0;
  #facingYaw = 0;
  #animationState = null;
  #restartAnimation = false;
  #idleElapsed = 0;
  #nextBoredAt = BORED_IDLE_DELAY;
  #boredAnimation = null;
  #boredRemaining = 0;
  #boredIndex = 0;
  #updateHandle = null;
  #cutAction = null;
  #repelAction = null;
  #gatewayRepelCooldown = 0;

  constructor({
    pc,
    app,
    mapData,
    getViewRotation,
    onPositionChange,
    onFacingChange,
    getGatewayRepulsion,
    collisionWorld,
    modelLibrary,
  }) {
    this.#pc = pc;
    this.#mapData = mapData;
    this.#getViewRotation = getViewRotation;
    this.#onPositionChange = onPositionChange;
    this.#onFacingChange = onFacingChange;
    this.#getGatewayRepulsion = getGatewayRepulsion;
    this.#collisionWorld = collisionWorld;
    this.#modelLibrary = modelLibrary;
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

  get position() {
    return { ...this.#position };
  }

  get isCutting() {
    return this.#cutAction !== null;
  }

  get facingDirection() {
    const yaw = (this.#facingYaw * Math.PI) / 180;
    return { x: Math.sin(yaw), z: Math.cos(yaw) };
  }

  setMovement(inputX, inputY, running = false) {
    this.#input.x = Math.max(-1, Math.min(1, inputX));
    this.#input.y = Math.max(-1, Math.min(1, inputY));
    this.#running = running;
    if (this.#input.x !== 0 || this.#input.y !== 0) {
      this.stopCutting({ dismiss: false });
    }
  }

  jump() {
    if (this.#cutAction || this.#repelAction) return;
    this.#jumpBufferRemaining = JUMP_BUFFER_TIME;
  }

  cut({ targetPosition, heightClass, onImpact, onComplete }) {
    if (!this.#grounded || this.#cutAction || this.#repelAction) return false;
    const animation = HERO_ANIMATION.cut[heightClass];
    if (!animation) return false;

    const targetX = targetPosition.x - this.#position.x;
    const targetZ = targetPosition.z - this.#position.z;
    if (Math.hypot(targetX, targetZ) > 0.001) {
      this.#facingYaw = (Math.atan2(targetX, targetZ) * 180) / Math.PI;
    }
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    this.#setAxeVisible(true);
    this.#cutAction = {
      cutAnimation: animation,
      phase: "summon",
      elapsed: 0,
      impacted: false,
      stopAfterCycle: false,
      onImpact,
      onComplete,
    };
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  stopCutting({ dismiss = true } = {}) {
    if (!this.#cutAction) return false;
    if (dismiss && this.#cutAction.phase !== "dismiss") {
      this.#cutAction.phase = "dismiss";
      this.#cutAction.elapsed = 0;
      this.#cutAction.impacted = false;
      this.#restartAnimation = true;
    } else {
      this.#finishCutAction();
    }
    return true;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#axeEntity = null;
    this.#animationState = null;
    this.#cutAction = null;
    this.#repelAction = null;
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
    this.#advanceCutAction(deltaTime);
    this.#advanceRepelAction(deltaTime);
    this.#gatewayRepelCooldown = Math.max(
      0,
      this.#gatewayRepelCooldown - deltaTime,
    );
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

    const desired = this.#cutAction
      ? { x: 0, z: 0 }
      : this.#repelAction
        ? {
            x: this.#repelAction.x * GATEWAY_REPEL_SPEED,
            z: this.#repelAction.z * GATEWAY_REPEL_SPEED,
          }
        : this.#desiredVelocity();
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
    if (
      !this.#cutAction &&
      !this.#repelAction &&
      this.#jumpBufferRemaining > 0 &&
      (canGroundJump || canAirJump)
    ) {
      this.#velocity.y = JUMP_VELOCITY;
      this.#grounded = false;
      this.#coyoteRemaining = 0;
      this.#jumpBufferRemaining = 0;
      this.#jumpsUsed += 1;
      this.#restartAnimation = true;
    }

    this.#movementBlocked = false;
    this.#edgeRefusal = false;
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

    const inputX = this.#input.x / Math.max(1, length);
    const inputY = this.#input.y / Math.max(1, length);
    const yaw = Math.PI / 4 + (this.#getViewRotation?.() ?? 0) * (Math.PI / 2);
    const projectedX = Math.cos(yaw) * inputX - Math.sin(yaw) * inputY;
    const projectedZ = -Math.sin(yaw) * inputX - Math.cos(yaw) * inputY;
    const axisDifference = Math.abs(projectedX) - Math.abs(projectedZ);
    const preferXOnTie = Math.abs(inputY) >= Math.abs(inputX);
    const useXAxis =
      Math.abs(axisDifference) < 0.000001
        ? preferXOnTie
        : axisDifference > 0;
    const speed = this.#running ? RUN_SPEED : MOVE_SPEED;
    return {
      x: useXAxis ? Math.sign(projectedX) * speed : 0,
      z: useXAxis ? 0 : Math.sign(projectedZ) * speed,
    };
  }

  #moveHorizontally(deltaTime) {
    const attemptedX = Math.abs(this.#velocity.x) > 0.001;
    const nextX = this.#position.x + this.#velocity.x * deltaTime;
    const occupancyX = this.#occupancyAt(nextX, this.#position.z);
    if (occupancyX === OCCUPANCY.open) {
      this.#position.x = nextX;
    } else {
      this.#movementBlocked ||= attemptedX;
      this.#edgeRefusal ||= attemptedX && occupancyX === OCCUPANCY.edge;
      this.#velocity.x = 0;
      if (attemptedX) this.#tryGatewayRepulsion(nextX, this.#position.z);
    }

    const attemptedZ = Math.abs(this.#velocity.z) > 0.001;
    const nextZ = this.#position.z + this.#velocity.z * deltaTime;
    const occupancyZ = this.#occupancyAt(this.#position.x, nextZ);
    if (occupancyZ === OCCUPANCY.open) {
      this.#position.z = nextZ;
    } else {
      this.#movementBlocked ||= attemptedZ;
      this.#edgeRefusal ||= attemptedZ && occupancyZ === OCCUPANCY.edge;
      this.#velocity.z = 0;
      if (attemptedZ) this.#tryGatewayRepulsion(this.#position.x, nextZ);
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
    }
  }

  #occupancyAt(x, z) {
    const collisionSurface = this.#collisionWorld?.surfaceHeightAt(x, z) ?? null;
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
          if (!this.#circleOverlapsTile(x, z, col, row, LEDGE_RADIUS)) {
            continue;
          }
          return OCCUPANCY.edge;
        }

        const type = this.#mapData.grid[row][col];
        const height = this.#mapData.heightmap[row][col];
        const isCollisionSurface = collisionSurface !== null;
        if (
          (!WALKABLE_TILES.has(type) && !isCollisionSurface) ||
          (!isCollisionSurface && height > this.#position.y + STEP_CLEARANCE)
        ) {
          const collisionRadius =
            type === TileType.WATER ? LEDGE_RADIUS : HERO_RADIUS;
          if (!this.#circleOverlapsTile(x, z, col, row, collisionRadius)) {
            continue;
          }
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
            currentDistance < collisionRadius ** 2 &&
            nextDistance > currentDistance
          ) {
            continue;
          }
          return type === TileType.WATER
            ? OCCUPANCY.edge
            : OCCUPANCY.blocked;
        }
      }
    }
    if (
      this.#collisionWorld?.isMovementBlocked(
        this.#position.x,
        this.#position.z,
        x,
        z,
        HERO_RADIUS,
        this.#position.y,
        STEP_CLEARANCE,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    return OCCUPANCY.open;
  }

  #circleOverlapsTile(x, z, col, row, radius = HERO_RADIUS) {
    return this.#circleDistanceSquaredToTile(x, z, col, row) < radius ** 2;
  }

  #circleDistanceSquaredToTile(x, z, col, row) {
    const tileX = col - (this.#mapData.cols - 1) / 2;
    const tileZ = row - (this.#mapData.rows - 1) / 2;
    const distanceX = Math.max(Math.abs(x - tileX) - 0.5, 0);
    const distanceZ = Math.max(Math.abs(z - tileZ) - 0.5, 0);
    return distanceX * distanceX + distanceZ * distanceZ;
  }

  #surfaceAt(x, z) {
    const collisionSurface = this.#collisionWorld?.surfaceHeightAt(x, z);
    if (Number.isFinite(collisionSurface)) return collisionSurface;
    const tile = this.#tileAt(x, z);
    if (!tile) return null;
    if (WALKABLE_TILES.has(tile.type)) return tile.height;
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
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        const elevation =
          this.#mapData.heightmap[row][col] + GRASS_SURFACE_LIFT;
        if (
          this.#collisionWorld?.isBlocked(
            x,
            z,
            HERO_RADIUS,
            elevation,
            STEP_CLEARANCE,
          )
        ) {
          continue;
        }
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
        y: this.#mapData.heightmap[tile.row][tile.col] + GRASS_SURFACE_LIFT,
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
        !WALKABLE_TILES.has(this.#mapData.grid[neighbourRow][neighbourCol]) ||
        this.#mapData.heightmap[neighbourRow][neighbourCol] > height
      ) {
        continue;
      }
      const x = neighbourCol - (this.#mapData.cols - 1) / 2;
      const z = neighbourRow - (this.#mapData.rows - 1) / 2;
      const type = this.#mapData.grid[neighbourRow][neighbourCol];
      const elevation =
        this.#mapData.heightmap[neighbourRow][neighbourCol] +
        (type === TileType.GRASS ? GRASS_SURFACE_LIFT : 0);
      if (
        this.#collisionWorld?.isBlocked(
          x,
          z,
          HERO_RADIUS,
          elevation,
          STEP_CLEARANCE,
        )
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
    this.#movementBlocked = false;
    this.#edgeRefusal = false;
    this.#repelAction = null;
    this.#gatewayRepelCooldown = 0;
    this.#restartAnimation = false;
    this.#resetBoredom();
  }

  #animate(deltaTime) {
    if (!this.#entity || !this.#modelRoot) return;
    const horizontalSpeed = Math.hypot(this.#velocity.x, this.#velocity.z);
    const blocked = this.#movementBlocked && horizontalSpeed <= 0.08;
    const refusingEdge = blocked && this.#edgeRefusal;
    const facingVelocity = blocked
      ? this.#desiredVelocity()
      : { x: this.#velocity.x, z: this.#velocity.z };
    const previousFacingYaw = this.#facingYaw;
    if (
      !this.#repelAction &&
      Math.hypot(facingVelocity.x, facingVelocity.z) > 0.08
    ) {
      const targetYaw =
        (Math.atan2(facingVelocity.x, facingVelocity.z) * 180) / Math.PI;
      this.#facingYaw = this.#lerpAngle(
        this.#facingYaw,
        targetYaw,
        Math.min(1, deltaTime * 14),
      );
    }
    this.#modelRoot.setLocalEulerAngles(0, this.#facingYaw, 0);
    if (Math.abs(this.#facingYaw - previousFacingYaw) > 0.001) {
      this.#onFacingChange?.(this.facingDirection);
    }

    let animation;
    let animationSpeed = 1;
    if (this.#cutAction) {
      animation = this.#cutAnimationName();
      this.#resetBoredom();
    } else if (this.#repelAction) {
      animation = HERO_ANIMATION.repelled;
      this.#resetBoredom();
    } else if (!this.#grounded) {
      animation = HERO_ANIMATION.jump;
      this.#resetBoredom();
    } else if (refusingEdge) {
      animation = HERO_ANIMATION.edge;
      this.#resetBoredom();
    } else if (blocked) {
      animation = HERO_ANIMATION.blocked;
      this.#resetBoredom();
    } else if (horizontalSpeed > 0.08) {
      animation = this.#running ? HERO_ANIMATION.run : HERO_ANIMATION.walk;
      const expectedSpeed = this.#running ? RUN_SPEED : MOVE_SPEED;
      animationSpeed = Math.max(
        0.75,
        Math.min(1.25, horizontalSpeed / expectedSpeed),
      );
      this.#resetBoredom();
    } else {
      animation = this.#selectIdleAnimation(deltaTime);
    }
    this.#playAnimation(animation, animationSpeed, this.#restartAnimation);
    this.#restartAnimation = false;
  }

  #selectIdleAnimation(deltaTime) {
    this.#idleElapsed += deltaTime;
    if (this.#boredAnimation) {
      this.#boredRemaining = Math.max(0, this.#boredRemaining - deltaTime);
      if (this.#boredRemaining > 0) return this.#boredAnimation;

      this.#boredAnimation = null;
      this.#nextBoredAt =
        this.#idleElapsed +
        BORED_BREAK_MIN +
        Math.random() * BORED_BREAK_VARIANCE;
      return HERO_ANIMATION.idle;
    }

    if (this.#idleElapsed < this.#nextBoredAt) return HERO_ANIMATION.idle;

    this.#boredAnimation = HERO_ANIMATION.bored[this.#boredIndex];
    this.#boredIndex = (this.#boredIndex + 1) % HERO_ANIMATION.bored.length;
    this.#boredRemaining = BORED_ANIMATION_DURATIONS[this.#boredAnimation];
    return this.#boredAnimation;
  }

  #resetBoredom() {
    this.#idleElapsed = 0;
    this.#nextBoredAt = BORED_IDLE_DELAY;
    this.#boredAnimation = null;
    this.#boredRemaining = 0;
  }

  #playAnimation(name, speed, restart) {
    const animation = this.#modelRoot.anim;
    if (!animation) return;
    animation.speed = speed;
    if (restart) {
      animation.baseLayer.play(name);
      this.#animationState = name;
      return;
    }
    if (this.#animationState === name) return;
    animation.baseLayer.transition(name, ANIMATION_BLEND_TIME);
    this.#animationState = name;
  }

  #createModel() {
    this.#modelRoot = this.#modelLibrary.instantiate(Hero.modelUrl);
    this.#modelRoot.name = "Hero model instance";
    this.#modelRoot.setLocalScale(
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
    );
    this.#entity.addChild(this.#modelRoot);
    this.#axeEntity = this.#findModelEntity("Hero axe");
    this.#setAxeVisible(false);

    const animationTracks = this.#modelLibrary.getAnimationTracks(
      Hero.modelUrl,
      HERO_ANIMATION_NAMES,
    );
    this.#modelRoot.addComponent("anim", { activate: true });
    for (const [name, track] of animationTracks) {
      if (!HERO_ANIMATION_NAMES.includes(name)) continue;
      this.#modelRoot.anim.addAnimationState(
        name,
        track,
        1,
        LOOPING_ANIMATIONS.has(name),
      );
    }
    this.#modelRoot.anim.baseLayer.play(HERO_ANIMATION.idle);
    this.#animationState = HERO_ANIMATION.idle;
  }

  #advanceCutAction(deltaTime) {
    if (!this.#cutAction) return;
    const action = this.#cutAction;
    action.elapsed += deltaTime;
    if (action.phase === "summon") {
      if (action.elapsed >= SUMMON_AXE_DURATION) {
        action.phase = "cut";
        action.elapsed = 0;
        this.#restartAnimation = true;
      }
      return;
    }
    if (action.phase === "dismiss") {
      if (action.elapsed >= DISMISS_AXE_DURATION) this.#finishCutAction();
      return;
    }
    if (!action.impacted && action.elapsed >= CUT_IMPACT_TIME) {
      action.impacted = true;
      action.stopAfterCycle = action.onImpact?.() === true;
    }
    if (action.elapsed < CUT_DURATION) return;

    if (!action.stopAfterCycle) {
      action.elapsed = 0;
      action.impacted = false;
      this.#restartAnimation = true;
      return;
    }

    action.phase = "dismiss";
    action.elapsed = 0;
    action.impacted = false;
    this.#restartAnimation = true;
  }

  #cutAnimationName() {
    if (this.#cutAction.phase === "summon") return HERO_ANIMATION.summonAxe;
    if (this.#cutAction.phase === "dismiss") {
      return HERO_ANIMATION.dismissAxe;
    }
    return this.#cutAction.cutAnimation;
  }

  #finishCutAction() {
    const action = this.#cutAction;
    if (!action) return;
    this.#cutAction = null;
    this.#setAxeVisible(false);
    this.#restartAnimation = true;
    action.onComplete?.();
  }

  #tryGatewayRepulsion(toX, toZ) {
    if (this.#repelAction || this.#gatewayRepelCooldown > 0) return false;
    const direction = this.#getGatewayRepulsion?.(
      this.#position.x,
      this.#position.z,
      toX,
      toZ,
      HERO_RADIUS,
    );
    if (!direction) return false;
    this.stopCutting({ dismiss: false });
    this.#repelAction = { ...direction, elapsed: 0 };
    this.#velocity.x = direction.x * GATEWAY_REPEL_SPEED;
    this.#velocity.z = direction.z * GATEWAY_REPEL_SPEED;
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  #advanceRepelAction(deltaTime) {
    if (!this.#repelAction) return;
    this.#repelAction.elapsed += deltaTime;
    if (this.#repelAction.elapsed < GATEWAY_REPEL_DURATION) return;
    this.#repelAction = null;
    this.#gatewayRepelCooldown = GATEWAY_REPEL_COOLDOWN;
    this.#restartAnimation = true;
  }

  #setAxeVisible(visible) {
    if (this.#axeEntity) this.#axeEntity.enabled = visible;
  }

  #findModelEntity(name) {
    const pending = [this.#modelRoot];
    while (pending.length) {
      const entity = pending.pop();
      if (entity.name === name) return entity;
      pending.push(...entity.children);
    }
    return null;
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
