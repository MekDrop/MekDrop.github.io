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
import { RIVER_KIND } from "../../enum/RiverKind.js";
import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";
import { TILE_SHAPE } from "../../enum/TileShape.js";
import { HeroLavaDeathEffect } from "./HeroLavaDeathEffect.js";
import { HeroPhysicsController } from "./HeroPhysicsController.js";
import { HeroFootPlacement } from "./HeroFootPlacement.js";
import { HeroWaterMotion } from "./HeroWaterMotion.js";
import { HeroPatMood } from "./HeroPatMood.js";
import { HeroPatEscape } from "./HeroPatEscape.js";
import { HeroHairPhysics } from "./HeroHairPhysics.js";
import { HERO_MOOD } from "../../enum/HeroMood.js";
import { HERO_STAT } from "../../enum/HeroStat.js";
import { BuffSystem } from "../../buffs/BuffSystem.js";

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
const SIDE_DODGE_JUMP_HEIGHT = 0.68;
const FORWARD_BACK_DODGE_JUMP_HEIGHT = 1;
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
const HERO_COLLISION_HEIGHT = 1.45;
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
const BLOCKED_DIG_REACTION_DURATION = 42 / 24;
const BLOCKED_DIG_EYE_ANGLE = 20;
const INVENTORY_FULL_COLLAPSE_DURATION = 52 / 24;
const INVENTORY_FULL_EFFECT_TIME = 14 / 24;
const INVENTORY_FULL_INDICATOR_CLEARANCE = 0.82;
const LANDING_BACKTRACK_STEP = 0.025;
const LANDING_BACKTRACK_DISTANCE = 0.75;
const LANDING_FORWARD_SETTLE_DISTANCE =
  FOOT_FORWARD_OFFSET + FOOT_HALF_LENGTH;
const FALL_EXIT_HEIGHT = -14;
const RIVER_CURRENT_SPEED = 1.45;
const RIVER_WAYPOINT_EPSILON = 0.035;
const RIVER_EXIT_DISTANCE = 0.72;
const DROWNING_ENTRY_CLEARANCE = 0.32;
const LAVA_ENTRY_CLEARANCE = 0.12;
const DROWNING_SUBMERGE_DEPTH = 0.68;
const DROWNING_SINK_SPEED = 2.8;
const DROWNING_HEAD_YAW_LIMIT = 46;
const LAVA_BURN_DURATION = 1.35;
const LAVA_ASH_START = 0.68;
const LAVA_SUBMERGE_DEPTH = 0.82;
const RIVER_BRIDGE_MAX_CLIMB_HEIGHT = 1;
const RIVER_BRIDGE_APPROACH_OFFSET = 0.94;
const RIVER_BRIDGE_RAIL_OFFSET = 0.43;
const RIVER_BRIDGE_EXIT_DURATION = 1.15;
const RIVER_BRIDGE_CATCH_END = 0.25;
const RIVER_BRIDGE_CLIMB_END = 0.75;
const RIVER_BRIDGE_CATCH_HEIGHT_OFFSET = 0.98;
const RIVER_BRIDGE_HOP_HEIGHT = 0.24;
// Keeps the widest pose, including the pauldron and its outline, within one
// 1x1 terrain/path cube.
const HERO_MODEL_SCALE = 0.65;
// Castle foundation cells remain traversable dirt. The castle collision world
// owns the exact wall, door, stair, and furniture footprints, so the whole
// foundation rectangle must not behave like one solid wall.
const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.ENTRY,
  TileType.CASTLE_WALL,
  TileType.CASTLE_TOWER,
]);
const GRASS_SURFACE_TILES = new Set([TileType.GRASS]);
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
const PAT_ANNOYED_DURATION = 1.25;
const PAT_HAIR_CONTACT_HEIGHT = 0.78;
const HAIR_ENTITY_NAME = /(?:hair|nape lock|swept fringe|layered lock)/i;

export class Hero {
  #buffs = new BuffSystem();
  #patMood = new HeroPatMood(this.#buffs);
  #patEscape = new HeroPatEscape();
  #faceMorphs = [];
  #patReactionRemaining = 0;
  #lastAngryPatTime = -Infinity;
  #angryPatDistance = 3;

  get mood() {
    return {
      ...this.#patMood.state,
      speedMultiplier: this.#buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 1),
      escaping: this.#patEscape.active,
      target: this.#patEscape.target,
    };
  }

  get buffs() {
    return this.#buffs.state;
  }

  get stats() {
    return {
      walkSpeed: this.#buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, MOVE_SPEED),
      runSpeed: this.#buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, RUN_SPEED),
    };
  }

  applyBuff(id, options) {
    if (this.#gameOver || this.isInDeathSequence || !this.#buffs.apply(id, options)) {
      return false;
    }
    this.#emitState();
    return true;
  }

  removeBuff(id) {
    if (!this.#buffs.remove(id)) {
      return false;
    }
    this.#emitState();
    return true;
  }

  get canBePatted() {
    return Boolean(this.#headEntity) && this.#grounded && !this.#gameOver
      && !this.isInDeathSequence && !this.#toolAction && !this.#collectAction
      && !this.#inventoryFullAction && !this.#dodgeAction && !this.#repelAction
      && !this.#edgeRefusalAction && !this.#holeRefusalAction
      && !this.#blockedDigReactionAction;
  }

  get patPosition() {
    return this.#headEntity?.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0, PAT_HAIR_CONTACT_HEIGHT, 0),
    ) ?? null;
  }

