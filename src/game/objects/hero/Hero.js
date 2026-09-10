import { TileType } from "../../MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import heroModelUrl from "../../models/hero/hero.glb?url";
import { HeroRespawnEffect } from "./HeroRespawnEffect.js";
import { FOOT_SIDE } from "../../enum/FootSide.js";
import { HERO_ANIMATION } from "../../enum/HeroAnimation.js";
import { OCCUPANCY } from "../../enum/Occupancy.js";
import { COIN_TYPE } from "../../enum/CoinType.js";
import { MOVEMENT_REFUSAL } from "../../enum/MovementRefusal.js";
import { HERO_INVENTORY_CAPACITY } from "../../config/inventory.js";

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
const MAX_SAFE_STEP_DOWN = 1 + GRASS_SURFACE_LIFT;
const DODGE_DISTANCE = 3;
const DODGE_JUMP_HEIGHT = 0.68;
const DODGE_JUMP_VELOCITY = Math.sqrt(-2 * GRAVITY * DODGE_JUMP_HEIGHT);
const DODGE_DURATION = (2 * DODGE_JUMP_VELOCITY) / -GRAVITY;
const DODGE_SPEED = DODGE_DISTANCE / DODGE_DURATION;
const DODGE_ANIMATION_DURATION = 0.6;
const DODGE_REQUIRED_RUNWAY = 1;
const MAX_JUMPS = 2;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.12;
const MAX_LIVES = 3;
const RESPAWN_ANIMATION_DURATION = 1.55;
const RESPAWN_START_HEIGHT = 1;
const STEP_CLEARANCE = 0.22;
const ANIMATION_BLEND_TIME = 0.14;
const BLOCKED_PUSH_DURATION = 1;
const BORED_IDLE_DELAY = 5;
const BORED_BREAK_MIN = 2.5;
const BORED_BREAK_VARIANCE = 2;
const HEAD_LOOK_MAX_YAW = 55;
const HEAD_LOOK_RESPONSE = 7;
const HERO_ANIMATION_NAMES = Object.freeze(Object.values(HERO_ANIMATION));
const HERO_BORED_ANIMATIONS = Object.freeze([
  HERO_ANIMATION.BORED_CURSOR_LOOK,
  HERO_ANIMATION.BORED_LOOK,
  HERO_ANIMATION.BORED_STRETCH,
  HERO_ANIMATION.BORED_TAP,
]);
const LOOPING_ANIMATIONS = new Set([
  HERO_ANIMATION.IDLE,
  HERO_ANIMATION.WALK,
  HERO_ANIMATION.RUN,
  HERO_ANIMATION.BLOCKED_PUSH,
]);
const BORED_ANIMATION_DURATIONS = new Map([
  [HERO_ANIMATION.BORED_CURSOR_LOOK, 3],
  [HERO_ANIMATION.BORED_LOOK, 3],
  [HERO_ANIMATION.BORED_STRETCH, 3.5],
  [HERO_ANIMATION.BORED_TAP, 3],
]);
// Matches the widest part of the hero below one terrain level. The circle is
// still slightly narrower than a tile, leaving room to slide along ledges.
const HERO_RADIUS = 0.46;
// Terrain and scenery clearance follows the hero's planted lower body. Wider
// arm and shoulder poses are visual only and must not close valid footpaths.
const MOVEMENT_COLLISION_RADIUS = 0.18;
// Raised terrain must also clear the torso around exposed corners. This stays
// below half a tile so a one-tile corridor remains traversable.
const TERRAIN_BODY_COLLISION_RADIUS = 0.4;
const MOVEMENT_FORWARD_COLLISION_OFFSET =
  HERO_RADIUS - MOVEMENT_COLLISION_RADIUS;
// BlockedPush leans the upper body forward beyond the standing footprint.
// Reserve that depth and head width only in front of raised terrain; keeping
// the probe below half a tile leaves one-tile corridors open.
const TERRAIN_FORWARD_COLLISION_OFFSET = 0.48;
const TERRAIN_FORWARD_COLLISION_RADIUS = 0.36;
const COLLISION_DISTANCE_EPSILON = 0.000001;
// Ledge checks follow the hero's planted feet instead of the widest parts of
// the model. This lets the hero approach a drop before refusing to step off.
const LEDGE_RADIUS = 0.27;
const FOOT_FORWARD_OFFSET = 0.1;
const FOOT_LATERAL_OFFSET = 0.13;
// Slightly inset from the authored boot sole (0.19 x 0.12 at game scale) so
// tiny visual corner overhangs remain usable while half-sole overhangs do not.
const FOOT_HALF_LENGTH = 0.18;
const FOOT_HALF_WIDTH = 0.11;
const FOOT_REQUIRED_PERIMETER_SUPPORTS = 5;
const EDGE_REFUSAL_DURATION = 0.8;
const HOLE_REFUSAL_DURATION = 1.45;
const INVENTORY_FULL_COLLAPSE_DURATION = 52 / 24;
const INVENTORY_FULL_EFFECT_TIME = 14 / 24;
const INVENTORY_FULL_INDICATOR_CLEARANCE = 0.82;
const HOLE_LOOK_DOWN_ANGLE = 27;
const HOLE_HEAD_SHAKE_ANGLE = 18;
const LANDING_BACKTRACK_STEP = 0.025;
const LANDING_BACKTRACK_DISTANCE = 0.75;
const LANDING_FORWARD_SETTLE_DISTANCE =
  FOOT_FORWARD_OFFSET + FOOT_HALF_LENGTH;
const FALL_EXIT_HEIGHT = -14;
// Keeps the widest pose, including the pauldron and its outline, within one
// 1x1 terrain/path cube.
const HERO_MODEL_SCALE = 0.65;
// Castle foundation cells render as grass. The castle collision world owns the
// exact wall, door, stair, and furniture footprints, so open foundation ground
// must remain traversable instead of treating the whole rectangle as a wall.
const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.ENTRY,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
const GRASS_SURFACE_TILES = new Set([
  TileType.GRASS,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
// Only castle floor and stair surfaces may replace the terrain height beneath
// their footprint. Vegetation surfaces can overlap a neighbouring terrain
// tile, but must never make that tile's cliff face traversable.
const STRUCTURE_SURFACE_TILES = new Set([
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
const GATEWAY_REPEL_DURATION = 0.5;
const GATEWAY_REPEL_SPEED = 2.2;
const GATEWAY_REPEL_COOLDOWN = 0.2;
const PICK_FLOWER_DURATION = 36 / 24;
const PICK_FLOWER_IMPACT_TIME = 14 / 24;
const PICK_FLOWER_HIDE_TIME = 31 / 24;
const PICKUP_POSITIONING_DURATION = 0.24;
const PICK_FLOWER_MINIMUM_DISTANCE = 0.52;
const PICK_FLOWER_MAXIMUM_DISTANCE = 0.68;
const PICK_FLOWER_RADIUS_CLEARANCE = 0.28;
const PICK_FLOWER_MAXIMUM_FORWARD_STEP = 0.22;
const PICK_FLOWER_MAXIMUM_BACKWARD_STEP = PICK_FLOWER_MAXIMUM_DISTANCE;
const PICK_MUSHROOM_DURATION = 40 / 24;
const PICK_MUSHROOM_IMPACT_TIME = 18 / 24;
const PICK_MUSHROOM_HIDE_TIME = 35 / 24;
const PICK_MUSHROOM_TARGET_DISTANCE = 0.34;
const PICK_MUSHROOM_MAXIMUM_STEP = 0.24;

export class Hero {
  static get modelUrl() {
    return heroModelUrl;
  }

  static get inventoryCapacity() {
    return HERO_INVENTORY_CAPACITY;
  }

  #pc;
  #mapData;
  #spawnCenter;
  #getViewRotation;
  #onPositionChange;
  #onFacingChange;
  #onStateChange;
  #getGatewayRepulsion;
  #collisionWorld;
  #modelLibrary;
  #entity;
  #modelRoot;
  #headEntity;
  #toolAttachmentEntity;
  #rightHeldItemAttachmentEntity;
  #leftHeldItemAttachmentEntity;
  #spawn;
  #position;
  #velocity = { x: 0, y: 0, z: 0 };
  #input = { x: 0, y: 0 };
  #running = false;
  #movementBlocked = false;
  #blockedPushElapsed = 0;
  #blockedPushFinished = false;
  #edgeRefusalAction = null;
  #holeRefusalAction = null;
  #holeRefusalAcknowledged = false;
  #holeMovementBlocked = false;
  #lastEdgeRefusalFoot = FOOT_SIDE.RIGHT;
  #stableGroundPosition;
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
  #idleLookTarget = null;
  #headLookYaw = 0;
  #updateHandle = null;
  #toolAction = null;
  #collectAction = null;
  #inventoryFullAction = null;
  #tool = null;
  #repelAction = null;
  #dodgeAction = null;
  #respawnAction = null;
  #respawnEffect = null;
  #fallingToDeath = false;
  #lives = MAX_LIVES;
  #gameOver = false;
  #gatewayRepelCooldown = 0;
  #wallet = {
    [COIN_TYPE.GOLD]: 0,
    [COIN_TYPE.SILVER]: 0,
    [COIN_TYPE.COPPER]: 0,
  };
  #inventory;
  #onInventoryFull;

  constructor({
    pc,
    app,
    mapData,
    spawnCenter = { x: 0, z: 0 },
    getViewRotation,
    onPositionChange,
    onFacingChange,
    onStateChange,
    onInventoryFull,
    inventory,
    getGatewayRepulsion,
    collisionWorld,
    modelLibrary,
  }) {
    this.#pc = pc;
    this.#mapData = mapData;
    this.#spawnCenter = spawnCenter;
    this.#getViewRotation = getViewRotation;
    this.#onPositionChange = onPositionChange;
    this.#onFacingChange = onFacingChange;
    this.#onStateChange = onStateChange;
    this.#inventory = inventory;
    this.#onInventoryFull = onInventoryFull;
    this.#getGatewayRepulsion = getGatewayRepulsion;
    this.#collisionWorld = collisionWorld;
    this.#modelLibrary = modelLibrary;
    this.#entity = new pc.Entity("Hero");
    this.#spawn = this.#findSpawn();
    this.#position = { ...this.#spawn };
    this.#stableGroundPosition = { ...this.#spawn };
    this.#facingYaw = this.#initialFacingYaw();
    this.#entity.setLocalPosition(
      this.#position.x,
      this.#position.y,
      this.#position.z,
    );

    this.#createModel();
    this.#updateHandle = app.on("update", this.#update);
    this.#emitState();
  }

  get entity() {
    return this.#entity;
  }

  get position() {
    return { ...this.#position };
  }

  get isUsingTool() {
    return this.#toolAction !== null;
  }

  get isCollecting() {
    return this.#collectAction !== null;
  }

  get isRefusingInventoryPickup() {
    return this.#inventoryFullAction !== null;
  }

  get tool() {
    return this.#tool;
  }

  get wallet() {
    return { ...this.#wallet };
  }

  get inventory() {
    return {
      capacity: this.#inventory.inventory.capacity,
      items: this.#inventory.inventory.items.map((item) => ({ ...item })),
    };
  }

  get inventoryFull() {
    return (
      this.#inventory.inventory.items.length >=
      this.#inventory.inventory.capacity
    );
  }

  get inventoryFullIndicatorPosition() {
    const anchor = this.#headEntity?.getPosition() ?? this.#entity.getPosition();
    return {
      x: anchor.x,
      y: anchor.y + INVENTORY_FULL_INDICATOR_CLEARANCE,
      z: anchor.z,
    };
  }

  get isGameOver() {
    return this.#gameOver;
  }

  get animationState() {
    return this.#animationState;
  }

  get animationTransitioning() {
    return this.#modelRoot?.anim?.baseLayer.transitioning ?? false;
  }

  get headLookYaw() {
    return this.#headLookYaw;
  }

  get grounded() {
    return this.#grounded;
  }

  get isInDeathSequence() {
    return this.#fallingToDeath || this.#respawnAction !== null;
  }

  get facingDirection() {
    const yaw = (this.#facingYaw * Math.PI) / 180;
    return { x: Math.sin(yaw), z: Math.cos(yaw) };
  }

  get movementState() {
    const speed = Math.hypot(this.#velocity.x, this.#velocity.z);
    return {
      direction:
        speed > 0.001
          ? { x: this.#velocity.x / speed, z: this.#velocity.z / speed }
          : this.facingDirection,
      speed,
      running: this.#running && this.#grounded && speed > 0.08,
    };
  }

  setMovement(inputX, inputY, running = false) {
    this.#input.x = Math.max(-1, Math.min(1, inputX));
    this.#input.y = Math.max(-1, Math.min(1, inputY));
    this.#running = running;
    if (
      !this.#hasMovementInput &&
      this.#animationState === HERO_ANIMATION.BLOCKED_PUSH
    ) {
      this.#movementBlocked = false;
      this.#blockedPushElapsed = 0;
      this.#blockedPushFinished = false;
      this.#velocity.x = 0;
      this.#velocity.z = 0;
      this.#resetBoredom();
      this.#playAnimation(HERO_ANIMATION.IDLE, 1, true);
      this.#restartAnimation = false;
    }
    if (!this.#hasMovementInput) {
      this.#holeRefusalAcknowledged = false;
    }
    if (
      !this.#gameOver &&
      this.#hasMovementInput
    ) {
      this.stopUsingTool({ dismiss: false });
    }
  }

  jump() {
    if (
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#holeRefusalAction
    ) {
      return;
    }
    if (this.#edgeRefusalAction) {
      this.#edgeRefusalAction = null;
      this.#restartAnimation = true;
    }
    this.#jumpBufferRemaining = JUMP_BUFFER_TIME;
  }

  set idleLookTarget(target) {
    this.#idleLookTarget = target ? { x: target.x, z: target.z } : null;
  }

  dodge(inputX, inputY, direction) {
    if (
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction
    ) {
      return false;
    }
    const projected = this.#projectInput(inputX, inputY);
    if (!projected) {
      return false;
    }
    const runwaySurface = this.#surfaceAt(
      this.#position.x + projected.x * DODGE_REQUIRED_RUNWAY,
      this.#position.z + projected.z * DODGE_REQUIRED_RUNWAY,
    );
    if (runwaySurface === null) {
      return false;
    }

    this.#velocity.x = projected.x * DODGE_SPEED;
    this.#velocity.y = DODGE_JUMP_VELOCITY;
    this.#velocity.z = projected.z * DODGE_SPEED;
    this.#grounded = false;
    this.#coyoteRemaining = 0;
    this.#jumpBufferRemaining = 0;
    this.#jumpsUsed = 1;
    this.#dodgeAction = {
      direction,
      x: projected.x,
      z: projected.z,
      facing: this.#dodgeFacingDirection(direction, projected),
      elapsed: 0,
      crossedLedge: false,
    };
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  useTool(
    tool,
    {
      targetPosition,
      context = {},
      onImpact,
      onComplete,
    },
  ) {
    const useAnimation = tool?.useAnimation(context);
    if (
      !tool ||
      !useAnimation ||
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction
    ) {
      return false;
    }

    const targetX = targetPosition.x - this.#position.x;
    const targetZ = targetPosition.z - this.#position.z;
    if (Math.hypot(targetX, targetZ) > 0.001) {
      this.#facingYaw = (Math.atan2(targetX, targetZ) * 180) / Math.PI;
    }
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    tool.mount(this.#toolAttachmentEntity);
    tool.visible = true;
    this.#tool = tool;
    this.#toolAction = {
      useAnimation,
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

  collectGroundCover(
    category,
    {
      targetPosition,
      targetRadius = 0,
      tool = null,
      heldItem = null,
      onImpact,
      onComplete,
    },
  ) {
    if (
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#dodgeAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction
    ) {
      return false;
    }

    const targetX = targetPosition.x - this.#position.x;
    const targetZ = targetPosition.z - this.#position.z;
    const targetDistance = Math.hypot(targetX, targetZ);
    if (targetDistance > 0.001) {
      this.#facingYaw = (Math.atan2(targetX, targetZ) * 180) / Math.PI;
    }
    const picksMushroom = category === "mushroom";
    const collectionTool = picksMushroom ? tool : null;
    if (picksMushroom && !collectionTool) {
      return false;
    }
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    if (collectionTool) {
      collectionTool.mount(this.#toolAttachmentEntity);
      collectionTool.visible = true;
    }
    const positioning = this.#collectionPositioning({
      picksMushroom,
      targetPosition,
      targetRadius,
      targetDistance,
    });
    this.#collectAction = {
      animation: picksMushroom
        ? HERO_ANIMATION.PICK_MUSHROOM
        : HERO_ANIMATION.PICK_FLOWER,
      duration: picksMushroom
        ? PICK_MUSHROOM_DURATION
        : PICK_FLOWER_DURATION,
      impactTime: picksMushroom
        ? PICK_MUSHROOM_IMPACT_TIME
        : PICK_FLOWER_IMPACT_TIME,
      elapsed: 0,
      impacted: false,
      positioning,
      positioningElapsed: 0,
      tool: collectionTool,
      heldItem,
      heldItemAttachmentEntity: picksMushroom
        ? this.#leftHeldItemAttachmentEntity
        : this.#rightHeldItemAttachmentEntity,
      heldItemHideTime: picksMushroom
        ? PICK_MUSHROOM_HIDE_TIME
        : PICK_FLOWER_HIDE_TIME,
      onImpact,
      onComplete,
    };
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  collectCoin(type, amount = 1) {
    if (!Object.hasOwn(this.#wallet, type)) {
      return false;
    }
    this.#wallet[type] += Math.max(0, Math.floor(amount));
    this.#emitState();
    return true;
  }

  collectInventoryItem(item) {
    if (!this.#inventory.addInventoryItem(item)) {
      this.#onInventoryFull?.(this.inventory);
      return false;
    }

    this.#emitState();
    return true;
  }

  refuseInventoryPickup(
    category,
    {
      targetPosition = null,
      targetRadius = 0,
      onComplete = null,
    } = {},
  ) {
    if (
      !this.inventoryFull ||
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#dodgeAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction
    ) {
      return false;
    }
    let positioning = null;
    if (targetPosition) {
      const targetX = targetPosition.x - this.#position.x;
      const targetZ = targetPosition.z - this.#position.z;
      const targetDistance = Math.hypot(targetX, targetZ);
      if (targetDistance > 0.001) {
        this.#facingYaw = (Math.atan2(targetX, targetZ) * 180) / Math.PI;
      }
      positioning = this.#collectionPositioning({
        picksMushroom: category === "mushroom",
        targetPosition,
        targetRadius,
        targetDistance,
      });
    }
    this.#inventoryFullAction = {
      elapsed: 0,
      notified: false,
      positioning,
      positioningElapsed: 0,
      onComplete,
    };
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  #dodgeAnimationName(direction) {
    switch (direction) {
      case "up":
        return HERO_ANIMATION.DODGE_FORWARD;
      case "down":
        return HERO_ANIMATION.DODGE_BACKWARD;
      case "left":
        return HERO_ANIMATION.DODGE_LEFT;
      case "right":
        return HERO_ANIMATION.DODGE_RIGHT;
      default:
        return HERO_ANIMATION.DODGE_FORWARD;
    }
  }

  #dodgeFacingDirection(direction, movementDirection) {
    if (direction !== "left" && direction !== "right") {
      return movementDirection;
    }
    return this.#projectInput(0, 1) ?? movementDirection;
  }

  #edgeRefusalAnimationName(foot) {
    return foot === FOOT_SIDE.RIGHT
      ? HERO_ANIMATION.EDGE_REFUSE_RIGHT
      : HERO_ANIMATION.EDGE_REFUSE_LEFT;
  }

  stopUsingTool({ dismiss = true } = {}) {
    if (!this.#toolAction) {
      return false;
    }
    if (dismiss && this.#toolAction.phase !== "dismiss") {
      this.#toolAction.phase = "dismiss";
      this.#toolAction.elapsed = 0;
      this.#toolAction.impacted = false;
      this.#restartAnimation = true;
    } else {
      this.#finishToolAction();
    }
    return true;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#respawnEffect?.destroy();
    this.#respawnEffect = null;
    if (this.#collectAction?.tool) {
      this.#collectAction.tool.visible = false;
    }
    this.#collectAction?.heldItem?.destroy();
    this.#entity?.destroy();
    this.#entity = null;
    this.#headEntity = null;
    this.#toolAttachmentEntity = null;
    this.#rightHeldItemAttachmentEntity = null;
    this.#leftHeldItemAttachmentEntity = null;
    this.#animationState = null;
    this.#toolAction = null;
    this.#collectAction = null;
    this.#inventoryFullAction = null;
    this.#tool = null;
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#respawnAction = null;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#stableGroundPosition = null;
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
    if (this.#gameOver) {
      return;
    }
    const previousX = this.#position.x;
    const previousY = this.#position.y;
    const previousZ = this.#position.z;
    this.#advanceToolAction(deltaTime);
    this.#advanceCollectAction(deltaTime);
    this.#advanceInventoryFullAction(deltaTime);
    this.#advanceRepelAction(deltaTime);
    this.#advanceDodgeAction(deltaTime);
    this.#advanceRespawnAction(deltaTime);
    this.#advanceEdgeRefusalAction(deltaTime);
    this.#advanceHoleRefusalAction(deltaTime);
    this.#gatewayRepelCooldown = Math.max(
      0,
      this.#gatewayRepelCooldown - deltaTime,
    );
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

    const desired = this.#respawnAction
      ? { x: 0, z: 0 }
      : this.#fallingToDeath
        ? { x: this.#velocity.x, z: this.#velocity.z }
        : this.#edgeRefusalAction || this.#holeRefusalAction
          ? { x: 0, z: 0 }
          : this.#toolAction ||
              this.#collectAction ||
              this.#inventoryFullAction
            ? { x: 0, z: 0 }
            : this.#repelAction
              ? {
                  x: this.#repelAction.x * GATEWAY_REPEL_SPEED,
                  z: this.#repelAction.z * GATEWAY_REPEL_SPEED,
                }
              : this.#dodgeAction
                ? {
                    x: this.#dodgeAction.x * DODGE_SPEED,
                    z: this.#dodgeAction.z * DODGE_SPEED,
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
      !this.#respawnAction &&
      !this.#fallingToDeath &&
      !this.#toolAction &&
      !this.#collectAction &&
      !this.#inventoryFullAction &&
      !this.#repelAction &&
      this.#jumpBufferRemaining > 0 &&
      (canGroundJump || canAirJump)
    ) {
      if (canGroundJump && moving) {
        this.#velocity.x = desired.x;
        this.#velocity.z = desired.z;
      }
      this.#velocity.y = JUMP_VELOCITY;
      this.#grounded = false;
      this.#coyoteRemaining = 0;
      this.#jumpBufferRemaining = 0;
      this.#jumpsUsed += 1;
      this.#restartAnimation = true;
    }

    this.#movementBlocked = false;
    this.#holeMovementBlocked = false;
    this.#moveHorizontally(deltaTime);
    this.#moveVertically(deltaTime);
    this.#advanceBlockedPush(deltaTime);

    if (this.#position.y < FALL_EXIT_HEIGHT) this.#handleFallDeath();
    this.#entity.setLocalPosition(
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
    const projected = this.#projectInput(this.#input.x, this.#input.y);
    if (!projected) {
      return { x: 0, z: 0 };
    }
    const speed = this.#running ? RUN_SPEED : MOVE_SPEED;
    return {
      x: projected.x * speed,
      z: projected.z * speed,
    };
  }

  #projectInput(inputX, inputY) {
    const length = Math.hypot(inputX, inputY);
    if (length < 0.001) {
      return null;
    }

    const normalizedX = inputX / Math.max(1, length);
    const normalizedY = inputY / Math.max(1, length);
    const yaw = Math.PI / 4 + (this.#getViewRotation?.() ?? 0) * (Math.PI / 2);
    const projectedX =
      Math.cos(yaw) * normalizedX - Math.sin(yaw) * normalizedY;
    const projectedZ =
      -Math.sin(yaw) * normalizedX - Math.cos(yaw) * normalizedY;
    const axisDifference = Math.abs(projectedX) - Math.abs(projectedZ);
    const preferXOnTie = Math.abs(normalizedY) >= Math.abs(normalizedX);
    const useXAxis =
      Math.abs(axisDifference) < 0.000001
        ? preferXOnTie
        : axisDifference > 0;
    return {
      x: useXAxis ? Math.sign(projectedX) : 0,
      z: useXAxis ? 0 : Math.sign(projectedZ),
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
      if (attemptedX) {
        this.#tryMovementRefusal(nextX, this.#position.z);
      }
      if (attemptedX && occupancyX === OCCUPANCY.edge) {
        const direction = this.#movementDirection;
        this.#beginEdgeRefusal(
          this.#unsupportedFootAt(
            nextX,
            this.#position.z,
            this.#position.y,
            direction,
          ) ?? this.#alternateEdgeFoot,
          direction,
        );
      }
      if (!this.#preservesRisingMomentum(occupancyX)) {
        this.#velocity.x = 0;
      }
      if (attemptedX) this.#tryGatewayRepulsion(nextX, this.#position.z);
    }

    const attemptedZ = Math.abs(this.#velocity.z) > 0.001;
    const nextZ = this.#position.z + this.#velocity.z * deltaTime;
    const occupancyZ = this.#occupancyAt(this.#position.x, nextZ);
    if (occupancyZ === OCCUPANCY.open) {
      this.#position.z = nextZ;
    } else {
      this.#movementBlocked ||= attemptedZ;
      if (attemptedZ) {
        this.#tryMovementRefusal(this.#position.x, nextZ);
      }
      if (attemptedZ && occupancyZ === OCCUPANCY.edge) {
        const direction = this.#movementDirection;
        this.#beginEdgeRefusal(
          this.#unsupportedFootAt(
            this.#position.x,
            nextZ,
            this.#position.y,
            direction,
          ) ?? this.#alternateEdgeFoot,
          direction,
        );
      }
      if (!this.#preservesRisingMomentum(occupancyZ)) {
        this.#velocity.z = 0;
      }
      if (attemptedZ) this.#tryGatewayRepulsion(this.#position.x, nextZ);
    }
  }

  #moveVertically(deltaTime) {
    const ground = this.#fallingToDeath
      ? null
      : this.#landingSurfaceAt(this.#position.x, this.#position.z);
    if (ground === null && this.#dodgeAction) {
      this.#dodgeAction.crossedLedge = true;
    }
    if (
      ground === null &&
      !this.#fallingToDeath &&
      !this.#dodgeAction &&
      (this.#isBeyondMapEdge(this.#position.x, this.#position.z) ||
        (!this.#grounded &&
          this.#velocity.y <= 0 &&
          this.#position.y <
            (this.#stableGroundPosition?.y ?? this.#spawn.y) -
              STEP_CLEARANCE))
    ) {
      this.#beginFallDeath();
    }
    if (
      this.#grounded &&
      ground !== null &&
      Math.abs(ground - this.#position.y) <= STEP_CLEARANCE
    ) {
      this.#position.y = ground;
      this.#velocity.y = 0;
      this.#rememberStableGroundPosition();
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
      if (this.#rejectUnsupportedLanding(ground)) {
        return;
      }
      this.#position.y = ground;
      this.#velocity.y = 0;
      this.#grounded = true;
      this.#jumpsUsed = 0;
      this.#rememberStableGroundPosition();
    }
  }

  #preservesRisingMomentum(occupancy) {
    return (
      occupancy === OCCUPANCY.blocked &&
      !this.#grounded &&
      this.#velocity.y > 0
    );
  }

  #advanceBlockedPush(deltaTime) {
    const blocked =
      this.#hasMovementInput &&
      this.#movementBlocked &&
      !this.#holeMovementBlocked &&
      Math.hypot(this.#velocity.x, this.#velocity.z) <= 0.08;
    if (!blocked) {
      this.#blockedPushElapsed = 0;
      this.#blockedPushFinished = false;
      return;
    }
    if (this.#blockedPushFinished) {
      return;
    }
    this.#blockedPushElapsed = Math.min(
      BLOCKED_PUSH_DURATION,
      this.#blockedPushElapsed + deltaTime,
    );
    this.#blockedPushFinished =
      this.#blockedPushElapsed >= BLOCKED_PUSH_DURATION;
  }

  #occupancyAt(x, z) {
    const movementLength = Math.hypot(this.#velocity.x, this.#velocity.z);
    const facing =
      movementLength > 0.001
        ? {
            x: this.#velocity.x / movementLength,
            z: this.#velocity.z / movementLength,
          }
        : this.facingDirection;
    const terrainOccupancy = this.#terrainOccupancyAt(
      this.#position.x,
      this.#position.z,
      x,
      z,
      this.#grounded,
      TERRAIN_BODY_COLLISION_RADIUS,
    );
    if (terrainOccupancy !== OCCUPANCY.open) {
      return terrainOccupancy;
    }
    const terrainForwardFromX =
      this.#position.x + facing.x * TERRAIN_FORWARD_COLLISION_OFFSET;
    const terrainForwardFromZ =
      this.#position.z + facing.z * TERRAIN_FORWARD_COLLISION_OFFSET;
    const terrainForwardToX =
      x + facing.x * TERRAIN_FORWARD_COLLISION_OFFSET;
    const terrainForwardToZ =
      z + facing.z * TERRAIN_FORWARD_COLLISION_OFFSET;
    const forwardTerrainOccupancy = this.#terrainOccupancyAt(
      terrainForwardFromX,
      terrainForwardFromZ,
      terrainForwardToX,
      terrainForwardToZ,
      false,
      TERRAIN_FORWARD_COLLISION_RADIUS,
    );
    if (forwardTerrainOccupancy !== OCCUPANCY.open) {
      return OCCUPANCY.blocked;
    }
    const movementForwardFromX =
      this.#position.x + facing.x * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const movementForwardFromZ =
      this.#position.z + facing.z * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const movementForwardToX =
      x + facing.x * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const movementForwardToZ =
      z + facing.z * MOVEMENT_FORWARD_COLLISION_OFFSET;
    if (
      this.#collisionWorld?.isMovementBlocked(
        this.#position.x,
        this.#position.z,
        x,
        z,
        MOVEMENT_COLLISION_RADIUS,
        this.#position.y,
        STEP_CLEARANCE,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    if (
      this.#collisionWorld?.isMovementBlocked(
        movementForwardFromX,
        movementForwardFromZ,
        movementForwardToX,
        movementForwardToZ,
        MOVEMENT_COLLISION_RADIUS,
        this.#position.y,
        STEP_CLEARANCE,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    if (
      this.#grounded &&
      !this.#dodgeAction &&
      !this.#repelAction &&
      this.#unsupportedFootAt(
        x,
        z,
        this.#position.y,
        facing,
      ) &&
      !this.#isSafeDescentAt(x, z, this.#position.y, facing) &&
      !this.#fullySupportedPositionAhead(
        x,
        z,
        this.#position.y,
        facing,
      )
    ) {
      return OCCUPANCY.edge;
    }
    return OCCUPANCY.open;
  }

  #terrainOccupancyAt(
    fromX,
    fromZ,
    toX,
    toZ,
    checksEdges,
    solidRadius,
  ) {
    const collisionSurface =
      this.#collisionWorld?.surfaceHeightAt(toX, toZ) ?? null;
    const gridX = toX + (this.#mapData.cols - 1) / 2;
    const gridZ = toZ + (this.#mapData.rows - 1) / 2;
    const searchRadius = Math.max(LEDGE_RADIUS, solidRadius);
    const firstCol = Math.floor(gridX - searchRadius + 0.5);
    const lastCol = Math.floor(gridX + searchRadius + 0.5);
    const firstRow = Math.floor(gridZ - searchRadius + 0.5);
    const lastRow = Math.floor(gridZ + searchRadius + 0.5);
    let currentSolidDistance = Number.POSITIVE_INFINITY;
    let nextSolidDistance = Number.POSITIVE_INFINITY;
    let currentEdgeDistance = Number.POSITIVE_INFINITY;
    let nextEdgeDistance = Number.POSITIVE_INFINITY;

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let col = firstCol; col <= lastCol; col += 1) {
        if (
          col < 0 ||
          row < 0 ||
          col >= this.#mapData.cols ||
          row >= this.#mapData.rows
        ) {
          if (
            !checksEdges ||
            this.#dodgeAction ||
            this.#fallingToDeath
          ) {
            continue;
          }
          currentEdgeDistance = Math.min(
            currentEdgeDistance,
            this.#circleDistanceSquaredToTile(fromX, fromZ, col, row),
          );
          nextEdgeDistance = Math.min(
            nextEdgeDistance,
            this.#circleDistanceSquaredToTile(toX, toZ, col, row),
          );
          continue;
        }

        const type = this.#mapData.grid[row][col];
        if (!checksEdges && type === TileType.WATER) {
          continue;
        }
        const height = this.#mapData.heightmap[row][col];
        const isStructureSurface =
          collisionSurface !== null && STRUCTURE_SURFACE_TILES.has(type);
        if (
          !WALKABLE_TILES.has(type) ||
          (!isStructureSurface &&
            height > this.#position.y + STEP_CLEARANCE)
        ) {
          const isEdge = type === TileType.WATER;
          if (isEdge && this.#dodgeAction) {
            continue;
          }
          const currentDistance = this.#circleDistanceSquaredToTile(
            fromX,
            fromZ,
            col,
            row,
          );
          const nextDistance = this.#circleDistanceSquaredToTile(
            toX,
            toZ,
            col,
            row,
          );
          if (isEdge) {
            currentEdgeDistance = Math.min(
              currentEdgeDistance,
              currentDistance,
            );
            nextEdgeDistance = Math.min(nextEdgeDistance, nextDistance);
          } else {
            currentSolidDistance = Math.min(
              currentSolidDistance,
              currentDistance,
            );
            nextSolidDistance = Math.min(nextSolidDistance, nextDistance);
          }
        }
      }
    }
    if (
      this.#blocksTerrainMovement(
        currentSolidDistance,
        nextSolidDistance,
        solidRadius,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    if (
      this.#blocksTerrainMovement(
        currentEdgeDistance,
        nextEdgeDistance,
        LEDGE_RADIUS,
      )
    ) {
      return OCCUPANCY.edge;
    }
    return OCCUPANCY.open;
  }

  #blocksTerrainMovement(currentDistance, nextDistance, radius) {
    if (nextDistance >= radius ** 2) {
      return false;
    }
    return !(
      currentDistance < radius ** 2 &&
      nextDistance >= currentDistance - COLLISION_DISTANCE_EPSILON
    );
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
    const maximumSupportHeight = this.#position.y + STEP_CLEARANCE;
    const collisionSurface = this.#collisionWorld?.surfaceHeightAt(
      x,
      z,
      LEDGE_RADIUS,
    );
    let highestSurface =
      Number.isFinite(collisionSurface) &&
      collisionSurface <= maximumSupportHeight
        ? collisionSurface
        : null;
    const gridX = x + (this.#mapData.cols - 1) / 2;
    const gridZ = z + (this.#mapData.rows - 1) / 2;
    const firstCol = Math.floor(gridX - LEDGE_RADIUS + 0.5);
    const lastCol = Math.floor(gridX + LEDGE_RADIUS + 0.5);
    const firstRow = Math.floor(gridZ - LEDGE_RADIUS + 0.5);
    const lastRow = Math.floor(gridZ + LEDGE_RADIUS + 0.5);

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let col = firstCol; col <= lastCol; col += 1) {
        if (
          col < 0 ||
          row < 0 ||
          col >= this.#mapData.cols ||
          row >= this.#mapData.rows ||
          !this.#circleOverlapsTile(x, z, col, row, LEDGE_RADIUS)
        ) {
          continue;
        }
        const type = this.#mapData.grid[row][col];
        if (!WALKABLE_TILES.has(type)) {
          continue;
        }
        const surfaceHeight =
          this.#mapData.heightmap[row][col] +
          (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0);
        if (
          surfaceHeight > maximumSupportHeight ||
          (highestSurface !== null && surfaceHeight <= highestSurface)
        ) {
          continue;
        }
        highestSurface = surfaceHeight;
      }
    }
    return highestSurface;
  }

  #landingSurfaceAt(x, z) {
    return this.#supportHeightAtPoint(
      x,
      z,
      this.#position.y + STEP_CLEARANCE,
    );
  }

  get #movementDirection() {
    const speed = Math.hypot(this.#velocity.x, this.#velocity.z);
    if (speed > 0.001) {
      return {
        x: this.#velocity.x / speed,
        z: this.#velocity.z / speed,
      };
    }
    return this.facingDirection;
  }

  get #hasMovementInput() {
    return Math.hypot(this.#input.x, this.#input.y) > 0.001;
  }

  get #alternateEdgeFoot() {
    return this.#lastEdgeRefusalFoot === FOOT_SIDE.LEFT
      ? FOOT_SIDE.RIGHT
      : FOOT_SIDE.LEFT;
  }

  #unsupportedFootAt(x, z, elevation, direction) {
    const support = this.#feetSupportAt(x, z, elevation, direction);
    if (support.left && support.right) {
      return null;
    }
    if (!support.left && support.right) {
      return FOOT_SIDE.LEFT;
    }
    if (support.left && !support.right) {
      return FOOT_SIDE.RIGHT;
    }
    return this.#alternateEdgeFoot;
  }

  #feetSupportAt(x, z, elevation, direction) {
    const rightX = direction.z;
    const rightZ = -direction.x;
    const forwardX = direction.x * FOOT_FORWARD_OFFSET;
    const forwardZ = direction.z * FOOT_FORWARD_OFFSET;
    return {
      left: this.#footHasSupport(
        x + forwardX - rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ - rightZ * FOOT_LATERAL_OFFSET,
        elevation,
        direction,
        rightX,
        rightZ,
      ),
      right: this.#footHasSupport(
        x + forwardX + rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ + rightZ * FOOT_LATERAL_OFFSET,
        elevation,
        direction,
        rightX,
        rightZ,
      ),
    };
  }

  #bothFootCentersSupportedAt(x, z, elevation, direction) {
    const rightX = direction.z;
    const rightZ = -direction.x;
    const forwardX = direction.x * FOOT_FORWARD_OFFSET;
    const forwardZ = direction.z * FOOT_FORWARD_OFFSET;
    return (
      this.#supportMatchesElevation(
        x + forwardX - rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ - rightZ * FOOT_LATERAL_OFFSET,
        elevation,
      ) &&
      this.#supportMatchesElevation(
        x + forwardX + rightX * FOOT_LATERAL_OFFSET,
        z + forwardZ + rightZ * FOOT_LATERAL_OFFSET,
        elevation,
      )
    );
  }

  #fullySupportedPositionAhead(x, z, elevation, direction) {
    if (!this.#bothFootCentersSupportedAt(x, z, elevation, direction)) {
      return null;
    }
    for (
      let distance = LANDING_BACKTRACK_STEP;
      distance <= LANDING_FORWARD_SETTLE_DISTANCE;
      distance += LANDING_BACKTRACK_STEP
    ) {
      const candidate = {
        x: x + direction.x * distance,
        z: z + direction.z * distance,
      };
      if (
        !this.#unsupportedFootAt(
          candidate.x,
          candidate.z,
          elevation,
          direction,
        )
      ) {
        return candidate;
      }
    }
    return null;
  }

  #footHasSupport(
    centerX,
    centerZ,
    elevation,
    direction,
    rightX,
    rightZ,
  ) {
    if (
      !this.#supportMatchesElevation(
        centerX,
        centerZ,
        elevation,
      )
    ) {
      return false;
    }

    const supportAtOffset = (forward, right) =>
      this.#supportMatchesElevation(
        centerX +
          direction.x * forward +
          rightX * right,
        centerZ +
          direction.z * forward +
          rightZ * right,
        elevation,
      );
    const supportedPerimeterPoints = [
      supportAtOffset(FOOT_HALF_LENGTH, -FOOT_HALF_WIDTH),
      supportAtOffset(FOOT_HALF_LENGTH, FOOT_HALF_WIDTH),
      supportAtOffset(0, -FOOT_HALF_WIDTH),
      supportAtOffset(0, FOOT_HALF_WIDTH),
      supportAtOffset(-FOOT_HALF_LENGTH, -FOOT_HALF_WIDTH),
      supportAtOffset(-FOOT_HALF_LENGTH, FOOT_HALF_WIDTH),
    ].filter(Boolean).length;
    return (
      supportedPerimeterPoints >= FOOT_REQUIRED_PERIMETER_SUPPORTS
    );
  }

  #supportMatchesElevation(x, z, elevation) {
    const supportHeight = this.#supportHeightAtPoint(
      x,
      z,
      elevation + STEP_CLEARANCE,
    );
    return (
      supportHeight !== null &&
      Math.abs(supportHeight - elevation) <= STEP_CLEARANCE
    );
  }

  #isSafeDescentAt(x, z, elevation, direction) {
    const rightX = direction.z;
    const rightZ = -direction.x;
    const frontOffset = FOOT_FORWARD_OFFSET + FOOT_HALF_LENGTH;
    const frontX = x + direction.x * frontOffset;
    const frontZ = z + direction.z * frontOffset;
    const maximumHeight = elevation + STEP_CLEARANCE;
    const leftHeight = this.#supportHeightAtPoint(
      frontX - rightX * FOOT_LATERAL_OFFSET,
      frontZ - rightZ * FOOT_LATERAL_OFFSET,
      maximumHeight,
    );
    const rightHeight = this.#supportHeightAtPoint(
      frontX + rightX * FOOT_LATERAL_OFFSET,
      frontZ + rightZ * FOOT_LATERAL_OFFSET,
      maximumHeight,
    );
    if (leftHeight === null || rightHeight === null) {
      return false;
    }
    return (
      leftHeight < elevation - STEP_CLEARANCE &&
      rightHeight < elevation - STEP_CLEARANCE &&
      elevation - leftHeight <= MAX_SAFE_STEP_DOWN &&
      elevation - rightHeight <= MAX_SAFE_STEP_DOWN &&
      Math.abs(leftHeight - rightHeight) <= STEP_CLEARANCE
    );
  }

  #supportHeightAtPoint(x, z, maximumHeight) {
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
    if (!WALKABLE_TILES.has(type)) {
      return null;
    }
    const collisionSurface = STRUCTURE_SURFACE_TILES.has(type)
      ? this.#collisionWorld?.surfaceHeightAt(x, z)
      : null;
    let highestSurface =
      Number.isFinite(collisionSurface) && collisionSurface <= maximumHeight
        ? collisionSurface
        : null;
    const terrainSurface =
      this.#mapData.heightmap[row][col] +
      (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0);
    if (
      terrainSurface <= maximumHeight &&
      (highestSurface === null || terrainSurface > highestSurface)
    ) {
      highestSurface = terrainSurface;
    }
    return highestSurface;
  }

  #rememberStableGroundPosition() {
    if (
      this.#unsupportedFootAt(
        this.#position.x,
        this.#position.z,
        this.#position.y,
        this.#movementDirection,
      )
    ) {
      return;
    }
    this.#stableGroundPosition = { ...this.#position };
  }

  #rejectUnsupportedLanding(ground) {
    const direction = this.#movementDirection;
    const unsupportedFoot = this.#unsupportedFootAt(
      this.#position.x,
      this.#position.z,
      ground,
      direction,
    );
    if (!unsupportedFoot) {
      return false;
    }

    const supportedPosition = this.#fullySupportedPositionAhead(
      this.#position.x,
      this.#position.z,
      ground,
      direction,
    );
    if (supportedPosition) {
      this.#position.x = supportedPosition.x;
      this.#position.z = supportedPosition.z;
      return false;
    }

    let safePosition = null;
    for (
      let distance = LANDING_BACKTRACK_STEP;
      distance <= LANDING_BACKTRACK_DISTANCE;
      distance += LANDING_BACKTRACK_STEP
    ) {
      const candidate = {
        x: this.#position.x - direction.x * distance,
        y: ground,
        z: this.#position.z - direction.z * distance,
      };
      if (
        !this.#unsupportedFootAt(
          candidate.x,
          candidate.z,
          candidate.y,
          direction,
        )
      ) {
        safePosition = candidate;
        break;
      }
    }
    safePosition ??= this.#stableGroundPosition;
    if (safePosition) {
      this.#position = { ...safePosition };
    } else {
      this.#position.y = ground;
    }
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#jumpsUsed = 0;
    this.#movementBlocked = true;
    this.#beginEdgeRefusal(unsupportedFoot, direction);
    this.#rememberStableGroundPosition();
    return true;
  }

  #beginEdgeRefusal(foot, direction) {
    if (this.#edgeRefusalAction) {
      return;
    }
    this.#lastEdgeRefusalFoot = foot;
    this.#edgeRefusalAction = {
      foot,
      direction: { ...direction },
      elapsed: 0,
    };
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
  }

  #advanceEdgeRefusalAction(deltaTime) {
    if (!this.#edgeRefusalAction) {
      return;
    }
    this.#edgeRefusalAction.elapsed += deltaTime;
    if (this.#edgeRefusalAction.elapsed < EDGE_REFUSAL_DURATION) {
      return;
    }
    this.#edgeRefusalAction = null;
    this.#restartAnimation = true;
  }

  #tryMovementRefusal(x, z) {
    const direction = this.#movementDirection;
    const refusal =
      this.#collisionWorld?.movementRefusalAt(
        x,
        z,
        MOVEMENT_COLLISION_RADIUS,
        this.#position.y,
      ) ??
      this.#collisionWorld?.movementRefusalAt(
        x + direction.x * MOVEMENT_FORWARD_COLLISION_OFFSET,
        z + direction.z * MOVEMENT_FORWARD_COLLISION_OFFSET,
        MOVEMENT_COLLISION_RADIUS,
        this.#position.y,
      );
    if (refusal !== MOVEMENT_REFUSAL.HOLE) {
      return false;
    }
    this.#holeMovementBlocked = true;
    if (this.#holeRefusalAction || this.#holeRefusalAcknowledged) {
      return true;
    }
    this.stopUsingTool({ dismiss: false });
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = {
      direction: { ...direction },
      elapsed: 0,
    };
    this.#holeRefusalAcknowledged = true;
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  #advanceHoleRefusalAction(deltaTime) {
    if (!this.#holeRefusalAction) {
      return;
    }
    this.#holeRefusalAction.elapsed = Math.min(
      HOLE_REFUSAL_DURATION,
      this.#holeRefusalAction.elapsed + deltaTime,
    );
    if (this.#holeRefusalAction.elapsed < HOLE_REFUSAL_DURATION) {
      return;
    }
    this.#holeRefusalAction = null;
    this.#restartAnimation = true;
  }

  #isBeyondMapEdge(x, z) {
    const gridX = x + (this.#mapData.cols - 1) / 2;
    const gridZ = z + (this.#mapData.rows - 1) / 2;
    return (
      gridX < -0.5 ||
      gridZ < -0.5 ||
      gridX > this.#mapData.cols - 0.5 ||
      gridZ > this.#mapData.rows - 0.5
    );
  }

  #findSpawn() {
    const explicitSpawn = this.#mapData.heroSpawn;
    if (
      Number.isFinite(explicitSpawn?.x) &&
      Number.isFinite(explicitSpawn?.y) &&
      Number.isFinite(explicitSpawn?.z)
    ) {
      return { ...explicitSpawn };
    }

    const { castle, cols, rows } = this.#mapData;
    const grassTiles = [];
    const safeGrassTiles = [];
    const castleLeft = castle?.position?.col;
    const castleTop = castle?.position?.row;
    const castleRight = castleLeft + (castle?.position?.width ?? 0) - 1;
    const castleBottom = castleTop + (castle?.position?.depth ?? 0) - 1;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (this.#mapData.grid[row][col] !== TileType.GRASS) continue;
        const behindCastle =
          Number.isFinite(castleRight) &&
          Number.isFinite(castleTop) &&
          col > castleRight &&
          row >= castleTop - 1 &&
          row <= castleBottom + 1;
        if (behindCastle) continue;
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
      }
    }

    const candidates = safeGrassTiles.length ? safeGrassTiles : grassTiles;
    if (candidates.length) {
      const centerCol = this.#spawnCenter.x + (cols - 1) / 2;
      const centerRow = this.#spawnCenter.z + (rows - 1) / 2;
      const tile = candidates.reduce((closest, candidate) => {
        if (!closest) {
          return candidate;
        }
        const candidateDistance =
          (candidate.col - centerCol) ** 2 +
          (candidate.row - centerRow) ** 2;
        const closestDistance =
          (closest.col - centerCol) ** 2 +
          (closest.row - centerRow) ** 2;
        return candidateDistance < closestDistance ? candidate : closest;
      }, null);
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
        (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0);
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

  #initialFacingYaw() {
    const { castle, cols, rows } = this.#mapData;
    const castlePosition = castle?.position;
    if (!castlePosition) {
      return 0;
    }

    const castleCenterX =
      castlePosition.col +
      (castlePosition.width - 1) / 2 -
      (cols - 1) / 2;
    const castleCenterZ =
      castlePosition.row +
      (castlePosition.depth - 1) / 2 -
      (rows - 1) / 2;
    const directionX = castleCenterX - this.#position.x;
    const directionZ = castleCenterZ - this.#position.z;
    if (Math.hypot(directionX, directionZ) <= 0.001) {
      return 0;
    }

    return (Math.atan2(directionX, directionZ) * 180) / Math.PI;
  }

  #beginFallDeath() {
    if (this.#fallingToDeath || this.#gameOver) {
      return;
    }
    this.stopUsingTool({ dismiss: false });
    if (this.#collectAction?.tool) {
      this.#collectAction.tool.visible = false;
    }
    this.#collectAction?.heldItem?.destroy();
    this.#collectAction = null;
    this.#inventoryFullAction = null;
    this.#fallingToDeath = true;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#jumpBufferRemaining = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
  }

  #handleFallDeath() {
    this.#beginFallDeath();
    this.#lives = Math.max(0, this.#lives - 1);
    if (this.#lives === 0) {
      this.#gameOver = true;
      this.#velocity = { x: 0, y: 0, z: 0 };
      this.#emitState();
      return;
    }

    this.#position = { ...this.#spawn };
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#coyoteRemaining = COYOTE_TIME;
    this.#jumpBufferRemaining = 0;
    this.#jumpsUsed = 0;
    this.#movementBlocked = false;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#holeRefusalAcknowledged = false;
    this.#stableGroundPosition = { ...this.#spawn };
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#fallingToDeath = false;
    this.#respawnAction = { elapsed: 0 };
    this.#respawnEffect.begin(this.#facingYaw, this.#position.y);
    this.#updateRespawnPresentation();
    this.#gatewayRepelCooldown = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
    this.#emitState();
  }

  #animate(deltaTime) {
    if (!this.#entity || !this.#modelRoot) {
      return;
    }
    const horizontalSpeed = Math.hypot(this.#velocity.x, this.#velocity.z);
    const blocked =
      this.#hasMovementInput &&
      this.#movementBlocked &&
      !this.#holeMovementBlocked &&
      horizontalSpeed <= 0.08;
    const showingBlockedPush = blocked && !this.#blockedPushFinished;
    const refusingEdge = this.#edgeRefusalAction !== null;
    const refusingHole = this.#holeRefusalAction !== null;
    const facingVelocity = this.#dodgeAction
      ? this.#dodgeAction.facing
      : refusingEdge
        ? this.#edgeRefusalAction.direction
        : refusingHole
          ? this.#holeRefusalAction.direction
          : blocked
            ? this.#desiredVelocity()
            : { x: this.#velocity.x, z: this.#velocity.z };
    const locksDodgeFacing =
      this.#dodgeAction?.direction === "left" ||
      this.#dodgeAction?.direction === "right";
    const previousFacingYaw = this.#facingYaw;
    if (
      !this.#fallingToDeath &&
      !this.#respawnAction &&
      !this.#repelAction &&
      Math.hypot(facingVelocity.x, facingVelocity.z) > 0.08
    ) {
      const targetYaw =
        (Math.atan2(facingVelocity.x, facingVelocity.z) * 180) / Math.PI;
      this.#facingYaw = locksDodgeFacing
        ? targetYaw
        : this.#lerpAngle(
            this.#facingYaw,
            targetYaw,
            Math.min(1, deltaTime * 14),
          );
    }
    this.#modelRoot.setLocalEulerAngles(0, this.#facingYaw, 0);
    this.#respawnEffect?.setFacingYaw(this.#facingYaw);
    if (this.#respawnAction) this.#updateRespawnPresentation();
    if (Math.abs(this.#facingYaw - previousFacingYaw) > 0.001) {
      this.#onFacingChange?.(this.facingDirection);
    }

    let animation;
    let animationSpeed = 1;
    if (this.#fallingToDeath) {
      animation = HERO_ANIMATION.FALL_DEATH;
      this.#resetBoredom();
    } else if (this.#respawnAction) {
      animation = HERO_ANIMATION.RESPAWN;
      this.#resetBoredom();
    } else if (refusingHole) {
      animation = HERO_ANIMATION.HOLE_REFUSAL;
      this.#resetBoredom();
    } else if (this.#inventoryFullAction) {
      animation = this.#inventoryFullAction.positioning
        ? HERO_ANIMATION.WALK
        : HERO_ANIMATION.INVENTORY_FULL_COLLAPSE;
      animationSpeed =
        this.#inventoryFullAction.positioning?.animationSpeed ?? 1;
      this.#resetBoredom();
    } else if (this.#toolAction) {
      animation = this.#toolAnimationName();
      this.#resetBoredom();
    } else if (this.#collectAction) {
      animation = this.#collectAction.positioning
        ? HERO_ANIMATION.WALK
        : this.#collectAction.animation;
      animationSpeed = this.#collectAction.positioning?.animationSpeed ?? 1;
      this.#resetBoredom();
    } else if (this.#repelAction) {
      animation = HERO_ANIMATION.REPELLED;
      this.#resetBoredom();
    } else if (this.#dodgeAction) {
      animation = this.#dodgeAnimationName(this.#dodgeAction.direction);
      animationSpeed = DODGE_ANIMATION_DURATION / DODGE_DURATION;
      this.#resetBoredom();
    } else if (!this.#grounded) {
      animation = HERO_ANIMATION.JUMP;
      this.#resetBoredom();
    } else if (refusingEdge) {
      animation = this.#edgeRefusalAnimationName(
        this.#edgeRefusalAction.foot,
      );
      this.#resetBoredom();
    } else if (showingBlockedPush) {
      animation = HERO_ANIMATION.BLOCKED_PUSH;
      this.#resetBoredom();
    } else if (horizontalSpeed > 0.08) {
      animation = this.#running ? HERO_ANIMATION.RUN : HERO_ANIMATION.WALK;
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
    this.#updateHeadLook(deltaTime);
  }

  #selectIdleAnimation(deltaTime) {
    this.#idleElapsed += deltaTime;
    if (this.#boredAnimation) {
      this.#boredRemaining = Math.max(0, this.#boredRemaining - deltaTime);
      if (this.#boredRemaining > 0) {
        return this.#boredAnimation;
      }

      this.#boredAnimation = null;
      this.#nextBoredAt =
        this.#idleElapsed +
        BORED_BREAK_MIN +
        Math.random() * BORED_BREAK_VARIANCE;
      return HERO_ANIMATION.IDLE;
    }

    if (this.#idleElapsed < this.#nextBoredAt) {
      return HERO_ANIMATION.IDLE;
    }

    this.#boredAnimation = this.#nextBoredAnimation;
    this.#boredRemaining = BORED_ANIMATION_DURATIONS.get(
      this.#boredAnimation,
    );
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
    if (!animation) {
      return;
    }
    animation.speed = speed;
    if (restart) {
      animation.baseLayer.play(name);
      this.#animationState = name;
      return;
    }
    if (this.#animationState === name) {
      return;
    }
    animation.baseLayer.transition(name, ANIMATION_BLEND_TIME);
    this.#animationState = name;
  }

  get #headLookTargetYaw() {
    if (
      this.#animationState !== HERO_ANIMATION.BORED_CURSOR_LOOK ||
      !this.#idleLookTarget ||
      this.#hasMovementInput ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#dodgeAction ||
      this.#holeRefusalAction ||
      this.#respawnAction ||
      this.#fallingToDeath
    ) {
      return 0;
    }
    const targetYaw =
      (Math.atan2(
        this.#idleLookTarget.x - this.#position.x,
        this.#idleLookTarget.z - this.#position.z,
      ) *
        180) /
      Math.PI;
    const relativeYaw = ((targetYaw - this.#facingYaw + 540) % 360) - 180;
    return Math.max(
      -HEAD_LOOK_MAX_YAW,
      Math.min(HEAD_LOOK_MAX_YAW, relativeYaw),
    );
  }

  #updateHeadLook(deltaTime) {
    if (this.#holeRefusalAction) {
      const progress = Math.min(
        1,
        this.#holeRefusalAction.elapsed / HOLE_REFUSAL_DURATION,
      );
      const lookDown = Math.sin(Math.PI * progress);
      const shakeProgress = Math.max(0, (progress - 0.32) / 0.68);
      const shake =
        Math.sin(shakeProgress * Math.PI * 4) *
        Math.sin(shakeProgress * Math.PI) *
        HOLE_HEAD_SHAKE_ANGLE;
      this.#headLookYaw = shake;
      this.#headEntity?.setLocalEulerAngles(
        HOLE_LOOK_DOWN_ANGLE * lookDown,
        shake,
        0,
      );
      return;
    }
    this.#headLookYaw = this.#lerpAngle(
      this.#headLookYaw,
      this.#headLookTargetYaw,
      Math.min(1, deltaTime * HEAD_LOOK_RESPONSE),
    );
    this.#headEntity?.setLocalEulerAngles(0, this.#headLookYaw, 0);
  }

  get #nextBoredAnimation() {
    let animation;
    do {
      animation = HERO_BORED_ANIMATIONS[this.#boredIndex];
      this.#boredIndex =
        (this.#boredIndex + 1) % HERO_BORED_ANIMATIONS.length;
    } while (
      animation === HERO_ANIMATION.BORED_CURSOR_LOOK &&
      !this.#idleLookTarget
    );
    return animation;
  }

  #createModel() {
    this.#modelRoot = this.#modelLibrary.instantiate(Hero.modelUrl);
    this.#modelRoot.name = "Hero model instance";
    this.#modelRoot.setLocalEulerAngles(0, this.#facingYaw, 0);
    this.#modelRoot.setLocalScale(
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
    );
    this.#entity.addChild(this.#modelRoot);
    this.#headEntity = this.#findModelEntity("Hero head");
    this.#toolAttachmentEntity = this.#findModelEntity("Right arm");
    this.#rightHeldItemAttachmentEntity =
      this.#findModelEntity("Right white glove");
    this.#leftHeldItemAttachmentEntity =
      this.#findModelEntity("Left white glove");

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
    this.#modelRoot.anim.baseLayer.play(HERO_ANIMATION.IDLE);
    this.#animationState = HERO_ANIMATION.IDLE;
    this.#respawnEffect = new HeroRespawnEffect({
      pc: this.#pc,
      parent: this.#entity,
      modelRoot: this.#modelRoot,
      modelLibrary: this.#modelLibrary,
      modelUrl: Hero.modelUrl,
      modelScale: HERO_MODEL_SCALE,
      startHeight: RESPAWN_START_HEIGHT,
      respawnAnimation: animationTracks.get(HERO_ANIMATION.RESPAWN),
    });
  }

  #advanceToolAction(deltaTime) {
    if (!this.#toolAction) {
      return;
    }
    const action = this.#toolAction;
    const tool = this.#tool;
    action.elapsed += deltaTime;
    if (action.phase === "summon") {
      if (action.elapsed >= tool.summonDuration) {
        action.phase = "use";
        action.elapsed = 0;
        this.#restartAnimation = true;
      }
      return;
    }
    if (action.phase === "dismiss") {
      if (action.elapsed >= tool.dismissDuration) {
        this.#finishToolAction();
      }
      return;
    }
    if (!action.impacted && action.elapsed >= tool.impactTime) {
      action.impacted = true;
      action.stopAfterCycle = action.onImpact?.() === true;
    }
    if (action.elapsed < tool.useDuration) {
      return;
    }

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

  #advanceCollectAction(deltaTime) {
    if (!this.#collectAction) {
      return;
    }
    const action = this.#collectAction;
    if (this.#advanceCollectionPositioning(action, deltaTime)) {
      return;
    }
    action.elapsed += deltaTime;
    if (!action.impacted && action.elapsed >= action.impactTime) {
      action.impacted = true;
      const collected = action.onImpact?.() === true;
      if (collected && action.heldItem) {
        action.heldItem.mount(
          this.#entity,
          action.heldItemAttachmentEntity,
        );
      }
    }
    action.heldItem?.follow(deltaTime);
    if (
      action.heldItem &&
      action.heldItemHideTime !== null &&
      action.elapsed >= action.heldItemHideTime
    ) {
      action.heldItem.destroy();
      action.heldItem = null;
    }
    if (action.elapsed < action.duration) {
      return;
    }

    if (action.tool) {
      action.tool.visible = false;
    }
    action.heldItem?.destroy();
    this.#collectAction = null;
    this.#restartAnimation = true;
    action.onComplete?.();
  }

  #advanceInventoryFullAction(deltaTime) {
    if (!this.#inventoryFullAction) {
      return;
    }
    const action = this.#inventoryFullAction;
    if (this.#advanceCollectionPositioning(action, deltaTime)) {
      return;
    }
    action.elapsed += deltaTime;
    if (!action.notified && action.elapsed >= INVENTORY_FULL_EFFECT_TIME) {
      action.notified = true;
      this.#onInventoryFull?.(this.inventory);
    }
    if (action.elapsed < INVENTORY_FULL_COLLAPSE_DURATION) {
      return;
    }
    this.#inventoryFullAction = null;
    this.#restartAnimation = true;
    action.onComplete?.();
  }

  #collectionPositioning({
    picksMushroom,
    targetPosition,
    targetRadius,
    targetDistance,
  }) {
    const preferredDistance = picksMushroom
      ? PICK_MUSHROOM_TARGET_DISTANCE
      : Math.max(
          PICK_FLOWER_MINIMUM_DISTANCE,
          Math.min(
            PICK_FLOWER_MAXIMUM_DISTANCE,
            targetRadius + PICK_FLOWER_RADIUS_CLEARANCE,
          ),
        );
    const distanceAdjustment = targetDistance - preferredDistance;
    const maximumForwardStep = picksMushroom
      ? PICK_MUSHROOM_MAXIMUM_STEP
      : PICK_FLOWER_MAXIMUM_FORWARD_STEP;
    const maximumBackwardStep = picksMushroom
      ? PICK_MUSHROOM_MAXIMUM_STEP
      : PICK_FLOWER_MAXIMUM_BACKWARD_STEP;
    const stepDistance = Math.max(
      -maximumBackwardStep,
      Math.min(maximumForwardStep, distanceAdjustment),
    );
    if (Math.abs(stepDistance) < 0.025) {
      return null;
    }
    const direction =
      targetDistance > 0.001
        ? {
            x: (targetPosition.x - this.#position.x) / targetDistance,
            z: (targetPosition.z - this.#position.z) / targetDistance,
          }
        : this.facingDirection;
    return {
      animationSpeed: 0.8,
      startX: this.#position.x,
      startZ: this.#position.z,
      targetX: this.#position.x + direction.x * stepDistance,
      targetZ: this.#position.z + direction.z * stepDistance,
    };
  }

  #advanceCollectionPositioning(action, deltaTime) {
    if (!action.positioning) {
      return false;
    }
    action.positioningElapsed += deltaTime;
    const progress = Math.min(
      1,
      action.positioningElapsed / PICKUP_POSITIONING_DURATION,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    const nextX =
      action.positioning.startX +
      (action.positioning.targetX - action.positioning.startX) *
        easedProgress;
    const nextZ =
      action.positioning.startZ +
      (action.positioning.targetZ - action.positioning.startZ) *
        easedProgress;
    if (this.#occupancyAt(nextX, nextZ) !== OCCUPANCY.open) {
      action.positioning = null;
      action.positioningElapsed = 0;
      this.#restartAnimation = true;
      return true;
    }
    this.#position.x = nextX;
    this.#position.z = nextZ;
    if (progress >= 1) {
      action.positioning = null;
      action.positioningElapsed = 0;
      this.#restartAnimation = true;
    }
    return true;
  }

  #toolAnimationName() {
    if (this.#toolAction.phase === "summon") {
      return this.#tool.summonAnimation;
    }
    if (this.#toolAction.phase === "dismiss") {
      return this.#tool.dismissAnimation;
    }
    return this.#toolAction.useAnimation;
  }

  #finishToolAction() {
    const action = this.#toolAction;
    if (!action) {
      return;
    }
    this.#tool.visible = false;
    this.#toolAction = null;
    this.#tool = null;
    this.#restartAnimation = true;
    action.onComplete?.();
  }

  #tryGatewayRepulsion(toX, toZ) {
    if (
      this.#collectAction ||
      this.#repelAction ||
      this.#gatewayRepelCooldown > 0
    ) {
      return false;
    }
    const direction = this.#getGatewayRepulsion?.(
      this.#position.x,
      this.#position.z,
      toX,
      toZ,
      HERO_RADIUS,
    );
    if (!direction) {
      return false;
    }
    this.stopUsingTool({ dismiss: false });
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#repelAction = { ...direction, elapsed: 0 };
    this.#dodgeAction = null;
    this.#velocity.x = direction.x * GATEWAY_REPEL_SPEED;
    this.#velocity.z = direction.z * GATEWAY_REPEL_SPEED;
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  #advanceRepelAction(deltaTime) {
    if (!this.#repelAction) {
      return;
    }
    this.#repelAction.elapsed += deltaTime;
    if (this.#repelAction.elapsed < GATEWAY_REPEL_DURATION) {
      return;
    }
    this.#repelAction = null;
    this.#gatewayRepelCooldown = GATEWAY_REPEL_COOLDOWN;
    this.#restartAnimation = true;
  }

  #advanceDodgeAction(deltaTime) {
    if (!this.#dodgeAction) {
      return;
    }
    this.#dodgeAction.elapsed = Math.min(
      DODGE_DURATION,
      this.#dodgeAction.elapsed + deltaTime,
    );
    if (this.#dodgeAction.elapsed < DODGE_DURATION) {
      return;
    }
    const crossedLedge = this.#dodgeAction.crossedLedge;
    this.#dodgeAction = null;
    if (crossedLedge) this.#beginFallDeath();
  }

  #advanceRespawnAction(deltaTime) {
    if (!this.#respawnAction) {
      return;
    }
    this.#respawnAction.elapsed = Math.min(
      RESPAWN_ANIMATION_DURATION,
      this.#respawnAction.elapsed + deltaTime,
    );
    if (this.#respawnAction.elapsed >= RESPAWN_ANIMATION_DURATION) {
      this.#respawnAction = null;
      this.#resetRespawnPresentation();
      this.#restartAnimation = true;
    }
  }

  #updateRespawnPresentation() {
    if (!this.#modelRoot || !this.#respawnAction) {
      return;
    }

    const progress = Math.min(
      1,
      this.#respawnAction.elapsed / RESPAWN_ANIMATION_DURATION,
    );
    this.#respawnEffect?.update(
      progress,
      this.#respawnAction.elapsed,
      this.#position.y,
    );
  }

  #resetRespawnPresentation() {
    this.#respawnEffect?.reset();
  }

  #emitState() {
    this.#onStateChange?.({
      lives: this.#lives,
      maxLives: MAX_LIVES,
      gameOver: this.#gameOver,
      wallet: this.wallet,
      inventory: this.inventory,
    });
  }

  #findModelEntity(name) {
    const pending = [this.#modelRoot];
    while (pending.length) {
      const entity = pending.pop();
      if (entity.name === name) {
        return entity;
      }
      pending.push(...entity.children);
    }
    return null;
  }

  #approach(value, target, amount) {
    if (value < target) {
      return Math.min(value + amount, target);
    }
    return Math.max(value - amount, target);
  }

  #lerpAngle(from, to, amount) {
    const difference = ((to - from + 540) % 360) - 180;
    return from + difference * amount;
  }
}