  pat() {
    if (!this.canBePatted) {
      return false;
    }
    const accepted = this.#patMood.pat();
    const { kind, elapsed } = this.#patMood.state;
    if (kind === HERO_MOOD.ANGRY) {
      // Limit stroke events just like normal pats, without refreshing anger.
      if (elapsed - this.#lastAngryPatTime < 0.22) {
        return false;
      }
      this.#lastAngryPatTime = elapsed;
      this.#angryPatDistance = accepted ? 3 : Math.min(12, this.#angryPatDistance + 1.5);
      this.#patReactionRemaining = 0;
      this.#patEscape.begin(
        this.#position,
        (from, to) => this.#canEscapeAcross(from, to),
        Math.random,
        this.#angryPatDistance,
      );
      this.#jumpBufferRemaining = 0;
      this.#facingHoldRemaining = 0;
      this.#resetBoredom();
      this.#emitState();
      return true;
    }
    const irritated = kind === HERO_MOOD.AGITATED;
    if (irritated && !this.#patEscape.active && !this.#hasMovementInput
      && this.#patReactionRemaining === 0) {
      this.#patReactionRemaining = PAT_ANNOYED_DURATION;
      this.#setAngryFace(0);
    }
    if (!accepted) {
      return false;
    }
    this.#resetBoredom();
    this.#emitState();
    return true;
  }

  #canEscapeAcross(from, to) {
    // Keep the escape on the current connected level. Check the whole body
    // footprint at short intervals, excluding water, holes and unsafe slopes.
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.ceil(distance / 0.15);
    for (let step = 1; step <= steps; step += 1) {
      const x = from.x + (to.x - from.x) * step / steps;
      const z = from.z + (to.z - from.z) * step / steps;
      for (const [dx, dz] of [[0, 0], [0.48, 0], [-0.48, 0], [0, 0.48], [0, -0.48]]) {
        const height = this.#supportHeightAtPoint(x + dx, z + dz, this.#position.y + 0.08);
        if (height === null || Math.abs(height - this.#position.y) > 0.08) {
          return false;
        }
      }
      if (this.#terrainOccupancyAt(from.x, from.z, x, z, true, 0.48) !== OCCUPANCY.open
        || this.#overheadClearanceBlockedAt(x, z)
        || this.#collisionWorld?.isMovementBlocked(
          from.x, from.z, x, z, 0.48, this.#position.y, STEP_CLEARANCE,
        )) {
        return false;
      }
    }
    return true;
  }

  static get modelUrl() {
    return heroModelUrl;
  }

  static get inventoryCapacity() {
    return HERO_INVENTORY_CAPACITY;
  }

  #pc;
  #app;
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
  #physics;
  #modelRoot;
  #headEntity;
  #mouthEntity;
  #leftEyeEntity;
  #rightEyeEntity;
  #leftArmEntity;
  #rightArmEntity;
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
  #blockedDigReactionAction = null;
  #holeRefusalAcknowledged = false;
  #holeMovementBlocked = false;
  #lastEdgeRefusalFoot = FOOT_SIDE.RIGHT;
  #stableGroundPosition;
  #grounded = true;
  #coyoteRemaining = COYOTE_TIME;
  #jumpBufferRemaining = 0;
  #jumpsUsed = 0;
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
  #facingHoldRemaining = 0;
  #respawnAction = null;
  #respawnEffect = null;
  #footPlacement = null;
  #hairPhysics = null;
  #fallingToDeath = false;
  #riverRoutesByCell = new Map();
  #riverSourceCovers = [];
  #drowningAction = null;
  #bridgeClimbAction = null;
  #drowningRenderStates = new Map();
  #lavaDeathAction = null;
  #lavaDeathEffect = null;
  #lavaAshes = false;
  #lives = MAX_LIVES;
  #gameOver = false;
  #gatewayRepelCooldown = 0;
  #wallet = {
    [COIN_TYPE.GOLD]: 0,
    [COIN_TYPE.SILVER]: 0,
    [COIN_TYPE.COPPER]: 0,
  };
  #heroConfigurationStore;
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
    heroConfigurationStore,
    getGatewayRepulsion,
    collisionWorld,
    modelLibrary,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#buildRiverRouteLookup();
    this.#spawnCenter = spawnCenter;
    this.#getViewRotation = getViewRotation;
    this.#onPositionChange = onPositionChange;
    this.#onFacingChange = onFacingChange;
    this.#onStateChange = onStateChange;
    this.#heroConfigurationStore = heroConfigurationStore;
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
    this.#physics = new HeroPhysicsController({
      pc,
      app,
      entity: this.#entity,
      radius: MOVEMENT_COLLISION_RADIUS,
      height: HERO_COLLISION_HEIGHT,
      gravity: GRAVITY,
    });

    this.#createModel();
    this.#lavaDeathEffect = new HeroLavaDeathEffect({ pc, app });
    this.#entity.addChild(this.#lavaDeathEffect.entity);
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
      capacity: this.#heroConfigurationStore.inventory.capacity,
      items: this.#heroConfigurationStore.inventory.items.map((item) => ({
        ...item,
      })),
    };
  }

  get inventoryFull() {
    return (
      this.#heroConfigurationStore.inventory.items.length >=
      this.#heroConfigurationStore.inventory.capacity
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

  get footPlacementState() {
    return this.#footPlacement?.state ?? null;
  }

  get grassFootContacts() {
    return this.#footPlacement?.grassContacts ?? [];
  }

  get isInDeathSequence() {
    return (
      this.#drowningAction !== null ||
      this.#bridgeClimbAction !== null ||
      this.#lavaDeathAction !== null ||
      this.#fallingToDeath ||
      this.#respawnAction !== null
    );
  }

  get isRespawning() {
    return this.#respawnAction !== null;
  }

  get drowning() {
    return this.#drowningAction !== null;
  }

  get waterPresentation() {
    if (!this.#drowningAction || !this.#headEntity) {
      return null;
    }
    const entry = this.#riverRouteEntryAt(this.#position.x, this.#position.z);
    if (!entry || entry.cell.underBridge) {
      return null;
    }
    return {
      head: this.#headEntity,
      x: this.#position.x,
      z: this.#position.z,
      surfaceY: entry.cell.elevation + 0.012,
    };
  }

  get burning() {
    return this.#lavaDeathAction !== null && !this.#lavaAshes;
  }

  get ashes() {
    return this.#lavaAshes;
  }

  get isReacting() {
    return this.#blockedDigReactionAction !== null || this.#patControlsLocked;
  }

  get #patControlsLocked() {
    return this.#patEscape.active || this.#patMood.state.kind === HERO_MOOD.ANGRY;
  }

  get #restingForMood() {
    return this.canBePatted && !this.#patEscape.active && !this.#hasMovementInput
      && !this.#bridgeClimbAction && this.#patReactionRemaining === 0
      && Math.hypot(this.#velocity.x, this.#velocity.y, this.#velocity.z) <= 0.08;
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
      running: (this.#running || this.#patEscape.active) && this.#grounded && speed > 0.08,
    };
  }

  set facingHoldDuration(duration) {
    this.#facingHoldRemaining = Math.max(0, duration ?? 0);
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
    if (this.#patControlsLocked) {
      return;
    }
    if (
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#lavaDeathAction ||
      this.#drowningAction ||
      this.#bridgeClimbAction ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#holeRefusalAction ||
      this.#blockedDigReactionAction
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
    if (this.#patControlsLocked) {
      return false;
    }
    if (
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#lavaDeathAction ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction ||
      this.#blockedDigReactionAction
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

    const jumpHeight =
      direction === "up" || direction === "down"
        ? FORWARD_BACK_DODGE_JUMP_HEIGHT
        : SIDE_DODGE_JUMP_HEIGHT;
    const jumpVelocity = Math.sqrt(-2 * GRAVITY * jumpHeight);
    const duration = (2 * jumpVelocity) / -GRAVITY;
    const speed = DODGE_DISTANCE / duration;
    this.#velocity.x = projected.x * speed;
    this.#velocity.y = jumpVelocity;
    this.#velocity.z = projected.z * speed;
    this.#physics.velocity = this.#velocity;
    this.#grounded = false;
    this.#coyoteRemaining = 0;
    this.#jumpBufferRemaining = 0;
    this.#jumpsUsed = 1;
    this.#dodgeAction = {
      direction,
      x: projected.x,
      z: projected.z,
      facing: this.#dodgeFacingDirection(direction, projected),
      duration,
      speed,
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
      this.#patControlsLocked ||
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#lavaDeathAction ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction ||
      this.#blockedDigReactionAction
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
      this.#patControlsLocked ||
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#lavaDeathAction ||
      this.#drowningAction ||
      this.#bridgeClimbAction ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#dodgeAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction ||
      this.#blockedDigReactionAction
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

  reactToBlockedDig() {
    if (
      this.#patControlsLocked ||
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#lavaDeathAction ||
      this.#drowningAction ||
      this.#bridgeClimbAction ||
      this.#toolAction ||
      !this.#grounded
    ) {
      return false;
    }
    this.#blockedDigReactionAction = { elapsed: 0 };
    this.#velocity.x = 0;
    this.#velocity.z = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  collectInventoryItem(item) {
    if (!this.#heroConfigurationStore.addInventoryItem(item)) {
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
      this.#patControlsLocked ||
      this.#gameOver ||
      this.#respawnAction ||
      this.#fallingToDeath ||
      this.#lavaDeathAction ||
      !this.#grounded ||
      this.#toolAction ||
      this.#collectAction ||
      this.#inventoryFullAction ||
      this.#repelAction ||
      this.#dodgeAction ||
      this.#edgeRefusalAction ||
      this.#holeRefusalAction ||
      this.#blockedDigReactionAction
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
    if (direction === "down") {
      return this.facingDirection;
    }
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
    this.#buffs.clear();
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#footPlacement?.destroy();
    this.#footPlacement = null;
    this.#hairPhysics?.destroy();
    this.#hairPhysics = null;
    this.#respawnEffect?.destroy();
    this.#respawnEffect = null;
    this.#lavaDeathEffect?.destroy();
    this.#lavaDeathEffect = null;
    if (this.#collectAction?.tool) {
      this.#collectAction.tool.visible = false;
    }
    this.#collectAction?.heldItem?.destroy();
    this.#physics?.destroy();
    this.#physics = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#app = null;
    this.#headEntity = null;
    this.#mouthEntity = null;
    this.#leftEyeEntity = null;
    this.#rightEyeEntity = null;
    this.#faceMorphs = [];
    this.#patReactionRemaining = 0;
    this.#leftArmEntity = null;
    this.#rightArmEntity = null;
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
    this.#lavaDeathAction = null;
    this.#lavaAshes = false;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#blockedDigReactionAction = null;
    this.#stableGroundPosition = null;
  }

  #update = (deltaTime) => {
    this.#step(Math.min(deltaTime, MAX_FRAME_TIME));
    this.#animate(deltaTime);
    this.#hairPhysics?.update();
  };

  #step(deltaTime) {
    const previousX = this.#position.x;
    const previousY = this.#position.y;
    const previousZ = this.#position.z;
    let rigidBodyWasBlocked = false;
    if (!this.#physics.scripted) {
      this.#position = this.#physics.position;
      this.#velocity = this.#physics.velocity;
      this.#grounded =
        this.#velocity.y <= 0.2 &&
        this.#physics.groundContact(this.#position) !== null;
      rigidBodyWasBlocked =
        this.#hasMovementInput &&
        this.#grounded &&
        Math.hypot(this.#velocity.x, this.#velocity.z) <= 0.08;
    }
    const buffRevision = this.#buffs.revision;
    if (this.isInDeathSequence || this.#gameOver) {
      this.#buffs.clear();
      this.#patMood.reset();
      this.#patEscape.reset();
    } else {
      this.#buffs.advance(deltaTime, { resting: this.#restingForMood });
      this.#patMood.advance(deltaTime);
      if (this.#patMood.state.kind !== HERO_MOOD.ANGRY) {
        this.#angryPatDistance = 3;
      }
      this.#patEscape.advance(deltaTime, this.#position);
    }
    if (this.#buffs.revision !== buffRevision) {
      this.#emitState();
    }
    if (this.#gameOver) {
      return;
    }
    if (this.#lavaDeathAction) {
      this.#advanceLavaDeath(deltaTime);
      this.#applyPosition(previousX, previousY, previousZ);
      return;
    }
    if (this.#bridgeClimbAction) {
      this.#advanceRiverBridgeExit(deltaTime);
      this.#applyPosition(previousX, previousY, previousZ);
      return;
    }
    if (this.#drowningAction) {
      this.#advanceDrowningAction(deltaTime);
      this.#applyPosition(previousX, previousY, previousZ);
      return;
    }
    this.#advanceToolAction(deltaTime);
    this.#advanceCollectAction(deltaTime);
    this.#advanceInventoryFullAction(deltaTime);
    this.#advanceRepelAction(deltaTime);
    this.#advanceDodgeAction(deltaTime);
    this.#advanceRespawnAction(deltaTime);
    this.#advanceEdgeRefusalAction(deltaTime);
    this.#advanceHoleRefusalAction(deltaTime);
    this.#advanceBlockedDigReaction(deltaTime);
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
        : this.#edgeRefusalAction ||
            this.#holeRefusalAction ||
            this.#blockedDigReactionAction
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
                    x: this.#dodgeAction.x * this.#dodgeAction.speed,
                    z: this.#dodgeAction.z * this.#dodgeAction.speed,
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
      !this.#blockedDigReactionAction &&
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

    this.#movementBlocked = rigidBodyWasBlocked;
    this.#holeMovementBlocked = false;
    this.#moveHorizontally(deltaTime);
    this.#moveVertically(deltaTime);
    this.#advanceBlockedPush(deltaTime);

    if (this.#position.y < FALL_EXIT_HEIGHT) {
      this.#handleFallDeath();
    }
    this.#applyPosition(previousX, previousY, previousZ);
  }

  #desiredVelocity() {
    if (this.#patEscape.active) {
      return this.#patEscape.velocity(this.#position, RUN_SPEED);
    }
    if (this.#patControlsLocked) {
      return { x: 0, z: 0 };
    }
    const projected = this.#projectInput(this.#input.x, this.#input.y);
    if (!projected) {
      return { x: 0, z: 0 };
    }
    const speed = this.#buffs.modifyStat(
      HERO_STAT.MOVEMENT_SPEED,
      this.#running ? RUN_SPEED : MOVE_SPEED,
    );
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
    if (occupancyX !== OCCUPANCY.open) {
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
      if (attemptedX) {
        this.#tryGatewayRepulsion(nextX, this.#position.z);
      }
    }

    const attemptedZ = Math.abs(this.#velocity.z) > 0.001;
    const nextZ = this.#position.z + this.#velocity.z * deltaTime;
    const occupancyZ = this.#occupancyAt(this.#position.x, nextZ);
    if (occupancyZ !== OCCUPANCY.open) {
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
      if (attemptedZ) {
        this.#tryGatewayRepulsion(this.#position.x, nextZ);
      }
    }
  }
  #moveVertically() {
    if (this.#tryBeginDrowning()) {
      return;
    }
    const riverRouteEntry = this.#riverRouteEntryAt(
      this.#position.x,
      this.#position.z,
    );
    const aboveExposedRiver =
      riverRouteEntry !== null && !riverRouteEntry.cell.underBridge;
    const contact = this.#fallingToDeath
      ? null
      : this.#physics.groundContact(this.#position);
    const safeLanding = this.#fallingToDeath
      ? null
      : this.#physics.surfaceAt(
          this.#position.x,
          this.#position.z,
          this.#position.y + STEP_CLEARANCE,
          this.#position.y - MAX_SAFE_STEP_DOWN - STEP_CLEARANCE,
        );
    if (safeLanding === null && this.#dodgeAction) {
      this.#dodgeAction.crossedLedge = true;
    }
    if (
      !contact &&
      !this.#fallingToDeath &&
      !this.#dodgeAction &&
      !aboveExposedRiver &&
      (this.#isBeyondMapEdge(this.#position.x, this.#position.z) ||
        (!safeLanding &&
          !this.#grounded &&
          this.#velocity.y <= 0 &&
          this.#position.y <
            (this.#stableGroundPosition?.y ?? this.#spawn.y) -
              STEP_CLEARANCE))
    ) {
      this.#beginFallDeath();
    }
    this.#grounded = Boolean(contact) && this.#velocity.y <= 0.2;
    if (this.#grounded) {
      this.#jumpsUsed = 0;
      this.#rememberStableGroundPosition();
    }
  }
  #buildRiverRouteLookup() {
    for (const river of this.#mapData.riverData ?? []) {
      const source = river.cells[0];
      let flowX = 0;
      let flowZ = 0;
      if (source?.direction === "EAST") {
        flowX = 1;
      } else if (source?.direction === "WEST") {
        flowX = -1;
      } else if (source?.direction === "SOUTH") {
        flowZ = 1;
      } else if (source?.direction === "NORTH") {
        flowZ = -1;
      }
      if (
        source &&
        (flowX !== 0 || flowZ !== 0)
      ) {
        this.#riverSourceCovers.push({
          col: source.col,
          row: source.row,
          centerX: source.col - (this.#mapData.cols - 1) / 2,
          centerZ: source.row - (this.#mapData.rows - 1) / 2,
          flowX,
          flowZ,
          height: source.terrainHeight + GRASS_SURFACE_LIFT,
        });
      }
      for (const [index, cell] of river.cells.entries()) {
        this.#riverRoutesByCell.set(`${cell.col},${cell.row}`, {
          river,
          index,
          cell,
        });
      }
    }
  }

  #riverRouteEntryAt(x, z) {
    const col = Math.round(x + (this.#mapData.cols - 1) / 2);
    const row = Math.round(z + (this.#mapData.rows - 1) / 2);
    return this.#riverRoutesByCell.get(`${col},${row}`) ?? null;
  }

  #riverSourceCoverHeightAt(x, z, col = null, row = null) {
    const epsilon = 0.000001;
    for (const cover of this.#riverSourceCovers) {
      if (
        (col !== null && cover.col !== col) ||
        (row !== null && cover.row !== row)
      ) {
        continue;
      }
      const relativeX = x - cover.centerX;
      const relativeZ = z - cover.centerZ;
      const forward = relativeX * cover.flowX + relativeZ * cover.flowZ;
      const across = -relativeX * cover.flowZ + relativeZ * cover.flowX;
      if (
        forward >= -0.5 - epsilon &&
        forward <= 0.5 + epsilon &&
        Math.abs(across) <= 0.5 + epsilon
      ) {
        return cover.height;
      }
    }
    return null;
  }

  #riverSourceCoverAtCell(col, row) {
    return (
      this.#riverSourceCovers.find(
        (cover) => cover.col === col && cover.row === row,
      ) ?? null
    );
  }

  #tryBeginDrowning() {
    if (
      this.#grounded ||
      this.#fallingToDeath ||
      this.#respawnAction ||
      this.#velocity.y > 0
    ) {
      return false;
    }
    if (
      this.#riverSourceCoverHeightAt(this.#position.x, this.#position.z) !==
      null
    ) {
      return false;
    }
    const routeEntry = this.#riverRouteEntryAt(
      this.#position.x,
      this.#position.z,
    );
    const entryClearance =
      routeEntry?.river.kind === RIVER_KIND.LAVA
        ? LAVA_ENTRY_CLEARANCE
        : DROWNING_ENTRY_CLEARANCE;
    if (
      !routeEntry ||
      routeEntry.cell.underBridge ||
      this.#position.y > routeEntry.cell.elevation + entryClearance
    ) {
      return false;
    }
    if (routeEntry.river.kind === RIVER_KIND.LAVA) {
      this.#beginLavaDeath(routeEntry);
      return true;
    }
    this.#beginDrowning(routeEntry);
    return true;
  }

  #beginLavaDeath(routeEntry) {
    this.stopUsingTool({ dismiss: false });
    if (this.#collectAction?.tool) {
      this.#collectAction.tool.visible = false;
    }
    this.#collectAction?.heldItem?.destroy();
    this.#collectAction = null;
    this.#inventoryFullAction = null;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#blockedDigReactionAction = null;
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#jumpBufferRemaining = 0;
    this.#grounded = false;
    this.#coyoteRemaining = 0;
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#position.y = routeEntry.cell.elevation + 0.02;
    this.#lavaDeathAction = {
      elapsed: 0,
      surfaceY: this.#position.y,
    };
    this.#lavaAshes = false;
    this.#physics.setScripted(this.#position, this.#velocity);
    this.#lavaDeathEffect?.begin();
    this.#restartAnimation = true;
    this.#resetBoredom();
    this.#emitState();
  }

  #advanceLavaDeath(deltaTime) {
    const action = this.#lavaDeathAction;
    if (!action) {
      return;
    }
    action.elapsed = Math.min(LAVA_BURN_DURATION, action.elapsed + deltaTime);
    const progress = action.elapsed / LAVA_BURN_DURATION;
    const sinkProgress = Math.max(0, Math.min(1, (progress - 0.08) / 0.72));
    const easedSink = sinkProgress * sinkProgress * (3 - 2 * sinkProgress);
    this.#position.y =
      action.surfaceY - LAVA_SUBMERGE_DEPTH * easedSink;
    this.#lavaDeathEffect?.update(progress);
    const collapseProgress = Math.max(0, Math.min(1, (progress - 0.28) / 0.48));
    const modelScale = HERO_MODEL_SCALE * (1 - collapseProgress);
    this.#modelRoot?.setLocalScale(
      modelScale,
      modelScale * (1 - collapseProgress * 0.35),
      modelScale,
    );
    if (!this.#lavaAshes && progress >= LAVA_ASH_START) {
      this.#lavaAshes = true;
      this.#emitState();
    }
    if (action.elapsed < LAVA_BURN_DURATION) {
      return;
    }
    this.#lavaDeathAction = null;
    this.#lavaDeathEffect?.complete();
    this.#modelRoot?.setLocalScale(0, 0, 0);
    this.#loseLifeAndRespawn();
  }

  #beginDrowning(routeEntry) {
    this.stopUsingTool({ dismiss: false });
    if (this.#collectAction?.tool) {
      this.#collectAction.tool.visible = false;
    }
    this.#collectAction?.heldItem?.destroy();
    this.#collectAction = null;
    this.#inventoryFullAction = null;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#blockedDigReactionAction = null;
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#jumpBufferRemaining = 0;
    this.#grounded = false;
    this.#coyoteRemaining = 0;
    this.#drowningAction = {
      river: routeEntry.river,
      targetIndex: Math.min(
        routeEntry.index + 1,
        routeEntry.river.cells.length - 1,
      ),
      exiting: false,
      elapsed: 0,
    };
    const direction = this.#riverDirectionVector(routeEntry.cell.direction);
    this.#velocity = {
      x: direction.x * RIVER_CURRENT_SPEED,
      y: 0,
      z: direction.z * RIVER_CURRENT_SPEED,
    };
    this.#position.y =
      routeEntry.cell.elevation - DROWNING_SUBMERGE_DEPTH;
    this.#physics.gravity = 0;
    this.#physics.teleport(this.#position, this.#velocity);
    this.#setDrowningPresentation(true);
    this.#restartAnimation = true;
    this.#resetBoredom();
  }

  #advanceDrowningAction(deltaTime) {
    const action = this.#drowningAction;
    if (!action) {
      return;
    }
    action.elapsed += deltaTime;
    const cells = action.river.cells;
    const terminal = cells[cells.length - 1];
    const targetCell = action.exiting ? terminal : cells[action.targetIndex];
    const direction = this.#riverDirectionVector(targetCell.direction);
    const climbsBridge =
      targetCell.underBridge && this.#canClimbRiverBridge(targetCell);
    const targetX =
      targetCell.col -
      (this.#mapData.cols - 1) / 2 +
      (action.exiting
        ? direction.x * RIVER_EXIT_DISTANCE
        : climbsBridge
          ? -direction.x * RIVER_BRIDGE_APPROACH_OFFSET
          : 0);
    const targetZ =
      targetCell.row -
      (this.#mapData.rows - 1) / 2 +
      (action.exiting
        ? direction.z * RIVER_EXIT_DISTANCE
        : climbsBridge
          ? -direction.z * RIVER_BRIDGE_APPROACH_OFFSET
          : 0);
    const deltaX = targetX - this.#position.x;
    const deltaZ = targetZ - this.#position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= RIVER_WAYPOINT_EPSILON) {
      if (action.exiting) {
        this.#finishDrowningAtWaterfall(direction);
        return;
      }
      if (climbsBridge) {
        this.#beginRiverBridgeExit(targetCell);
        return;
      }
      if (action.targetIndex < cells.length - 1) {
        action.targetIndex += 1;
      } else {
        action.exiting = true;
      }
    }

    const currentRouteEntry = this.#riverRouteEntryAt(
      this.#position.x,
      this.#position.z,
    );
    const waterElevation =
      currentRouteEntry?.cell.elevation ?? targetCell.elevation;
    const targetY =
      waterElevation -
      DROWNING_SUBMERGE_DEPTH +
      HeroWaterMotion.offsetAt(action.elapsed);
    const verticalVelocity = Math.max(
      -DROWNING_SINK_SPEED,
      Math.min(
        DROWNING_SINK_SPEED,
        (targetY - this.#position.y) * DROWNING_SINK_SPEED,
      ),
    );
    if (distance > RIVER_WAYPOINT_EPSILON) {
      this.#velocity.x = (deltaX / distance) * RIVER_CURRENT_SPEED;
      this.#velocity.z = (deltaZ / distance) * RIVER_CURRENT_SPEED;
    } else {
      this.#velocity.x = 0;
      this.#velocity.z = 0;
    }
    this.#velocity.y = verticalVelocity;
  }
  #beginRiverBridgeExit(bridgeCell) {
    this.#setDrowningPresentation(false);
    this.#velocity = { x: 0, y: 0, z: 0 };
    const direction = this.#riverDirectionVector(bridgeCell.direction);
    const bridgeX = bridgeCell.col - (this.#mapData.cols - 1) / 2;
    const bridgeZ = bridgeCell.row - (this.#mapData.rows - 1) / 2;
    this.#drowningAction = null;
    this.#physics.gravity = GRAVITY;
    this.#physics.setScripted(this.#position, this.#velocity);
    this.#bridgeClimbAction = {
      cell: bridgeCell,
      direction,
      elapsed: 0,
      startX: this.#position.x,
      startY: this.#position.y,
      startZ: this.#position.z,
      railX: bridgeX - direction.x * RIVER_BRIDGE_RAIL_OFFSET,
      railZ: bridgeZ - direction.z * RIVER_BRIDGE_RAIL_OFFSET,
      deckX: bridgeX,
      deckZ: bridgeZ,
    };
    this.#restartAnimation = true;
  }

  #canClimbRiverBridge(bridgeCell) {
    return (
      bridgeCell.terrainHeight - bridgeCell.elevation <=
      RIVER_BRIDGE_MAX_CLIMB_HEIGHT
    );
  }

  #advanceRiverBridgeExit(deltaTime) {
    const bridgeExit = this.#bridgeClimbAction;
    if (!bridgeExit) {
      return;
    }
    bridgeExit.elapsed = Math.min(
      RIVER_BRIDGE_EXIT_DURATION,
      bridgeExit.elapsed + deltaTime,
    );
    const progress = bridgeExit.elapsed / RIVER_BRIDGE_EXIT_DURATION;
    const catchProgress = RIVER_BRIDGE_CATCH_END / RIVER_BRIDGE_EXIT_DURATION;
    const climbProgress = RIVER_BRIDGE_CLIMB_END / RIVER_BRIDGE_EXIT_DURATION;
    const catchY =
      bridgeExit.cell.terrainHeight - RIVER_BRIDGE_CATCH_HEIGHT_OFFSET;
    const railY =
      bridgeExit.cell.terrainHeight + RIVER_BRIDGE_RAIL_OFFSET;
    let nextX;
    let nextY;
    let nextZ;
    if (progress < catchProgress) {
      const phase = this.#smoothProgress(progress / catchProgress);
      nextX = bridgeExit.startX;
      nextY = bridgeExit.startY + (catchY - bridgeExit.startY) * phase;
      nextZ = bridgeExit.startZ;
    } else if (progress < climbProgress) {
      const phase = this.#smoothProgress(
        (progress - catchProgress) / (climbProgress - catchProgress),
      );
      const pullPhase = phase * phase;
      nextX =
        bridgeExit.startX +
        (bridgeExit.railX - bridgeExit.startX) * pullPhase;
      nextY = catchY + (railY - catchY) * phase;
      nextZ =
        bridgeExit.startZ +
        (bridgeExit.railZ - bridgeExit.startZ) * pullPhase;
    } else {
      const phase = this.#smoothProgress(
        (progress - climbProgress) / (1 - climbProgress),
      );
      nextX = bridgeExit.railX + (bridgeExit.deckX - bridgeExit.railX) * phase;
      nextY =
        railY +
        (bridgeExit.cell.terrainHeight - railY) * phase +
        Math.sin(phase * Math.PI) * RIVER_BRIDGE_HOP_HEIGHT;
      nextZ = bridgeExit.railZ + (bridgeExit.deckZ - bridgeExit.railZ) * phase;
    }
    const previousX = this.#position.x;
    const previousY = this.#position.y;
    const previousZ = this.#position.z;
    this.#position.x = nextX;
    this.#position.y = nextY;
    this.#position.z = nextZ;
    this.#velocity.x = (this.#position.x - previousX) / deltaTime;
    this.#velocity.y = (this.#position.y - previousY) / deltaTime;
    this.#velocity.z = (this.#position.z - previousZ) / deltaTime;
    if (progress < 1) {
      return;
    }
    this.#bridgeClimbAction = null;
    this.#resetRiverBridgeExitPose();
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#coyoteRemaining = COYOTE_TIME;
    this.#jumpsUsed = 0;
    this.#stableGroundPosition = { ...this.#position };
    this.#physics.resume(this.#position, this.#velocity);
    this.#restartAnimation = true;
  }

  #finishDrowningAtWaterfall(direction) {
    this.#drowningAction = null;
    this.#setDrowningPresentation(false);
    this.#velocity = {
      x: direction.x * RIVER_CURRENT_SPEED,
      y: -1.2,
      z: direction.z * RIVER_CURRENT_SPEED,
    };
    this.#physics.gravity = GRAVITY;
    this.#beginFallDeath();
  }

  #setDrowningPresentation(drowning) {
    if (!this.#modelRoot || !this.#headEntity) {
      return;
    }
    if (!drowning) {
      for (const [entity, enabled] of this.#drowningRenderStates) {
        if (entity.render) {
          entity.render.enabled = enabled;
        }
      }
      this.#drowningRenderStates.clear();
      return;
    }

    const visibleHeadEntities = new Set();
    const headPending = [this.#headEntity];
    while (headPending.length) {
      const entity = headPending.pop();
      visibleHeadEntities.add(entity);
      headPending.push(...entity.children);
    }
    const pending = [this.#modelRoot];
    while (pending.length) {
      const entity = pending.pop();
      if (entity.render) {
        this.#drowningRenderStates.set(entity, entity.render.enabled);
        entity.render.enabled = visibleHeadEntities.has(entity);
      }
      pending.push(...entity.children);
    }
  }

  #riverDirectionVector(direction) {
    if (direction === "NORTH") {
      return { x: 0, z: -1 };
    }
    if (direction === "EAST") {
      return { x: 1, z: 0 };
    }
    if (direction === "SOUTH") {
      return { x: 0, z: 1 };
    }
    return { x: -1, z: 0 };
  }

  #smoothProgress(progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    return clamped * clamped * (3 - 2 * clamped);
  }

  #applyPosition(previousX, previousY, previousZ) {
    const bodyPosition = this.#physics.position;
    const positionWasScripted =
      Math.abs(bodyPosition.x - this.#position.x) > 0.000001 ||
      Math.abs(bodyPosition.y - this.#position.y) > 0.000001 ||
      Math.abs(bodyPosition.z - this.#position.z) > 0.000001;
    if (this.#physics.scripted) {
      this.#physics.setScripted(this.#position, this.#velocity);
    } else if (positionWasScripted) {
      this.#physics.teleport(this.#position, this.#velocity);
    } else {
      this.#physics.velocity = this.#velocity;
    }
    this.#position = this.#physics.position;
    this.#velocity = this.#physics.velocity;
    if (
      previousX !== this.#position.x ||
      previousY !== this.#position.y ||
      previousZ !== this.#position.z
    ) {
      this.#onPositionChange?.(this.#position);
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
    if (this.#overheadClearanceBlockedAt(x, z)) {
      return OCCUPANCY.blocked;
    }
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
        const riverSourceCover =
          type === TileType.WATER
            ? this.#riverSourceCoverAtCell(col, row)
            : null;
        if (riverSourceCover) {
          continue;
        }
        if (!checksEdges && type === TileType.WATER) {
          continue;
        }
        const height = this.#terrainSurfaceHeightAt(col, row, toX, toZ);
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
    const sourceCoverHeight = this.#riverSourceCoverHeightAt(x, z);
    if (
      sourceCoverHeight !== null &&
      sourceCoverHeight <= maximumSupportHeight
    ) {
      highestSurface =
        highestSurface === null
          ? sourceCoverHeight
          : Math.max(highestSurface, sourceCoverHeight);
    }
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
        const terrainSurface = this.#terrainSurfaceHeightAt(col, row, x, z);
        const overpassSurface =
          this.#mapData.tileMeta?.[row]?.[col]?.overpass?.elevation;
        for (const surfaceHeight of [terrainSurface, overpassSurface]) {
          if (
            !Number.isFinite(surfaceHeight) ||
            surfaceHeight > maximumSupportHeight ||
            (highestSurface !== null && surfaceHeight <= highestSurface)
          ) {
            continue;
          }
          highestSurface = surfaceHeight;
        }
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
    return this.#patEscape.active || (!this.#patControlsLocked
      && Math.hypot(this.#input.x, this.#input.y) > 0.001);
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
      const sourceCoverHeight =
        type === TileType.WATER
          ? this.#riverSourceCoverHeightAt(x, z, col, row)
          : null;
      return sourceCoverHeight !== null && sourceCoverHeight <= maximumHeight
        ? sourceCoverHeight
        : null;
    }
    // Authored stairs extend onto approach PATH/GRASS cells, not just the
    // castle's foundation tiles. Sample their support for feet and landing too.
    const collisionSurface = this.#collisionWorld?.surfaceHeightAt(x, z);
    let highestSurface =
      Number.isFinite(collisionSurface) && collisionSurface <= maximumHeight
        ? collisionSurface
        : null;
    const terrainSurface = this.#terrainSurfaceHeightAt(col, row, x, z);
    const overpassSurface =
      this.#mapData.tileMeta?.[row]?.[col]?.overpass?.elevation;
    for (const surfaceHeight of [terrainSurface, overpassSurface]) {
      if (
        Number.isFinite(surfaceHeight) &&
        surfaceHeight <= maximumHeight &&
        (highestSurface === null || surfaceHeight > highestSurface)
      ) {
        highestSurface = surfaceHeight;
      }
    }
    return highestSurface;
  }

  #terrainSurfaceHeightAt(col, row, x, z) {
    const type = this.#mapData.grid[row][col];
    const metadata = this.#mapData.tileMeta?.[row]?.[col];
    const slope = metadata?.slope;
    if (metadata?.shape === TILE_SHAPE.SLOPE && slope) {
      const gridX = x + (this.#mapData.cols - 1) / 2;
      const gridZ = z + (this.#mapData.rows - 1) / 2;
      const localX = Math.max(0, Math.min(1, gridX - col + 0.5));
      const localZ = Math.max(0, Math.min(1, gridZ - row + 0.5));
      const progress =
        slope.riseDirection === SLOPE_DIRECTION.NORTH
          ? 1 - localZ
          : slope.riseDirection === SLOPE_DIRECTION.SOUTH
            ? localZ
            : slope.riseDirection === SLOPE_DIRECTION.WEST
              ? 1 - localX
              : localX;
      return slope.lowHeight +
        (slope.highHeight - slope.lowHeight) * progress;
    }
    return (
      this.#mapData.heightmap[row][col] +
      (GRASS_SURFACE_TILES.has(type) ? GRASS_SURFACE_LIFT : 0)
    );
  }

  #overheadClearanceBlockedAt(x, z) {
    const ceiling = this.#collisionWorld?.ceilingHeightAt(
      x,
      z,
      MOVEMENT_COLLISION_RADIUS,
      this.#position.y,
    );
    return (
      Number.isFinite(ceiling) &&
      this.#position.y + HERO_COLLISION_HEIGHT > ceiling
    );
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

  #advanceBlockedDigReaction(deltaTime) {
    if (!this.#blockedDigReactionAction) {
      return;
    }
    this.#blockedDigReactionAction.elapsed = Math.min(
      BLOCKED_DIG_REACTION_DURATION,
      this.#blockedDigReactionAction.elapsed + deltaTime,
    );
    if (
      this.#blockedDigReactionAction.elapsed < BLOCKED_DIG_REACTION_DURATION
    ) {
      return;
    }
    this.#blockedDigReactionAction = null;
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
    this.#physics.gravity = GRAVITY;
    if (this.#drowningAction) {
      this.#drowningAction = null;
      this.#setDrowningPresentation(false);
    }
    if (this.#bridgeClimbAction) {
      this.#bridgeClimbAction = null;
      this.#resetRiverBridgeExitPose();
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
    this.#blockedDigReactionAction = null;
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#jumpBufferRemaining = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
  }

  #handleFallDeath() {
    this.#beginFallDeath();
    this.#loseLifeAndRespawn();
  }

  #loseLifeAndRespawn() {
    this.#lives = Math.max(0, this.#lives - 1);
    if (this.#lives === 0) {
      this.#gameOver = true;
      this.#velocity = { x: 0, y: 0, z: 0 };
      this.#physics.setScripted(this.#position, this.#velocity);
      this.#emitState();
      return;
    }

    this.#resetLavaDeathPresentation();
    this.#position = { ...this.#spawn };
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#coyoteRemaining = COYOTE_TIME;
    this.#jumpBufferRemaining = 0;
    this.#jumpsUsed = 0;
    this.#movementBlocked = false;
    this.#edgeRefusalAction = null;
    this.#holeRefusalAction = null;
    this.#blockedDigReactionAction = null;
    this.#holeRefusalAcknowledged = false;
    this.#stableGroundPosition = { ...this.#spawn };
    this.#repelAction = null;
    this.#dodgeAction = null;
    this.#fallingToDeath = false;
    this.#respawnAction = { elapsed: 0 };
    this.#physics.gravity = GRAVITY;
    this.#physics.resume(this.#position, this.#velocity);
    this.#respawnEffect.begin(this.#facingYaw, this.#position.y);
    this.#updateRespawnPresentation();
    this.#gatewayRepelCooldown = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
    this.#emitState();
  }

  #resetLavaDeathPresentation() {
    this.#lavaDeathAction = null;
    this.#lavaAshes = false;
    this.#lavaDeathEffect?.reset();
    this.#modelRoot?.setLocalScale(
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
    );
  }

  #animate(deltaTime) {
    if (!this.#entity || !this.#modelRoot) {
      return;
    }
    this.#facingHoldRemaining = Math.max(
      0,
      this.#facingHoldRemaining - deltaTime,
    );
    const horizontalSpeed = Math.hypot(this.#velocity.x, this.#velocity.z);
    const moodKind = this.#patMood.state.kind;
    this.#patReactionRemaining = this.canBePatted && !this.#patEscape.active
      && !this.#hasMovementInput && horizontalSpeed <= 0.08
      && (moodKind === HERO_MOOD.AGITATED || moodKind === HERO_MOOD.ANGRY)
      ? Math.max(0, this.#patReactionRemaining - deltaTime) : 0;
    const blocked =
      this.#hasMovementInput &&
      this.#movementBlocked &&
      !this.#holeMovementBlocked &&
      horizontalSpeed <= 0.08;
    const showingBlockedPush = blocked && !this.#blockedPushFinished;
    const refusingEdge = this.#edgeRefusalAction !== null;
    const refusingHole = this.#holeRefusalAction !== null;
    const reactingToBlockedDig = this.#blockedDigReactionAction !== null;
    const drowning = this.#drowningAction !== null;
    const bridgeClimbing = this.#bridgeClimbAction !== null;
    const burning = this.#lavaDeathAction !== null;
    const facingVelocity = this.#dodgeAction
      ? this.#dodgeAction.facing
      : refusingEdge
        ? this.#edgeRefusalAction.direction
        : refusingHole
          ? this.#holeRefusalAction.direction
          : blocked
            ? this.#desiredVelocity()
            : this.#hasMovementInput
              ? { x: this.#velocity.x, z: this.#velocity.z }
              : this.facingDirection;
    const locksDodgeFacing =
      this.#dodgeAction?.direction === "left" ||
      this.#dodgeAction?.direction === "right";
    const previousFacingYaw = this.#facingYaw;
    if (
      !this.#fallingToDeath &&
      !burning &&
      !this.#respawnAction &&
      !this.#repelAction &&
      this.#facingHoldRemaining === 0 &&
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
    if (burning || this.#fallingToDeath) {
      animation = HERO_ANIMATION.FALL_DEATH;
      this.#resetBoredom();
    } else if (bridgeClimbing) {
      const bridgeExitElapsed = this.#bridgeClimbAction.elapsed;
      animation =
        bridgeExitElapsed < RIVER_BRIDGE_CLIMB_END
          ? HERO_ANIMATION.BLOCKED_PUSH
          : HERO_ANIMATION.JUMP;
      this.#resetBoredom();
    } else if (drowning) {
      animation = HERO_ANIMATION.IDLE;
      this.#resetBoredom();
    } else if (this.#respawnAction) {
      animation = HERO_ANIMATION.RESPAWN;
      this.#resetBoredom();
    } else if (refusingHole) {
      animation = HERO_ANIMATION.HOLE_REFUSAL;
      this.#resetBoredom();
    } else if (reactingToBlockedDig) {
      animation = HERO_ANIMATION.DIG_BLOCKED_ANNOYED;
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
      animationSpeed =
        DODGE_ANIMATION_DURATION / this.#dodgeAction.duration;
      this.#resetBoredom();
    } else if (!this.#grounded && this.#coyoteRemaining === 0) {
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
      const running = this.#running || this.#patEscape.active;
      animation = running ? HERO_ANIMATION.RUN : HERO_ANIMATION.WALK;
      const expectedSpeed = running ? RUN_SPEED : MOVE_SPEED;
      animationSpeed = Math.max(
        0.75,
        Math.min(1.25, horizontalSpeed / expectedSpeed),
      );
      this.#resetBoredom();
    } else if (this.#patReactionRemaining > 0) {
      animation = HERO_ANIMATION.PAT_ANNOYED;
      this.#resetBoredom();
    } else if (this.#patMood.state.kind !== HERO_MOOD.CALM) {
      animation = HERO_ANIMATION.IDLE;
      this.#resetBoredom();
    } else {
      animation = this.#selectIdleAnimation(deltaTime);
    }
    this.#playAnimation(animation, animationSpeed, this.#restartAnimation);
    this.#restartAnimation = false;
    if (
      animation !== HERO_ANIMATION.PAT_ANNOYED &&
      animation !== HERO_ANIMATION.DIG_BLOCKED_ANNOYED
    ) {
      for (const morph of this.#faceMorphs) {
        morph.setWeight("HappyPat", 0);
        morph.setWeight("AngryPat", 0);
        morph.setWeight("AnnoyedPat", 0);
        morph.setWeight("Blink", 0);
      }
    }
    if (drowning) {
      this.#updateDrowningHeadPanic();
    } else if (animation !== HERO_ANIMATION.PAT_ANNOYED) {
      this.#updateHeadLook(deltaTime);
    }
    if (bridgeClimbing) {
      this.#updateRiverBridgeExitPose();
    }
    this.#footPlacement?.update(
      deltaTime,
      this.#grounded &&
        !this.#gameOver &&
        !this.#dodgeAction &&
        !this.#fallingToDeath &&
        !this.#respawnAction &&
        !drowning &&
        !bridgeClimbing &&
        !burning,
    );
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
      this.#blockedDigReactionAction ||
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
    if (this.#blockedDigReactionAction) {
      this.#headLookYaw = 0;
      return;
    }
    if (this.#holeRefusalAction) {
      this.#headLookYaw = 0;
      return;
    }
    this.#setAngryFace(0);
    this.#headLookYaw = this.#lerpAngle(
      this.#headLookYaw,
      this.#headLookTargetYaw,
      Math.min(1, deltaTime * HEAD_LOOK_RESPONSE),
    );
    this.#headEntity?.setLocalEulerAngles(0, this.#headLookYaw, 0);
    if (this.canBePatted) {
      this.#updatePatFace();
    }
  }

  #updatePatFace() {
    const { kind, elapsed, patPulse, agitation, remaining } = this.#patMood.state;
    if (kind === HERO_MOOD.CALM) {
      return;
    }
    const fade = Math.min(1, remaining);
    if (kind === HERO_MOOD.HAPPY) {
      // Squint into a contented smile and lean into each pat.
      const squint = (0.65 + patPulse * 0.25) * fade;
      this.#leftEyeEntity?.setLocalScale(1, 1 - squint, 1);
      this.#rightEyeEntity?.setLocalScale(1, 1 - squint, 1);
      this.#leftEyeEntity?.setLocalEulerAngles(0, 0, 10 * fade);
      this.#rightEyeEntity?.setLocalEulerAngles(0, 0, -10 * fade);
      this.#mouthEntity?.setLocalScale(1 + fade * 0.35, 1 + fade * 0.45, 1);
      if (this.#faceMorphs.length) {
        for (const morph of this.#faceMorphs) {
          morph.setWeight("HappyPat", fade);
        }
        this.#leftEyeEntity?.setLocalScale(1, 1, 1);
        this.#rightEyeEntity?.setLocalScale(1, 1, 1);
        // Authored morphs already follow the faceted face. Rotating the fitted
        // eye meshes would pull their edges away from that surface.
        this.#leftEyeEntity?.setLocalEulerAngles(0, 0, 0);
        this.#rightEyeEntity?.setLocalEulerAngles(0, 0, 0);
        this.#mouthEntity?.setLocalScale(1, 1, 1);
      }
      this.#headEntity?.setLocalEulerAngles(
        -6 * fade + Math.sin(patPulse * Math.PI) * 8,
        this.#headLookYaw * 0.3,
        Math.sin(elapsed * 3.5) * 5 * fade,
      );
    } else {
      const anger = agitation;
      this.#setAngryFace(anger);
      this.#headEntity?.setLocalEulerAngles(
        10 * anger, Math.sin(elapsed * 15) * 9 * anger,
        Math.sin(elapsed * 24) * 3 * anger,
      );
    }
  }

  #setAngryFace(amount) {
    if (this.#faceMorphs.length) {
      for (const morph of this.#faceMorphs) {
        morph.setWeight("AngryPat", amount);
      }
      for (const entity of [this.#leftEyeEntity, this.#rightEyeEntity, this.#mouthEntity]) {
        entity?.setLocalScale(1, 1, 1);
        entity?.setLocalEulerAngles(0, 0, 0);
      }
      return;
    }
    const eyeHeight = 1 - amount * 0.68;
    const eyeWidth = 1 + amount * 0.15;
    this.#leftEyeEntity?.setLocalScale(eyeWidth, eyeHeight, 1);
    this.#rightEyeEntity?.setLocalScale(eyeWidth, eyeHeight, 1);
    this.#leftEyeEntity?.setLocalEulerAngles(
      0,
      0,
      -BLOCKED_DIG_EYE_ANGLE * amount,
    );
    this.#rightEyeEntity?.setLocalEulerAngles(
      0,
      0,
      BLOCKED_DIG_EYE_ANGLE * amount,
    );
    this.#mouthEntity?.setLocalScale(
      1 + amount * 0.42,
      1 - amount * 0.72,
      1,
    );
  }

  #updateDrowningHeadPanic() {
    const elapsed = this.#drowningAction?.elapsed ?? 0;
    const scanningYaw =
      Math.sin(elapsed * 9.5) * 29 +
      Math.sin(elapsed * 17.3 + 1.2) * 11;
    const startledJerk =
      Math.max(0, Math.sin(elapsed * 4.1) - 0.68) *
      Math.sin(elapsed * 31) *
      25;
    const yaw = Math.max(
      -DROWNING_HEAD_YAW_LIMIT,
      Math.min(DROWNING_HEAD_YAW_LIMIT, scanningYaw + startledJerk),
    );
    const pitch =
      7 + Math.sin(elapsed * 13.1 + 0.4) * 8 + Math.sin(elapsed * 27) * 3;
    const roll =
      Math.sin(elapsed * 11.7 + 0.8) * 8 +
      Math.sin(elapsed * 23.5) * 2.5;
    this.#headLookYaw = yaw;
    this.#headEntity?.setLocalEulerAngles(pitch, yaw, roll);
    const gasp = 1.5 + (Math.sin(elapsed * 15.5) + 1) * 0.22;
    this.#mouthEntity?.setLocalScale(1, gasp, 1);
  }

  #updateRiverBridgeExitPose() {
    const elapsed = this.#bridgeClimbAction?.elapsed;
    if (elapsed === undefined) {
      return;
    }
    let armPitch;
    let armSpread;
    if (elapsed < RIVER_BRIDGE_CATCH_END) {
      const phase = this.#smoothProgress(
        elapsed / RIVER_BRIDGE_CATCH_END,
      );
      armPitch = -92 * phase;
      armSpread = 12 * phase;
    } else if (elapsed < RIVER_BRIDGE_CLIMB_END) {
      const phase = this.#smoothProgress(
        (elapsed - RIVER_BRIDGE_CATCH_END) /
          (RIVER_BRIDGE_CLIMB_END - RIVER_BRIDGE_CATCH_END),
      );
      armPitch = -92 + phase * 27;
      armSpread = 12 - phase * 5;
    } else {
      const phase = this.#smoothProgress(
        (elapsed - RIVER_BRIDGE_CLIMB_END) /
          (RIVER_BRIDGE_EXIT_DURATION - RIVER_BRIDGE_CLIMB_END),
      );
      armPitch = -65 * (1 - phase);
      armSpread = 7 * (1 - phase);
    }
    this.#leftArmEntity?.setLocalEulerAngles(armPitch, 0, -armSpread);
    this.#rightArmEntity?.setLocalEulerAngles(armPitch, 0, armSpread);
    const effortPitch =
      elapsed < RIVER_BRIDGE_CLIMB_END
        ? -10 + Math.sin(elapsed * 18) * 4
        : -10 *
          (1 -
            (elapsed - RIVER_BRIDGE_CLIMB_END) /
              (RIVER_BRIDGE_EXIT_DURATION - RIVER_BRIDGE_CLIMB_END));
    this.#headEntity?.setLocalEulerAngles(effortPitch, 0, 0);
  }

  #resetRiverBridgeExitPose() {
    this.#leftArmEntity?.setLocalEulerAngles(0, 0, 0);
    this.#rightArmEntity?.setLocalEulerAngles(0, 0, 0);
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
    this.#hairPhysics = new HeroHairPhysics({
      pc: this.#pc,
      app: this.#app,
      headEntity: this.#headEntity,
      hairEntities:
        this.#headEntity?.children.filter((entity) =>
          HAIR_ENTITY_NAME.test(entity.name),
        ) ?? [],
      modelScale: HERO_MODEL_SCALE,
    });
    this.#mouthEntity = this.#findModelEntity("Mouth");
    this.#leftEyeEntity = this.#findModelEntity("Eye");
    this.#rightEyeEntity = this.#findModelEntity("Eye.001");
    this.#faceMorphs = [
      this.#mouthEntity, this.#leftEyeEntity, this.#rightEyeEntity,
      this.#findModelEntity("Left cyan eyebrow"),
      this.#findModelEntity("Right cyan eyebrow"),
    ]
      .flatMap((entity) => entity?.render?.meshInstances ?? [])
      .map((mesh) => mesh.morphInstance)
      .filter((morph) => morph?.morph.targets.some((target) => target.name === "HappyPat"));
    this.#leftArmEntity = this.#findModelEntity("Left arm");
    this.#rightArmEntity = this.#findModelEntity("Right arm");
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
    this.#footPlacement = new HeroFootPlacement({
      pc: this.#pc,
      surfaceAt: (x, z, maximumHeight) =>
        this.#physics.surfaceAt(x, z, maximumHeight),
      getHeroPosition: () => this.#position,
      left: {
        side: "left",
        leg: this.#findModelEntity("Left leg"),
        sole: this.#findModelEntity("Boot sole"),
        cuff: this.#findModelEntity("Boot cuff"),
        tiltingParts: [
          "Boot shaft",
          "Boot front strap",
          "Boot foot",
          "Boot heel",
          "Boot sole",
          "Boot toe",
        ].map((name) => this.#findModelEntity(name)),
      },
      right: {
        side: "right",
        leg: this.#findModelEntity("Right leg"),
        sole: this.#findModelEntity("Boot sole.001"),
        cuff: this.#findModelEntity("Boot cuff.001"),
        tiltingParts: [
          "Boot shaft.001",
          "Boot front strap.001",
          "Boot foot.001",
          "Boot heel.001",
          "Boot sole.001",
          "Boot toe.001",
        ].map((name) => this.#findModelEntity(name)),
      },
    });
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
    const { duration } = this.#dodgeAction;
    this.#dodgeAction.elapsed = Math.min(
      duration,
      this.#dodgeAction.elapsed + deltaTime,
    );
    if (this.#dodgeAction.elapsed < duration) {
      return;
    }
    const crossedLedge = this.#dodgeAction.crossedLedge;
    this.#dodgeAction = null;
    if (crossedLedge) {
      const riverRouteEntry = this.#riverRouteEntryAt(
        this.#position.x,
        this.#position.z,
      );
      if (!riverRouteEntry || riverRouteEntry.cell.underBridge) {
        this.#beginFallDeath();
      }
    }
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
      drowning: this.#drowningAction !== null,
      burning: this.burning,
      ashes: this.#lavaAshes,
      wallet: this.wallet,
      inventory: this.inventory,
      mood: this.mood,
      buffs: this.buffs,
      stats: this.stats,
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
