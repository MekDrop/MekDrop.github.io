import { HeroTerrain } from "./HeroTerrain.js";
import { HeroFootSupport } from "./HeroFootSupport.js";
import { HeroMovementSurface } from "./HeroMovementSurface.js";
import {
  STEP_CLEARANCE,
  MAX_SAFE_STEP_DOWN,
  HERO_RADIUS,
  HERO_COLLISION_HEIGHT,
  MOVEMENT_COLLISION_RADIUS,
  MOVEMENT_FORWARD_COLLISION_OFFSET,
  WALKABLE_TILES,
  GRASS_SURFACE_TILES,
} from "./HeroSurfaceRules.js";
import { TileType } from "../../generator/map/MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "../../config/terrain.js";
import heroModelUrl from "../../models/hero/hero.glb?url";
import { HeroRespawnEffect } from "./HeroRespawnEffect.js";
import { FOOT_SIDE } from "../../enum/FootSide.js";
import { HERO_ANIMATION } from "../../enum/HeroAnimation.js";
import { HERO_ACTION } from "../../enum/HeroAction.js";
import { OCCUPANCY } from "../../enum/Occupancy.js";
import { COIN_TYPE } from "../../enum/CoinType.js";
import { MOVEMENT_REFUSAL } from "../../enum/MovementRefusal.js";
import { HERO_INVENTORY_CAPACITY } from "../../config/inventory.js";
import { pickupActionForCategory } from "../../config/hero-pickup-actions.js";
import { HeroPhysicsController } from "./HeroPhysicsController.js";
import { addHeroPartColliders } from "./HeroPartColliders.js";
import { HeroFootPlacement } from "./HeroFootPlacement.js";
import { HeroEmotionBehavior } from "./behaviors/emotion/HeroEmotionBehavior.js";
import { HeroAngryEscapeBehavior } from "./behaviors/action/HeroAngryEscapeBehavior.js";
import { HeroIdleBehavior } from "./behaviors/action/HeroIdleBehavior.js";
import { HeroActionBehavior } from "./behaviors/action/HeroActionBehavior.js";
import { HeroHairPhysics } from "./HeroHairPhysics.js";
import { HERO_MOOD } from "../../enum/HeroMood.js";
import { HERO_STAT } from "../../enum/HeroStat.js";
import { BuffSystem } from "../../buffs/BuffSystem.js";
import { AxeTool, KnifeTool, ShovelTool } from "./tools/index.js";
import { projectFirstPersonMovement } from "./projectFirstPersonMovement.js";

/**
 * @typedef {{capacity: number, items: Array<{id: string, variant: string, quantity?: number}>}} HeroInventory
 * @typedef {object} HeroState
 * @property {number} lives
 * @property {number} maxLives
 * @property {boolean} gameOver
 * @property {boolean} drowning
 * @property {boolean} burning
 * @property {boolean} ashes
 * @property {Record<string, number>} wallet
 * @property {HeroInventory} inventory
 * @property {{kind: string, speedMultiplier: number, escaping: boolean}} mood
 * @property {string} action
 * @property {Array<{type: string, remaining: number}>} buffs
 * @property {{walkSpeed: number, runSpeed: number}} stats
 * @typedef {{inventory: HeroInventory, addInventoryItem: (item: {id: string, variant: string, quantity?: number}) => boolean}} HeroConfigurationStore
 * @typedef {object} HeroPresentation
 * @property {{setMood: (mood: {kind: string}|null) => void, sync: (state: HeroState) => void, $reset: () => void} [stateStore]
 * @property {{setLives: (lives: number, maximum: number) => void}} [lifeHud]
 * @property {{setWallet: (wallet: Record<string, number>) => void}} [coinHud]
 * @property {{setInventory: (inventory: HeroInventory) => void, showFullReaction: (position: {x: number, y: number}|null) => void}} [inventoryScene]
 * @property {{syncHeroState: (state: HeroState) => void}} [gameOverScene]
 * @property {() => {x: number, y: number}|null} [getInventoryFullScreenPosition]
 * @property {() => {x: number, y: number}|null} [getMoodScreenPosition]
 */

const MAX_FRAME_TIME = 0.1;
const MOVE_SPEED = 4.2;
const RUN_SPEED = 6.3;
const GROUND_ACCELERATION = 24;
const AIR_ACCELERATION = 10;
const BRAKING = 30;
const GRAVITY = -22;
const MAX_JUMP_HEIGHT = 2;
const JUMP_VELOCITY = Math.sqrt(-2 * GRAVITY * MAX_JUMP_HEIGHT);
const DODGE_DISTANCE = 3;
const SIDE_DODGE_JUMP_HEIGHT = 0.68;
const FORWARD_BACK_DODGE_JUMP_HEIGHT = 1;
const DODGE_ANIMATION_DURATION = 0.6;
const DODGE_REQUIRED_RUNWAY = 1;
const MAX_JUMPS = 2;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.12;
const AIRBORNE_STALL_RELEASE_DELAY = 0.08;
const AIRBORNE_STALL_POSITION_EPSILON = 0.0005;
const AIRBORNE_STALL_FALL_SPEED = 0.6;
const MAX_LIVES = 3;
const RESPAWN_ANIMATION_DURATION = 1.55;
const RESPAWN_START_HEIGHT = 1;
const MIN_AUTOMATIC_STEP_HEIGHT = 0.04;
const MAX_AUTOMATIC_STEP_HEIGHT = 0.32;
const AUTOMATIC_STEP_SURFACE_CLEARANCE = 0.015;
const AUTOMATIC_STEP_GROUNDING_GRACE = 0.2;
const AUTOMATIC_STEP_VISUAL_RESPONSE = 14;
const ANIMATION_BLEND_TIME = 0.14;
const BLOCKED_PUSH_DURATION = 1;
const HEAD_LOOK_MAX_YAW = 55;
const HEAD_LOOK_RESPONSE = 7;
const HERO_ANIMATION_NAMES = Object.freeze(Object.values(HERO_ANIMATION));
const LOOPING_ANIMATIONS = new Set([
  HERO_ANIMATION.IDLE,
  HERO_ANIMATION.WALK,
  HERO_ANIMATION.RUN,
  HERO_ANIMATION.BLOCKED_PUSH,
]);
const EDGE_REFUSAL_DURATION = 0.8;
const HOLE_REFUSAL_DURATION = 1.45;
const BLOCKED_DIG_REACTION_DURATION = 42 / 24;
const BLOCKED_DIG_EYE_ANGLE = 20;
const INVENTORY_FULL_COLLAPSE_DURATION = 52 / 24;
const INVENTORY_FULL_EFFECT_TIME = 14 / 24;
const INVENTORY_FULL_INDICATOR_CLEARANCE = 0.82;
const FALL_EXIT_HEIGHT = -14;
const RIVER_CURRENT_SPEED = 1.45;
const RIVER_WAYPOINT_EPSILON = 0.035;
const RIVER_EXIT_DISTANCE = 0.72;
const DROWNING_ENTRY_CLEARANCE = 0.32;
const LAVA_ENTRY_CLEARANCE = 0.12;
const DROWNING_SUBMERGE_DEPTH = 0.68;
const DROWNING_SINK_SPEED = 2.8;
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
// Halfway between the original hero size and the terrace-sized version.
const HERO_MODEL_SCALE = (0.65 + (2.2 * 0.45) / 2.645) / 2;
const GATEWAY_REPEL_DURATION = 0.5;
const GATEWAY_REPEL_SPEED = 2.2;
const GATEWAY_REPEL_COOLDOWN = 0.2;
const PICKUP_POSITIONING_DURATION = 0.24;
const PAT_ANNOYED_DURATION = 1.25;
const PAT_HAIR_CONTACT_HEIGHT = 0.78;
const HAIR_ENTITY_NAME = /(?:hair|nape lock|swept fringe|layered lock)/i;

export class Hero {
  /**
   * @type {HeroTerrain}
   */
  #terrain;

  /**
   * @type {HeroFootSupport}
   */
  #footSupport;

  /**
   * @type {HeroMovementSurface}
   */
  #movementSurface;

  /**
   *
    * @type {BuffSystem}
   */
  #buffs = new BuffSystem();
  /**
   *
    * @type {HeroEmotionBehavior}
   */
  #emotionBehavior = new HeroEmotionBehavior(this.#buffs);
  /**
   *
    * @type {HeroAngryEscapeBehavior}
   */
  #angryEscapeBehavior = new HeroAngryEscapeBehavior();
  /**
   *
    * @type {HeroIdleBehavior}
   */
  #idleBehavior = new HeroIdleBehavior();
  /**
   *
    * @type {Array<{meshInstance: import("playcanvas").MeshInstance, morphInstance: import("playcanvas").MorphInstance}>}
   */
  #faceMorphs = [];

  /**
   *
    * @returns {string}
   */
  get mood() {
    return {
      ...this.#emotionBehavior.state,
      speedMultiplier: this.#buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, 1),
      escaping: this.#angryEscapeBehavior.active,
      target: this.#angryEscapeBehavior.target,
    };
  }

  /**
   *
    * @returns {Array<{type: string, remaining: number}>}
   */
  get buffs() {
    return this.#buffs.state;
  }

  /**
   *
    * @returns {{walkSpeed: number, runSpeed: number}}
   */
  get stats() {
    return {
      walkSpeed: this.#buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, MOVE_SPEED),
      runSpeed: this.#buffs.modifyStat(HERO_STAT.MOVEMENT_SPEED, RUN_SPEED),
    };
  }

  /**
   *
   * @param {string} id
   * @param {{duration?: number, stacks?: number}} options
   */
  applyBuff(id, options) {
    if (
      this.#actionBehavior.gameOver ||
      this.isIncapacitated ||
      !this.#buffs.apply(id, options)
    ) {
      return false;
    }
    this.#syncState();
    return true;
  }

  /**
   *
   * @param {string} id
   */
  removeBuff(id) {
    if (!this.#buffs.remove(id)) {
      return false;
    }
    this.#syncState();
    return true;
  }

  /**
   *
    * @returns {boolean}
   */
  get canBePatted() {
    return Boolean(this.#headEntity)
      && !this.#firstPersonCameraEnabled
      && this.#grounded
      && this.#actionBehavior.canBePatted;
  }

  /**
   *
    * @returns {{x: number, y: number, z: number}}
   */
  get patPosition() {
    return this.#headEntity?.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0, PAT_HAIR_CONTACT_HEIGHT, 0),
    ) ?? null;
  }

  pat() {
    if (!this.canBePatted) {
      return false;
    }
    const reaction = this.#emotionBehavior.reactToPat();
    if (reaction.kind === HERO_MOOD.ANGRY) {
      if (reaction.reinforceAnger) {
        const { reacted } = this.#attemptEmotionAction();
        if (!reacted) {
          return false;
        }
      } else {
        this.#startAngryEscape();
      }
      return true;
    }
    if (reaction.agitated && !this.#angryEscapeBehavior.active && !this.#hasMovementInput
      && this.#actionBehavior.patReactionRemaining === 0) {
      this.#actionBehavior.patReactionRemaining = PAT_ANNOYED_DURATION;
      this.#setAngryFace(0);
    }
    if (!reaction.accepted) {
      return false;
    }
    this.#resetBoredom();
    this.#syncState();
    return true;
  }

  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return heroModelUrl;
  }

  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      Hero.modelUrl,
      AxeTool.modelUrl,
      KnifeTool.modelUrl,
      ShovelTool.modelUrl,
    ];
  }

  /**
   *
    * @returns {number}
   */
  static get inventoryCapacity() {
    return HERO_INVENTORY_CAPACITY;
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
   *
    * @type {import("src/game/objects/ObjectTypes.js").GameMapData}
   */
  #mapData;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #spawnCenter;
  /**
   *
    * @type {() => number}
   */
  #getViewRotation;
  /**
   *
    * @type {() => {x: number, y: number, z: number}}
   */
  #getViewDirection;
  /**
   *
    * @type {(position: {x: number, y: number, z: number}) => void}
   */
  #onPositionChange;
  /**
   *
    * @type {(yaw: number) => void}
   */
  #onFacingChange;
  /**
   *
    * @type {import("src/game/collision/GroundCollisionWorld.js").GroundCollisionWorld}
   */
  #collisionWorld;
  /**
   *
    * @type {import("src/game/models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {HeroPhysicsController}
   */
  #physics;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #modelRoot;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #headEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #mouthEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #leftEyeEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #rightEyeEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #leftArmEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #rightArmEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #toolAttachmentEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #rightHeldItemAttachmentEntity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #leftHeldItemAttachmentEntity;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").Point3}
   */
  #spawn;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #velocity = { x: 0, y: 0, z: 0 };
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").Point3}
   */
  #input = { x: 0, y: 0 };
  /**
   *
    * @type {boolean}
   */
  #running = false;
  /**
   *
    * @type {boolean}
   */
  #movementBlocked = false;
  /**
   *
    * @type {number}
   */
  #automaticStepGroundingRemaining = 0;
  /**
   *
    * @type {number|null}
   */
  #automaticStepTargetHeight = null;
  /**
   *
    * @type {number}
   */
  #automaticStepVisualOffset = 0;
  /**
   *
    * @type {Array<import("playcanvas").Entity>}
   */
  #heroPartColliders = [];
  /**
   *
    * @type {number}
   */
  #airborneStallElapsed = 0;
  /**
   *
    * @type {boolean}
   */
  #partCollidersSuspended = false;
  /**
   *
    * @type {number}
   */
  #blockedPushElapsed = 0;
  /**
   *
    * @type {boolean}
   */
  #blockedPushFinished = false;
  /**
   *
    * @type {boolean}
   */
  #holeRefusalAcknowledged = false;
  /**
   *
    * @type {boolean}
   */
  #holeMovementBlocked = false;
  /**
   *
    * @type {string|number}
   */
  #lastEdgeRefusalFoot = FOOT_SIDE.RIGHT;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #stableGroundPosition;
  /**
   *
    * @type {boolean}
   */
  #grounded = true;
  /**
   *
    * @type {boolean}
   */
  #physicsSupportContact = false;
  /**
   *
    * @type {number}
   */
  #coyoteRemaining = COYOTE_TIME;
  /**
   *
    * @type {number}
   */
  #jumpBufferRemaining = 0;
  /**
   *
    * @type {number}
   */
  #jumpsUsed = 0;
  /**
   *
    * @type {number}
   */
  #facingYaw = 0;
  /**
   *
    * @type {boolean}
   */
  #animationState = null;
  /**
   *
    * @type {boolean}
   */
  #restartAnimation = false;
  /**
   *
    * @type {string}
   */
  #idleLookTarget = null;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #queuedFacingDirection = null;
  /**
   *
    * @type {number}
   */
  #headLookYaw = 0;
  /**
   *
    * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;
  /**
   *
    * @type {import("src/game/objects/hero/tools/HeroTool.js").HeroTool|null}
   */
  #tool = null;
  /**
   *
    * @type {Map}
   */
  #tools = new Map();
  /**
   *
    * @type {number}
   */
  #facingHoldRemaining = 0;
  /**
   *
    * @type {number}
   */
  #movementAnimationHoldRemaining = 0;
  /**
   *
    * @type {string}
   */
  #actionBehavior;
  /**
   *
    * @type {number}
   */
  #respawnEffect = null;
  /**
   *
    * @type {HeroFootPlacement}
   */
  #footPlacement = null;
  /**
   * @type {Set<string>[]|null}
   */
  #visualIslandCells = null;
  /**
   * @type {number[]}
   */
  #visualIslandOffsets = [0, 0];
  /**
   *
    * @type {HeroHairPhysics|null}
   */
  #hairPhysics = null;
  /**
   *
    * @type {Map}
   */
  #riverRoutesByCell = new Map();
  /**
   *
    * @type {Array<import("./HeroSurfaceTypes.js").RiverSourceCover>}
   */
  #riverSourceCovers = [];
  /**
   *
    * @type {Map}
   */
  #drowningRenderStates = new Map();
  /**
   *
    * @type {number}
   */
  #lives = MAX_LIVES;
  /**
   *
    * @type {number}
   */
  #gatewayRepelCooldown = 0;
  /**
   *
    * @type {Record<string, number>}
   */
  #wallet = {
    [COIN_TYPE.GOLD]: 0,
    [COIN_TYPE.SILVER]: 0,
    [COIN_TYPE.COPPER]: 0,
  };
  /**
   *
    * @type {HeroConfigurationStore}
   */
  #heroConfigurationStore;
  /**
   *
    * @type {(x: number, z: number) => void}
   */
  #onMovementInput;
  /**
   *
    * @type {HeroPresentation}
   */
  #presentation;
  /**
   *
    * @type {boolean}
   */
  #moodVisible = false;
  /**
   *
    * @type {boolean}
   */
  #firstPersonCameraEnabled = false;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, mapData: import("src/game/objects/ObjectTypes.js").GameMapData, spawnCenter: {x: number, y: number, z: number}, getViewRotation: () => number, getViewDirection: () => {x: number, y: number, z: number}, onPositionChange: (position: {x: number, y: number, z: number}) => void, onFacingChange: (yaw: number) => void, onMovementInput: (x: number, z: number) => void, heroConfigurationStore: HeroConfigurationStore, presentation: HeroPresentation, collisionWorld: import("src/game/collision/GroundCollisionWorld.js").GroundCollisionWorld, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {{x: number, y: number, z: number}} options.spawnCenter
   * @param {() => number} options.getViewRotation
   * @param {() => {x: number, y: number, z: number}} options.getViewDirection
   * @param {(position: {x: number, y: number, z: number}) => void} options.onPositionChange
   * @param {(yaw: number) => void} options.onFacingChange
   * @param {(x: number, z: number) => void} options.onMovementInput
   * @param {HeroConfigurationStore} options.heroConfigurationStore
   * @param {HeroPresentation} options.presentation
   * @param {import("src/game/collision/GroundCollisionWorld.js").GroundCollisionWorld} options.collisionWorld
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   */
  constructor({
    pc,
    app,
    mapData,
    spawnCenter = { x: 0, z: 0 },
    getViewRotation,
    getViewDirection,
    onPositionChange,
    onFacingChange,
    onMovementInput,
    heroConfigurationStore,
    presentation,
    collisionWorld,
    modelLibrary,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    if (mapData.islandConnectorData) {
      this.#visualIslandCells = [
        new Set(mapData.islandConnectorData.nearIsland),
        new Set(mapData.islandConnectorData.farIsland),
      ];
    }
    this.#buildRiverRouteLookup();
    this.#spawnCenter = spawnCenter;
    this.#getViewRotation = getViewRotation;
    this.#getViewDirection = getViewDirection;
    this.#onPositionChange = onPositionChange;
    this.#onFacingChange = onFacingChange;
    this.#heroConfigurationStore = heroConfigurationStore;
    this.#onMovementInput = onMovementInput;
    this.#presentation = presentation;
    this.#collisionWorld = collisionWorld;
    this.#terrain = new HeroTerrain(
      mapData,
      collisionWorld,
      this.#riverSourceCovers,
    );
    this.#footSupport = new HeroFootSupport(this.#terrain);
    this.#movementSurface = new HeroMovementSurface(
      this.#terrain,
      this.#footSupport,
      collisionWorld,
    );
    this.#modelLibrary = modelLibrary;
    this.#tools.set(AxeTool.name, new AxeTool({ modelLibrary }));
    this.#tools.set(KnifeTool.name, new KnifeTool({ modelLibrary }));
    this.#tools.set(ShovelTool.name, new ShovelTool({ modelLibrary }));
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
    this.#actionBehavior = new HeroActionBehavior({
      bridgeClimbEnd: RIVER_BRIDGE_CLIMB_END,
      dodgeAnimationDuration: DODGE_ANIMATION_DURATION,
      edgeRefusalDuration: EDGE_REFUSAL_DURATION,
      holeRefusalDuration: HOLE_REFUSAL_DURATION,
      blockedDigReactionDuration: BLOCKED_DIG_REACTION_DURATION,
      repelDuration: GATEWAY_REPEL_DURATION,
      repelSpeed: GATEWAY_REPEL_SPEED,
      feedback: {
        actionComplete: () => {
          this.#restartAnimation = true;
        },
        tool: {
          /**
           *
           * @param {string} action
           */
          begin: (action) => {
            action.tool.mount(this.#toolAttachmentEntity);
            action.tool.visible = true;
            this.#tool = action.tool;
            this.#velocity.x = 0;
            this.#velocity.z = 0;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
          restartAnimation: () => {
            this.#restartAnimation = true;
          },
          /**
           *
           * @param {string} action
           */
          complete: (action) => {
            action.tool.visible = false;
            this.#tool = null;
            this.#restartAnimation = true;
            action.onComplete?.();
          },
        },
        collection: {
          positioningDuration: PICKUP_POSITIONING_DURATION,
          fullEffectTime: INVENTORY_FULL_EFFECT_TIME,
          fullDuration: INVENTORY_FULL_COLLAPSE_DURATION,
          /**
           *
           * @param {number} x
           * @param {number} z
           */
          canOccupy: (x, z) =>
            this.#movementSurface.occupancyAt(x, z, this.#surfaceState) === OCCUPANCY.open,
          /**
           *
           * @param {number} x
           * @param {number} z
           */
          moveTo: (x, z) => {
            this.#position.x = x;
            this.#position.z = z;
          },
          /**
           *
           * @param {import("../ground-cover/GroundCoverHeldItem.js").GroundCoverHeldItem} item
           * @param {import("playcanvas").Entity} attachment
           */
          mountHeldItem: (item, attachment) =>
            item.mount(this.#entity, attachment),
          /**
           *
           * @param {string} action
           */
          begin: (action) => {
            if (action.tool) {
              action.tool.mount(this.#toolAttachmentEntity);
              action.tool.visible = true;
            }
            this.#velocity.x = 0;
            this.#velocity.z = 0;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
          beginInventoryFull: () => {
            this.#velocity.x = 0;
            this.#velocity.z = 0;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
          restartAnimation: () => {
            this.#restartAnimation = true;
          },
          /**
           *
           * @param {string} action
           */
          endCollection: (action) => {
            if (action.tool) {
              action.tool.visible = false;
            }
            action.heldItem?.destroy();
            this.#restartAnimation = true;
            if (action.completed) {
              action.onComplete?.();
            }
          },
          showInventoryFull: () => this.#showInventoryFull(),
          /**
           *
           * @param {string} action
           */
          endInventoryFull: (action) => {
            this.#restartAnimation = true;
            if (action.completed) {
              action.onComplete?.();
            }
          },
        },
        dodge: {
          /**
           *
           * @param {number} crossedLedge
           */
          complete: (crossedLedge) => {
            if (crossedLedge) {
              const riverRouteEntry = this.#riverRouteEntryAt(
                this.#position.x,
                this.#position.z,
              );
              const landingSurface = this.#physics.surfaceAt(
                this.#position.x,
                this.#position.z,
                this.#position.y + STEP_CLEARANCE,
                FALL_EXIT_HEIGHT,
              );
              if (
                (!riverRouteEntry || riverRouteEntry.cell.underBridge)
                && landingSurface === null
              ) {
                this.#actionBehavior.fallingToDeath = true;
              }
            }
            this.#restartAnimation = true;
          },
        },
        patReaction: {
          shouldContinue: () => {
            const kind = this.#emotionBehavior.state.kind;
            return this.canBePatted
              && !this.#angryEscapeBehavior.active
              && !this.#hasMovementInput
              && Math.hypot(this.#velocity.x, this.#velocity.z) <= 0.08
              && (kind === HERO_MOOD.AGITATED || kind === HERO_MOOD.ANGRY);
          },
        },
        repel: {
          /**
           *
           * @param {{x: number, y: number, z: number}} direction
           */
          begin: (direction) => {
            this.#velocity.x = direction.x * GATEWAY_REPEL_SPEED;
            this.#velocity.z = direction.z * GATEWAY_REPEL_SPEED;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
          end: () => {
            this.#gatewayRepelCooldown = GATEWAY_REPEL_COOLDOWN;
          },
        },
        refusal: {
          /**
           *
           * @param {{foot: import("src/game/objects/ObjectTypes.js").HeroFootRig}} options
           * @param {import("src/game/objects/ObjectTypes.js").HeroFootRig} options.foot
           */
          beginEdge: ({ foot }) => {
            this.#lastEdgeRefusalFoot = foot;
            this.#velocity.x = 0;
            this.#velocity.z = 0;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
          beginHole: () => {
            this.#velocity.x = 0;
            this.#velocity.z = 0;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
        },
        blockedDig: {
          begin: () => {
            this.#velocity.x = 0;
            this.#velocity.z = 0;
            this.#restartAnimation = true;
            this.#resetBoredom();
          },
        },
        drowning: {
          lavaEntryClearance: LAVA_ENTRY_CLEARANCE,
          waterEntryClearance: DROWNING_ENTRY_CLEARANCE,
          mapColumns: this.#mapData.cols,
          mapRows: this.#mapData.rows,
          waypointEpsilon: RIVER_WAYPOINT_EPSILON,
          exitDistance: RIVER_EXIT_DISTANCE,
          bridgeApproachOffset: RIVER_BRIDGE_APPROACH_OFFSET,
          submergeDepth: DROWNING_SUBMERGE_DEPTH,
          sinkSpeed: DROWNING_SINK_SPEED,
          currentSpeed: RIVER_CURRENT_SPEED,
          situation: () => ({
            grounded: this.#grounded,
            fallingToDeath: this.#actionBehavior?.fallingToDeath ?? false,
            respawning: this.#actionBehavior?.respawning ?? false,
            verticalVelocity: this.#velocity.y,
            position: this.#position,
          }),
          /**
           *
           * @param {{x: number, z: number}} options
           * @param {number} options.x
           * @param {number} options.z
           */
          hasRiverSourceCover: ({ x, z }) =>
            this.#terrain.riverSourceCoverHeightAt(x, z) !== null,
          /**
           *
           * @param {{x: number, z: number}} options
           * @param {number} options.x
           * @param {number} options.z
           */
          routeEntryAt: ({ x, z }) => this.#riverRouteEntryAt(x, z),
          position: () => this.#position,
          /**
           *
           * @param {{x: number, y: number, z: number}} direction
           */
          directionVector: (direction) => this.#riverDirectionVector(direction),
          /**
           *
           * @param {number} cell
           */
          canClimbBridge: (cell) => this.#canClimbRiverBridge(cell),
          /**
           *
           * @param {{x: number, y: number, z: number}} velocity
           */
          setVelocity: (velocity) => {
            this.#velocity = velocity;
          },
          /**
           *
           * @param {{x: number, y: number, z: number}} direction
           */
          finishAtWaterfall: (direction) =>
            this.#finishDrowningAtWaterfall(direction),
          /**
           *
           * @param {number} routeEntry
           */
          begin: (routeEntry) => this.#beginDrowning(routeEntry),
          endPresentation: () => this.#setDrowningPresentation(false),
          /**
           *
           * @param {{pitch: number, yaw: number, roll: number, mouthScale: {x: number, y: number, z: number}}} options
           * @param {number} options.pitch
           * @param {number} options.yaw
           * @param {number} options.roll
           * @param {{x: number, y: number, z: number}} options.mouthScale
           */
          updatePresentation: ({ pitch, yaw, roll, mouthScale }) => {
            this.#headLookYaw = yaw;
            this.#headEntity?.setLocalEulerAngles(pitch, yaw, roll);
            this.#mouthEntity?.setLocalScale(1, mouthScale, 1);
          },
        },
        bridgeClimb: {
          duration: RIVER_BRIDGE_EXIT_DURATION,
          catchEnd: RIVER_BRIDGE_CATCH_END,
          climbEnd: RIVER_BRIDGE_CLIMB_END,
          catchHeightOffset: RIVER_BRIDGE_CATCH_HEIGHT_OFFSET,
          railOffset: RIVER_BRIDGE_RAIL_OFFSET,
          hopHeight: RIVER_BRIDGE_HOP_HEIGHT,
          /**
           *
           * @param {number} cell
           */
          begin: (cell) => this.#beginRiverBridgeExit(cell),
          /**
           *
           * @param {{x: number, y: number, z: number}} position
           * @param {number} deltaTime
           */
          moveTo: (position, deltaTime) => {
            const previous = this.#position;
            this.#position = position;
            this.#velocity = {
              x: (position.x - previous.x) / deltaTime,
              y: (position.y - previous.y) / deltaTime,
              z: (position.z - previous.z) / deltaTime,
            };
          },
          complete: () => this.#finishRiverBridgeExit(),
          /**
           *
           * @param {{armPitch: number, armSpread: number, headPitch: number}} options
           * @param {number} options.armPitch
           * @param {number} options.armSpread
           * @param {number} options.headPitch
           */
          updatePresentation: ({ armPitch, armSpread, headPitch }) => {
            this.#leftArmEntity?.setLocalEulerAngles(
              armPitch,
              0,
              -armSpread,
            );
            this.#rightArmEntity?.setLocalEulerAngles(
              armPitch,
              0,
              armSpread,
            );
            this.#headEntity?.setLocalEulerAngles(headPitch, 0, 0);
          },
          resetPresentation: () => {
            this.#leftArmEntity?.setLocalEulerAngles(0, 0, 0);
            this.#rightArmEntity?.setLocalEulerAngles(0, 0, 0);
          },
        },
        burning: {
          modelScale: HERO_MODEL_SCALE,
          lives: () => this.#lives,
          presentation: () => ({ pc, app, parent: this.#entity }),
          /**
           *
           * @param {number} height
           */
          freezeAtHeight: (height) => this.#freezeAtHeight(height),
          /**
           *
           * @param {number} height
           */
          setHeight: (height) => {
            this.#position.y = height;
          },
          /**
           *
           * @param {number} x
           * @param {number} y
           * @param {number} z
           */
          setModelScale: (x, y, z) => this.#modelRoot?.setLocalScale(x, y, z),
          syncState: () => this.#syncState(),
        },
        falling: {
          begin: () => this.#beginFallDeath(),
          finished: () => this.#position.y < FALL_EXIT_HEIGHT,
        },
        death: {
          resolve: () => this.#resolveDeath(),
        },
        respawning: {
          duration: RESPAWN_ANIMATION_DURATION,
          begin: () => this.#beginRespawn(),
          /**
           *
           * @param {number} progress
           * @param {number} elapsed
           */
          updatePresentation: (progress, elapsed) => {
            this.#respawnEffect?.update(progress, elapsed, this.#position.y);
          },
          resetPresentation: () => this.#respawnEffect?.reset(),
          complete: () => {
            this.#restartAnimation = true;
          },
        },
        gameOver: {
          begin: () => this.#beginGameOver(),
        },
      },
    });

    this.#createModel();
    this.#updateHandle = app.on("update", this.#update);
    this.#syncState();
    this.#presentation?.stateStore?.setMood(null);
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").Point3}
   */
  get position() {
    return { ...this.#position };
  }

  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandVisualOffsets(near, far) {
    this.#visualIslandOffsets[0] = near;
    this.#visualIslandOffsets[1] = far;
  }

  /**
   * @param {number} x
   * @param {number} z
   */
  #islandVisualOffsetAt(x, z) {
    const col = Math.round(x + (this.#mapData.cols - 1) / 2);
    const row = Math.round(z + (this.#mapData.rows - 1) / 2);
    const key = `${col},${row}`;
    const group = this.#visualIslandCells?.findIndex(/**
     * @param {Set<string>} cells
     */
    (cells) => cells.has(key)) ?? -1;
    return this.#visualIslandOffsets[group] ?? 0;
  }

  /**
   *
    * @returns {boolean}
   */
  get isUsingTool() {
    return this.#actionBehavior.toolAction !== null;
  }

  /**
   *
    * @returns {boolean}
   */
  get isCollecting() {
    return this.#actionBehavior.collectAction !== null;
  }

  /**
   *
    * @returns {boolean}
   */
  get isRefusingInventoryPickup() {
    return this.#actionBehavior.inventoryFullAction !== null;
  }

  get tool() {
    return this.#tool;
  }

  get tools() {
    return this.#tools;
  }

  /**
   *
    * @returns {Record<string, number>}
   */
  get wallet() {
    return { ...this.#wallet };
  }

  /**
   *
    * @returns {HeroInventory}
   */
  get inventory() {
    return {
      capacity: this.#heroConfigurationStore.inventory.capacity,
      items: this.#heroConfigurationStore.inventory.items.map(/**
       *
       * @param {{id: string, variant: string, quantity?: number}} item
       */
      (item) => ({
        ...item,
      })),
    };
  }

  /**
   *
    * @returns {boolean}
   */
  get inventoryFull() {
    return (
      this.#heroConfigurationStore.inventory.items.length >=
      this.#heroConfigurationStore.inventory.capacity
    );
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").Point3}
   */
  get inventoryFullIndicatorPosition() {
    const anchor = this.#headEntity?.getPosition() ?? this.#entity.getPosition();
    return {
      x: anchor.x,
      y: anchor.y + INVENTORY_FULL_INDICATOR_CLEARANCE,
      z: anchor.z,
    };
  }

  /**
   *
    * @returns {boolean}
   */
  get isGameOver() {
    return this.#actionBehavior.gameOver;
  }

  get animationState() {
    return this.#animationState;
  }

  /**
   *
    * @returns {boolean}
   */
  get animationTransitioning() {
    return this.#modelRoot?.anim?.baseLayer.transitioning ?? false;
  }

  get headLookYaw() {
    return this.#headLookYaw;
  }

  get grounded() {
    return this.#grounded;
  }

  /**
   *
    * @returns {Record<string, {appliedLift: number, minimumClearance: number, tiltDegrees: number}>|null}
   */
  get footPlacementState() {
    return this.#footPlacement?.state ?? null;
  }

  /**
   *
    * @returns {Array<{x: number, y: number, z: number, directionX: number, directionZ: number, strength: number}>}
   */
  get grassFootContacts() {
    return this.#footPlacement?.grassContacts ?? [];
  }

  /**
   *
    * @returns {boolean}
   */
  get isIncapacitated() {
    return this.#actionBehavior.incapacitated;
  }

  /**
   *
    * @returns {boolean}
   */
  get isDying() {
    return this.#actionBehavior.dying;
  }

  /**
   *
    * @returns {boolean}
   */
  get isRespawning() {
    return this.#actionBehavior.respawning;
  }

  /**
   *
    * @returns {boolean}
   */
  get drowning() {
    return this.#actionBehavior.drowning;
  }

  /**
   *
    * @returns {{head: import("playcanvas").Entity, x: number, z: number, surfaceY: number}|null}
   */
  get waterPresentation() {
    if (!this.#actionBehavior.drowningAction || !this.#headEntity) {
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

  /**
   *
    * @returns {boolean}
   */
  get burning() {
    return this.#actionBehavior.burning && !this.ashes;
  }

  /**
   * @returns {boolean}
   */
  get ashes() {
    return this.#actionBehavior.ashes;
  }

  /**
   *
    * @returns {boolean}
   */
  get isReacting() {
    return this.#actionBehavior.blockedDigReactionAction !== null || this.#actionsLocked;
  }

  /**
   *
    * @returns {string}
   */
  get actionState() {
    return this.#actionBehavior.state;
  }

  set boostingCountryFinances(value) {
    const wasBoosting = this.#actionBehavior.boostingCountryFinances;
    this.#actionBehavior.boostingCountryFinances = value;
    if (wasBoosting === this.#actionBehavior.boostingCountryFinances) {
      return;
    }
    this.#resetBoredom();
    this.#syncState();
  }

  /**
   *
    * @returns {number}
   */
  get #actionsLocked() {
    return this.#angryEscapeBehavior.active || !this.#emotionBehavior.acceptsActions;
  }

  /**
   *
   * @param {boolean} attempt
   */
  #acceptAction(attempt = true) {
    const acceptsEmotion = attempt
      ? this.#attemptEmotionAction().accepted
      : this.#emotionBehavior.acceptsActions;
    return acceptsEmotion && !this.#angryEscapeBehavior.active;
  }

  #attemptEmotionAction() {
    const buffRevision = this.#buffs.revision;
    const reactionRevision = this.#emotionBehavior.reactionRevision;
    const accepted = this.#emotionBehavior.attemptAction();
    const reacted = this.#emotionBehavior.reactionRevision !== reactionRevision;
    if (reacted) {
      this.#startAngryEscape();
    } else if (this.#buffs.revision !== buffRevision) {
      this.#syncState();
    }
    return {
      accepted,
      reacted,
    };
  }

  #startAngryEscape() {
    const distance = 3 + (this.#emotionBehavior.state.level - 1) * 1.5;
    this.#actionBehavior.patReactionRemaining = 0;
    this.#clearActionInput();
    this.#angryEscapeBehavior.begin(
      this.#position,
      /**
       *
       * @param {import("src/game/objects/ObjectTypes.js").Point3} from
       * @param {import("src/game/objects/ObjectTypes.js").Point3} to
       */
      (from, to) =>
        this.#movementSurface.canEscapeAcross(from, to, this.#surfaceState),
      Math.random,
      distance,
    );
    this.#actionBehavior.angryEscape = this.#angryEscapeBehavior.active;
    this.#jumpBufferRemaining = 0;
    this.#facingHoldRemaining = 0;
    this.#resetBoredom();
    this.#syncState();
  }

  #clearActionInput() {
    this.#input.x = 0;
    this.#input.y = 0;
    this.#running = false;
    this.#queuedFacingDirection = null;
    this.#facingHoldRemaining = 0;
    this.#movementAnimationHoldRemaining = 0;
    this.#jumpBufferRemaining = 0;
  }

  /**
   *
    * @returns {boolean}
   */
  get #restingForMood() {
    return this.canBePatted && !this.#angryEscapeBehavior.active
      && !this.#hasMovementInput
      && !this.#actionBehavior.bridgeClimbAction && this.#actionBehavior.patReactionRemaining === 0
      && Math.hypot(this.#velocity.x, this.#velocity.y, this.#velocity.z) <= 0.08;
  }

  /**
   *
    * @returns {{x: number, z: number}}
   */
  get facingDirection() {
    const yaw = (this.#facingYaw * Math.PI) / 180;
    return { x: Math.sin(yaw), z: Math.cos(yaw) };
  }

  /**
   *
    * @returns {boolean}
   */
  get firstPersonCameraPose() {
    const direction = this.facingDirection;
    const leftEye = this.#leftEyeEntity?.getPosition();
    const rightEye = this.#rightEyeEntity?.getPosition();
    const anchor =
      leftEye && rightEye
        ? {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2,
            z: (leftEye.z + rightEye.z) / 2,
          }
        : (this.#headEntity?.getPosition() ?? {
            x: this.#position.x,
            y: this.#position.y + HERO_COLLISION_HEIGHT * 0.8,
            z: this.#position.z,
          });
    return {
      position: {
        x: anchor.x,
        y: anchor.y,
        z: anchor.z,
      },
      direction: { x: direction.x, y: 0, z: direction.z },
    };
  }

  set firstPersonCameraEnabled(enabled) {
    this.#firstPersonCameraEnabled = Boolean(enabled);
    if (this.#firstPersonCameraEnabled) {
      this.#resetBoredom();
    }
    if (this.#headEntity) {
      this.#headEntity.enabled = !this.#firstPersonCameraEnabled;
    }
  }

  /**
   *
    * @returns {{direction: {x: number, z: number}, speed: number, running: boolean}}
   */
  get movementState() {
    const speed = Math.hypot(this.#velocity.x, this.#velocity.z);
    return {
      direction:
        speed > 0.001
          ? { x: this.#velocity.x / speed, z: this.#velocity.z / speed }
          : this.facingDirection,
      speed,
      running: (this.#running || this.#angryEscapeBehavior.active)
        && this.#grounded && speed > 0.08,
    };
  }

  set facingHoldDuration(duration) {
    if (this.#actionsLocked) {
      return;
    }
    this.#facingHoldRemaining = Math.max(0, duration ?? 0);
  }

  set movementAnimationHoldDuration(duration) {
    if (this.#actionsLocked) {
      return;
    }
    this.#movementAnimationHoldRemaining = Math.max(0, duration ?? 0);
  }

  /**
   *
   * @param {number} inputX
   * @param {number} inputY
   */
  queueFacingInput(inputX, inputY) {
    if (this.#actionsLocked) {
      return;
    }
    this.#queuedFacingDirection = this.#projectInput(inputX, inputY);
  }

  clearQueuedFacingInput() {
    this.#queuedFacingDirection = null;
  }

  /**
   *
   * @param {number} inputX
   * @param {number} inputY
   * @param {number} running
   */
  setMovement(inputX, inputY, running = false) {
    const hasInput = Math.hypot(inputX, inputY) > 0.001;
    if (!this.#acceptAction(hasInput)) {
      this.#clearActionInput();
      return;
    }
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
      !this.#actionBehavior.gameOver &&
      this.#hasMovementInput
    ) {
      this.stopUsingTool({ dismiss: false });
      this.#onMovementInput?.();
    }
  }

  jump() {
    if (!this.#acceptAction()) {
      return;
    }
    if (!this.#actionBehavior.canJump) {
      return;
    }
    if (this.#actionBehavior.edgeRefusalAction) {
      this.#actionBehavior.finish();
      this.#restartAnimation = true;
    }
    this.#jumpBufferRemaining = JUMP_BUFFER_TIME;
  }

  set idleLookTarget(target) {
    this.#idleLookTarget = target ? { x: target.x, z: target.z } : null;
  }

  /**
   *
   * @param {number} inputX
   * @param {number} inputY
   * @param {{x: number, y: number, z: number}} direction
   * @param {{facing: {x: number, y: number, z: number}}} options
   * @param {{x: number, y: number, z: number}} options.facing
   */
  dodge(inputX, inputY, direction, { facing = null } = {}) {
    if (!this.#acceptAction()) {
      return false;
    }
    if (
      !this.#actionBehavior.canStart(HERO_ACTION.DODGING, {
        grounded: this.#grounded,
      })
    ) {
      return false;
    }
    const projected = this.#projectInput(inputX, inputY);
    if (!projected) {
      return false;
    }
    const runwaySurface = this.#terrain.surfaceAt(
      this.#position.x + projected.x * DODGE_REQUIRED_RUNWAY,
      this.#position.z + projected.z * DODGE_REQUIRED_RUNWAY,
      this.#position.y + STEP_CLEARANCE,
    );
    if (runwaySurface === null) {
      return false;
    }

    this.#queuedFacingDirection = null;
    this.#movementAnimationHoldRemaining = 0;
    const dodgeFacing = this.#dodgeFacingDirection(
      direction,
      projected,
      facing,
    );
    if (direction === "down") {
      const previousFacingYaw = this.#facingYaw;
      this.#facingYaw =
        (Math.atan2(dodgeFacing.x, dodgeFacing.z) * 180) / Math.PI;
      this.#modelRoot?.setLocalEulerAngles(0, this.#facingYaw, 0);
      this.#respawnEffect?.setFacingYaw(this.#facingYaw);
      if (Math.abs(this.#facingYaw - previousFacingYaw) > 0.001) {
        this.#onFacingChange?.(this.facingDirection);
      }
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
    this.#actionBehavior.dodgeAction = {
      direction,
      x: projected.x,
      z: projected.z,
      facing: dodgeFacing,
      duration,
      speed,
      elapsed: 0,
      crossedLedge: false,
    };
    this.#restartAnimation = true;
    this.#resetBoredom();
    return true;
  }

  /**
   *
   * @param {import("./tools/HeroTool.js").HeroTool} tool
   * @param {{targetPosition: {x: number, y: number, z: number}, context: Record<string, string|number|boolean>, onImpact: (impact: import("src/game/objects/ObjectTypes.js").HeroActionPayload) => void, onComplete: () => void}} options
   * @param {{x: number, y: number, z: number}} options.targetPosition
   * @param {Record<string, string|number|boolean>} options.context
   * @param {(impact: import("src/game/objects/ObjectTypes.js").HeroActionPayload) => void} options.onImpact
   * @param {() => void} options.onComplete
   */
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
      !this.#acceptAction() ||
      !this.#actionBehavior.canStart(HERO_ACTION.USING_TOOL, {
        grounded: this.#grounded,
      })
    ) {
      return false;
    }

    const targetX = targetPosition.x - this.#position.x;
    const targetZ = targetPosition.z - this.#position.z;
    if (Math.hypot(targetX, targetZ) > 0.001) {
      this.#facingYaw = (Math.atan2(targetX, targetZ) * 180) / Math.PI;
    }
    this.#actionBehavior.toolAction = {
      tool,
      useAnimation,
      phase: "summon",
      elapsed: 0,
      impacted: false,
      stopAfterCycle: false,
      onImpact,
      onComplete,
    };
    return true;
  }

  /**
   *
   * @param {number} category
   * @param {{targetPosition: {x: number, y: number, z: number}, targetRadius: number, tool: import("src/game/objects/hero/tools/HeroTool.js").HeroTool, heldItem: boolean, onImpact: (impact: import("src/game/objects/ObjectTypes.js").HeroActionPayload) => void, onComplete: () => void}} options
   * @param {{x: number, y: number, z: number}} options.targetPosition
   * @param {number} options.targetRadius
   * @param {import("src/game/objects/hero/tools/HeroTool.js").HeroTool} options.tool
   * @param {boolean} options.heldItem
   * @param {(impact: import("src/game/objects/ObjectTypes.js").HeroActionPayload) => void} options.onImpact
   * @param {() => void} options.onComplete
   */
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
      !this.#acceptAction() ||
      !this.#actionBehavior.canStart(HERO_ACTION.COLLECTING, {
        grounded: this.#grounded,
      })
    ) {
      return false;
    }

    const targetX = targetPosition.x - this.#position.x;
    const targetZ = targetPosition.z - this.#position.z;
    const targetDistance = Math.hypot(targetX, targetZ);
    if (targetDistance > 0.001) {
      this.#facingYaw = (Math.atan2(targetX, targetZ) * 180) / Math.PI;
    }
    const pickupAction = pickupActionForCategory(category);
    if (!pickupAction) {
      return false;
    }
    const collectionTool = pickupAction.requiresTool ? tool : null;
    if (pickupAction.requiresTool && !collectionTool) {
      return false;
    }
    const positioning = this.#collectionPositioning({
      pickupAction,
      targetPosition,
      targetRadius,
      targetDistance,
    });
    this.#actionBehavior.collectAction = {
      animation: pickupAction.animation,
      duration: pickupAction.duration,
      impactTime: pickupAction.impactTime,
      elapsed: 0,
      impacted: false,
      positioning,
      positioningElapsed: 0,
      tool: collectionTool,
      heldItem,
      heldItemAttachmentEntity: pickupAction.heldItemAttachment === "left"
        ? this.#leftHeldItemAttachmentEntity
        : this.#rightHeldItemAttachmentEntity,
      heldItemHideTime: pickupAction.heldItemHideTime,
      onImpact,
      onComplete,
    };
    return true;
  }

  /**
   *
   * @param {string} type
   * @param {number} amount
   */
  collectCoin(type, amount = 1) {
    if (!Object.hasOwn(this.#wallet, type)) {
      return false;
    }
    this.#wallet[type] += Math.max(0, Math.floor(amount));
    this.#syncState();
    return true;
  }

  reactToBlockedDig() {
    if (
      !this.#acceptAction() ||
      !this.#actionBehavior.canStart(HERO_ACTION.BLOCKED_DIG_REACTION, {
        grounded: this.#grounded,
      })
    ) {
      return false;
    }
    this.#actionBehavior.blockedDigReactionAction = { elapsed: 0 };
    return true;
  }

  /**
   *
   * @param {{id: string, variant: string, quantity?: number}} item
   */
  collectInventoryItem(item) {
    if (!this.#heroConfigurationStore.addInventoryItem(item)) {
      this.#showInventoryFull();
      return false;
    }

    this.#syncState();
    return true;
  }

  /**
   *
   * @param {number} category
   * @param {{targetPosition: {x: number, y: number, z: number}, targetRadius: number, onComplete: () => void}} options
   * @param {{x: number, y: number, z: number}} options.targetPosition
   * @param {number} options.targetRadius
   * @param {() => void} options.onComplete
   */
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
      !this.#acceptAction() ||
      !this.#actionBehavior.canStart(HERO_ACTION.INVENTORY_FULL_REACTION, {
        grounded: this.#grounded,
      })
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
    this.#actionBehavior.inventoryFullAction = {
      elapsed: 0,
      notified: false,
      positioning,
      positioningElapsed: 0,
      onComplete,
    };
    return true;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} direction
   * @param {{x: number, y: number, z: number}} movementDirection
   * @param {{x: number, y: number, z: number}} facing
   */
  #dodgeFacingDirection(direction, movementDirection, facing = null) {
    if (direction === "down") {
      return facing ?? this.facingDirection;
    }
    if (direction !== "left" && direction !== "right") {
      return movementDirection;
    }
    return this.#projectInput(0, 1) ?? movementDirection;
  }

  /**
   *
   * @param {{dismiss: boolean}} options
   * @param {boolean} options.dismiss
   */
  stopUsingTool({ dismiss = true } = {}) {
    if (!this.#actionBehavior.toolAction) {
      return false;
    }
    if (dismiss && this.#actionBehavior.toolAction.phase !== "dismiss") {
      this.#actionBehavior.toolAction.phase = "dismiss";
      this.#actionBehavior.toolAction.elapsed = 0;
      this.#actionBehavior.toolAction.impacted = false;
      this.#restartAnimation = true;
    } else {
      this.#actionBehavior.toolAction = null;
    }
    return true;
  }

  destroy() {
    this.#buffs.clear();
    this.#presentation?.stateStore?.$reset();
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#actionBehavior.finish();
    this.#footPlacement?.destroy();
    this.#footPlacement = null;
    this.#hairPhysics?.destroy();
    this.#hairPhysics = null;
    this.#respawnEffect?.destroy();
    this.#respawnEffect = null;
    for (const tool of this.#tools.values()) {
      tool.destroy();
    }
    this.#tools.clear();
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
    this.#leftArmEntity = null;
    this.#rightArmEntity = null;
    this.#toolAttachmentEntity = null;
    this.#rightHeldItemAttachmentEntity = null;
    this.#leftHeldItemAttachmentEntity = null;
    this.#heroPartColliders = [];
    this.#animationState = null;
    this.#tool = null;
    this.#stableGroundPosition = null;
  }

  /**
   *
   * @param {number} deltaTime
    * @type {(deltaTime: number) => void}
   */
  #update = (deltaTime) => {
    this.#step(Math.min(deltaTime, MAX_FRAME_TIME));
    this.#animate(deltaTime);
    this.#hairPhysics?.update();
    this.#syncMood();
  };

  /**
   *
   * @param {number} deltaTime
   */
  #step(deltaTime) {
    const previousX = this.#position.x;
    const previousY = this.#position.y;
    const previousZ = this.#position.z;
    if (!this.#physics.scripted) {
      this.#position = this.#physics.position;
      this.#velocity = this.#physics.velocity;
      this.#physicsSupportContact = this.#physics.consumeSupportContact();
      this.#grounded =
        this.#velocity.y <= 0.2 &&
        (this.#physics.groundContact(this.#position) !== null ||
          this.#physicsSupportContact);
    }
    this.#automaticStepGroundingRemaining = Math.max(
      0,
      this.#automaticStepGroundingRemaining - deltaTime,
    );
    if (
      this.#automaticStepGroundingRemaining > 0 &&
      this.#velocity.y <= 0.2
    ) {
      this.#grounded = true;
    } else if (this.#automaticStepGroundingRemaining === 0) {
      this.#automaticStepTargetHeight = null;
    }
    const buffRevision = this.#buffs.revision;
    if (this.isIncapacitated || this.#actionBehavior.gameOver) {
      this.#buffs.clear();
      this.#emotionBehavior.reset();
      this.#angryEscapeBehavior.reset();
    } else {
      this.#buffs.advance(deltaTime, { resting: this.#restingForMood });
      this.#emotionBehavior.advance(deltaTime);
      this.#angryEscapeBehavior.advance(deltaTime, this.#position);
      if (this.#actionBehavior.angryEscape && !this.#angryEscapeBehavior.active) {
        this.#actionBehavior.angryEscape = false;
      }
    }
    if (this.#buffs.revision !== buffRevision) {
      this.#syncState();
    }
    if (this.#actionBehavior.gameOver) {
      return;
    }
    if (this.#actionBehavior.exclusive) {
      this.#actionBehavior.update(deltaTime);
      this.#applyPosition(previousX, previousY, previousZ);
      return;
    }
    this.#actionBehavior.update(deltaTime);
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
    this.#updateAirborneColliderRecovery(deltaTime, previousY);
    if (
      !this.#grounded &&
      this.#coyoteRemaining === 0 &&
      this.#jumpsUsed === 0
    ) {
      this.#jumpsUsed = 1;
    }

    const desired = this.#actionBehavior.movementFor(
      this.#desiredVelocity(),
      this.#velocity,
    );
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
    if (this.#partCollidersSuspended) {
      this.#velocity.x = 0;
      this.#velocity.z = 0;
      this.#velocity.y = Math.min(
        this.#velocity.y,
        -AIRBORNE_STALL_FALL_SPEED,
      );
    }

    const canGroundJump = this.#coyoteRemaining > 0;
    const canAirJump = !this.#grounded && this.#jumpsUsed < MAX_JUMPS;
    if (
      this.#actionBehavior.canJump &&
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

    this.#applyPosition(previousX, previousY, previousZ);
  }

  #desiredVelocity() {
    if (this.#angryEscapeBehavior.active) {
      return this.#angryEscapeBehavior.velocity(this.#position, RUN_SPEED);
    }
    if (this.#actionsLocked) {
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

  /**
   *
   * @param {number} inputX
   * @param {number} inputY
   */
  #projectInput(inputX, inputY) {
    const length = Math.hypot(inputX, inputY);
    if (length < 0.001) {
      return null;
    }

    const normalizedX = inputX / Math.max(1, length);
    const normalizedY = inputY / Math.max(1, length);
    const viewDirection = this.#getViewDirection?.();
    const firstPersonMovement = projectFirstPersonMovement(
      normalizedX,
      normalizedY,
      viewDirection,
    );
    if (firstPersonMovement) {
      return firstPersonMovement;
    }
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

  /**
   *
   * @param {number} deltaTime
   */
  #moveHorizontally(deltaTime) {
    const attemptedX = Math.abs(this.#velocity.x) > 0.001;
    const nextX = this.#position.x + this.#velocity.x * deltaTime;
    const nextZ = this.#position.z + this.#velocity.z * deltaTime;
    this.#tryAutomaticStepUp(nextX, nextZ);
    const occupancyX = this.#movementSurface.occupancyAt(
      nextX,
      this.#position.z,
      this.#surfaceState,
    );
    if (occupancyX !== OCCUPANCY.open) {
      this.#movementBlocked ||= attemptedX;
      if (attemptedX) {
        this.#tryMovementRefusal(nextX, this.#position.z);
      }
      if (attemptedX && occupancyX === OCCUPANCY.edge) {
        const direction = this.#movementDirection;
        this.#beginEdgeRefusal(
          this.#footSupport.unsupportedFootAt(
            nextX,
            this.#position.z,
            this.#position.y,
            direction,
            this.#alternateEdgeFoot,
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
    const occupancyZ = this.#movementSurface.occupancyAt(
      this.#position.x,
      nextZ,
      this.#surfaceState,
    );
    if (occupancyZ !== OCCUPANCY.open) {
      this.#movementBlocked ||= attemptedZ;
      if (attemptedZ) {
        this.#tryMovementRefusal(this.#position.x, nextZ);
      }
      if (attemptedZ && occupancyZ === OCCUPANCY.edge) {
        const direction = this.#movementDirection;
        this.#beginEdgeRefusal(
          this.#footSupport.unsupportedFootAt(
            this.#position.x,
            nextZ,
            this.#position.y,
            direction,
            this.#alternateEdgeFoot,
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

  /**
   *
   * @param {number} nextX
   * @param {number} nextZ
   */
  #tryAutomaticStepUp(nextX, nextZ) {
    if (
      !this.#grounded ||
      this.#actionBehavior.dodgeAction ||
      this.#actionBehavior.repelAction ||
      this.#physics.scripted
    ) {
      return false;
    }
    if (
      this.#automaticStepGroundingRemaining > 0 &&
      Number.isFinite(this.#automaticStepTargetHeight)
    ) {
      this.#position.y = Math.max(
        this.#position.y,
        this.#automaticStepTargetHeight,
      );
      this.#velocity.y = Math.max(0, this.#velocity.y);
    }
    const movementX = nextX - this.#position.x;
    const movementZ = nextZ - this.#position.z;
    const movementLength = Math.hypot(movementX, movementZ);
    if (movementLength <= 0.000001) {
      return false;
    }
    const probeX =
      nextX +
      (movementX / movementLength) * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const probeZ =
      nextZ +
      (movementZ / movementLength) * MOVEMENT_FORWARD_COLLISION_OFFSET;
    // Ammo's dynamic capsule has no configurable step offset. Apply a bounded
    // lift only when the support ahead is within a normal walking step.
    const physicsHeight = this.#physics.surfaceAt(
      probeX,
      probeZ,
      this.#position.y + MAX_AUTOMATIC_STEP_HEIGHT,
      this.#position.y - STEP_CLEARANCE,
    )?.height;
    const stepHeight = [physicsHeight]
      .filter(
        /**
         *
         * @param {number} height
         */
        (height) =>
          Number.isFinite(height) &&
          height - this.#position.y >= MIN_AUTOMATIC_STEP_HEIGHT &&
          height - this.#position.y <= MAX_AUTOMATIC_STEP_HEIGHT,
      )
      .reduce(
        /**
         *
         * @param {number} highest
         * @param {number} height
         */
        (highest, height) => Math.max(highest, height),
        -Infinity,
      );
    if (!Number.isFinite(stepHeight)) {
      return false;
    }
    const targetHeight = stepHeight + AUTOMATIC_STEP_SURFACE_CLEARANCE;
    const ceiling = this.#collisionWorld?.ceilingHeightAt(
      nextX,
      nextZ,
      MOVEMENT_COLLISION_RADIUS,
      this.#position.y,
    );
    if (
      Number.isFinite(ceiling) &&
      targetHeight + HERO_COLLISION_HEIGHT > ceiling
    ) {
      return false;
    }

    const stepRise = targetHeight - this.#position.y;
    this.#position.y = targetHeight;
    this.#automaticStepTargetHeight = targetHeight;
    this.#automaticStepVisualOffset = Math.max(
      -MAX_AUTOMATIC_STEP_HEIGHT,
      this.#automaticStepVisualOffset - stepRise,
    );
    this.#velocity.y = Math.max(0, this.#velocity.y);
    this.#grounded = true;
    this.#automaticStepGroundingRemaining = AUTOMATIC_STEP_GROUNDING_GRACE;
    return true;
  }

  #moveVertically() {
    if (this.#actionBehavior.tryBeginDrowning()) {
      return;
    }
    const riverRouteEntry = this.#riverRouteEntryAt(
      this.#position.x,
      this.#position.z,
    );
    const aboveExposedRiver =
      riverRouteEntry !== null && !riverRouteEntry.cell.underBridge;
    const contact = this.#actionBehavior.fallingToDeath
      ? null
      : (this.#physics.groundContact(this.#position) ??
        (this.#physicsSupportContact ? { entity: null } : null));
    const safeLanding = this.#actionBehavior.fallingToDeath
      ? null
      : this.#physics.surfaceAt(
          this.#position.x,
          this.#position.z,
          this.#position.y + STEP_CLEARANCE,
          this.#position.y - MAX_SAFE_STEP_DOWN - STEP_CLEARANCE,
        );
    if (safeLanding === null && this.#actionBehavior.dodgeAction) {
      this.#actionBehavior.dodgeAction.crossedLedge = true;
    }
    if (
      !contact &&
      !this.#actionBehavior.fallingToDeath &&
      !this.#actionBehavior.dodgeAction &&
      !aboveExposedRiver &&
      (this.#terrain.isBeyondMapEdge(this.#position.x, this.#position.z) ||
        (!safeLanding &&
          !this.#grounded &&
          this.#velocity.y <= 0 &&
          this.#position.y <
            (this.#stableGroundPosition?.y ?? this.#spawn.y) -
              MAX_SAFE_STEP_DOWN -
              STEP_CLEARANCE))
    ) {
      this.#actionBehavior.fallingToDeath = true;
    }
    this.#grounded =
      (Boolean(contact) || this.#automaticStepGroundingRemaining > 0) &&
      this.#velocity.y <= 0.2;
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

  /**
   *
   * @param {number} x
   * @param {number} z
   */
  #riverRouteEntryAt(x, z) {
    const col = Math.round(x + (this.#mapData.cols - 1) / 2);
    const row = Math.round(z + (this.#mapData.rows - 1) / 2);
    return this.#riverRoutesByCell.get(`${col},${row}`) ?? null;
  }

  /**
   *
   * @param {number} height
   */
  #freezeAtHeight(height) {
    this.#clearActionInput();
    this.#grounded = false;
    this.#coyoteRemaining = 0;
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#position.y = height;
    this.#physics.setScripted(this.#position, this.#velocity);
    this.#restartAnimation = true;
    this.#resetBoredom();
    this.#syncState();
  }

  /**
   *
   * @param {number} routeEntry
   */
  #beginDrowning(routeEntry) {
    this.#clearActionInput();
    this.#grounded = false;
    this.#coyoteRemaining = 0;
    const action = {
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
    return action;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} bridgeCell
   */
  #beginRiverBridgeExit(bridgeCell) {
    this.#velocity = { x: 0, y: 0, z: 0 };
    const direction = this.#riverDirectionVector(bridgeCell.direction);
    const bridgeX = bridgeCell.col - (this.#mapData.cols - 1) / 2;
    const bridgeZ = bridgeCell.row - (this.#mapData.rows - 1) / 2;
    this.#physics.gravity = GRAVITY;
    this.#physics.setScripted(this.#position, this.#velocity);
    this.#restartAnimation = true;
    return {
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
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} bridgeCell
   */
  #canClimbRiverBridge(bridgeCell) {
    return (
      bridgeCell.terrainHeight - bridgeCell.elevation <=
      RIVER_BRIDGE_MAX_CLIMB_HEIGHT
    );
  }

  #finishRiverBridgeExit() {
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#coyoteRemaining = COYOTE_TIME;
    this.#jumpsUsed = 0;
    this.#stableGroundPosition = { ...this.#position };
    this.#physics.resume(this.#position, this.#velocity);
    this.#restartAnimation = true;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} direction
   */
  #finishDrowningAtWaterfall(direction) {
    this.#velocity = {
      x: direction.x * RIVER_CURRENT_SPEED,
      y: -1.2,
      z: direction.z * RIVER_CURRENT_SPEED,
    };
    this.#physics.gravity = GRAVITY;
    this.#actionBehavior.fallingToDeath = true;
  }

  /**
   *
   * @param {boolean} drowning
   */
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

  /**
   *
   * @param {{x: number, y: number, z: number}} direction
   */
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

  /**
   *
   * @param {number} previousX
   * @param {number} previousY
   * @param {number} previousZ
   */
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

  /**
   *
   * @param {number} deltaTime
   * @param {number} previousY
   */
  #updateAirborneColliderRecovery(deltaTime, previousY) {
    if (this.#grounded || this.#physics.scripted) {
      this.#airborneStallElapsed = 0;
      this.#setHeroPartCollidersEnabled(true);
      return;
    }
    const verticallyStalled =
      Math.abs(this.#position.y - previousY) <=
        AIRBORNE_STALL_POSITION_EPSILON &&
      Math.abs(this.#velocity.y) <= 0.02;
    this.#airborneStallElapsed = verticallyStalled
      ? this.#airborneStallElapsed + deltaTime
      : 0;
    if (this.#airborneStallElapsed < AIRBORNE_STALL_RELEASE_DELAY) {
      return;
    }
    this.#setHeroPartCollidersEnabled(false);
  }

  /**
   *
   * @param {boolean} enabled
   */
  #setHeroPartCollidersEnabled(enabled) {
    if (this.#partCollidersSuspended === !enabled) {
      return;
    }
    this.#partCollidersSuspended = !enabled;
    for (const collider of this.#heroPartColliders) {
      if (collider.collision) {
        collider.collision.enabled = enabled;
      }
    }
    this.#entity?.rigidbody?.activate();
  }

  /**
   *
   * @param {string} occupancy
   */
  #preservesRisingMomentum(occupancy) {
    // Ammo can briefly lift the body as animated parts contact the ground.
    // Only a committed jump may bypass a blocked horizontal approach.
    return (
      occupancy === OCCUPANCY.blocked &&
      this.#jumpsUsed > 0 &&
      !this.#grounded &&
      this.#velocity.y > 0
    );
  }

  /**
   *
   * @param {number} deltaTime
   */
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

  /**
   *
    * @returns {{x: number, z: number}}
   */
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

  /**
   *
    * @returns {boolean}
   */
  get #hasMovementInput() {
    return this.#angryEscapeBehavior.active || (!this.#actionsLocked
      && Math.hypot(this.#input.x, this.#input.y) > 0.001);
  }

  /**
   *
    * @returns {string}
   */
  get #alternateEdgeFoot() {
    return this.#lastEdgeRefusalFoot === FOOT_SIDE.LEFT
      ? FOOT_SIDE.RIGHT
      : FOOT_SIDE.LEFT;
  }

  /**
   * @returns {import("./HeroSurfaceTypes.js").MovementSurfaceState}
   */
  get #surfaceState() {
    return {
      position: this.#position,
      direction: this.#movementDirection,
      grounded: this.#grounded,
      dodging: Boolean(this.#actionBehavior.dodgeAction),
      repelled: Boolean(this.#actionBehavior.repelAction),
      fallingToDeath: this.#actionBehavior.fallingToDeath,
    };
  }

  #rememberStableGroundPosition() {
    if (
      this.#footSupport.unsupportedFootAt(
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

  /**
   *
   * @param {string} foot
   * @param {{x: number, z: number}} direction
   */
  #beginEdgeRefusal(foot, direction) {
    if (this.#actionBehavior.edgeRefusalAction) {
      return;
    }
    this.#actionBehavior.edgeRefusalAction = {
      foot,
      direction: { ...direction },
      elapsed: 0,
    };
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   */
  #tryMovementRefusal(x, z) {
    const direction = this.#movementDirection;
    const refusal = this.#movementSurface.refusalAt(
      x,
      z,
      this.#position.y,
      direction,
    );
    if (refusal !== MOVEMENT_REFUSAL.HOLE) {
      return false;
    }
    this.#holeMovementBlocked = true;
    if (this.#actionBehavior.holeRefusalAction || this.#holeRefusalAcknowledged) {
      return true;
    }
    this.#actionBehavior.holeRefusalAction = {
      direction: { ...direction },
      elapsed: 0,
    };
    this.#holeRefusalAcknowledged = true;
    return true;
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
      const tile = candidates.reduce(/**
       *
       * @param {number} closest
       * @param {boolean} candidate
       */
      (closest, candidate) => {
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

  /**
   *
   * @param {number} col
   * @param {number} row
   */
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
    this.#physics.gravity = GRAVITY;
    this.#clearActionInput();
    this.#restartAnimation = true;
    this.#resetBoredom();
  }

  #resolveDeath() {
    this.#lives = Math.max(0, this.#lives - 1);
    this.#syncState();
    return this.#lives === 0 ? HERO_ACTION.GAME_OVER : HERO_ACTION.RESPAWNING;
  }

  #beginRespawn() {
    this.#modelRoot?.setLocalScale(
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
      HERO_MODEL_SCALE,
    );
    this.#position = { ...this.#spawn };
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = true;
    this.#coyoteRemaining = COYOTE_TIME;
    this.#jumpBufferRemaining = 0;
    this.#jumpsUsed = 0;
    this.#movementBlocked = false;
    this.#holeRefusalAcknowledged = false;
    this.#stableGroundPosition = { ...this.#spawn };
    this.#physics.gravity = GRAVITY;
    this.#physics.resume(this.#position, this.#velocity);
    this.#respawnEffect.begin(this.#facingYaw, this.#position.y);
    this.#gatewayRepelCooldown = 0;
    this.#restartAnimation = true;
    this.#resetBoredom();
    this.#syncState();
  }

  #beginGameOver() {
    this.#velocity = { x: 0, y: 0, z: 0 };
    this.#physics.setScripted(this.#position, this.#velocity);
    this.#syncState();
  }

  /**
   *
   * @param {number} deltaTime
   */
  #animate(deltaTime) {
    if (!this.#entity || !this.#modelRoot) {
      return;
    }
    const stepVisualBlend =
      1 - Math.exp(-AUTOMATIC_STEP_VISUAL_RESPONSE * deltaTime);
    this.#automaticStepVisualOffset +=
      (0 - this.#automaticStepVisualOffset) * stepVisualBlend;
    if (Math.abs(this.#automaticStepVisualOffset) < 0.0001) {
      this.#automaticStepVisualOffset = 0;
    }
    this.#modelRoot.setLocalPosition(0, this.#automaticStepVisualOffset, 0);
    this.#facingHoldRemaining = Math.max(
      0,
      this.#facingHoldRemaining - deltaTime,
    );
    this.#movementAnimationHoldRemaining = Math.max(
      0,
      this.#movementAnimationHoldRemaining - deltaTime,
    );
    const queuedFacingDirection =
      this.#facingHoldRemaining === 0 ? this.#queuedFacingDirection : null;
    const horizontalSpeed = Math.hypot(this.#velocity.x, this.#velocity.z);
    const blocked =
      this.#hasMovementInput &&
      this.#movementBlocked &&
      !this.#holeMovementBlocked &&
      horizontalSpeed <= 0.08;
    const showingBlockedPush = blocked && !this.#blockedPushFinished;
    const actionAnimation = this.#actionBehavior.animation;
    const defaultFacing = blocked
      ? this.#desiredVelocity()
      : queuedFacingDirection
        ? queuedFacingDirection
        : this.#hasMovementInput
          ? this.#grounded
            ? this.#desiredVelocity()
            : { x: this.#velocity.x, z: this.#velocity.z }
          : this.facingDirection;
    const facingVelocity = this.#actionBehavior.facingFor(defaultFacing);
    const previousFacingYaw = this.#facingYaw;
    if (
      !this.#actionBehavior.locksFacing &&
      this.#facingHoldRemaining === 0 &&
      Math.hypot(facingVelocity.x, facingVelocity.z) > 0.08
    ) {
      const targetYaw =
        (Math.atan2(facingVelocity.x, facingVelocity.z) * 180) / Math.PI;
      this.#facingYaw = this.#actionBehavior.snapsFacing
        ? targetYaw
        : this.#lerpAngle(
            this.#facingYaw,
            targetYaw,
            Math.min(1, deltaTime * 14),
          );
      if (queuedFacingDirection) {
        const yawDelta = Math.abs(
          ((targetYaw - this.#facingYaw + 540) % 360) - 180,
        );
        if (yawDelta <= 1) {
          this.#facingYaw = targetYaw;
          this.#queuedFacingDirection = null;
        }
      }
    }
    this.#modelRoot.setLocalEulerAngles(0, this.#facingYaw, 0);
    this.#respawnEffect?.setFacingYaw(this.#facingYaw);
    if (Math.abs(this.#facingYaw - previousFacingYaw) > 0.001) {
      this.#onFacingChange?.(this.facingDirection);
    }

    let animation;
    let animationSpeed = 1;
    if (actionAnimation) {
      animation = actionAnimation;
      animationSpeed = this.#actionBehavior.animationSpeed;
      this.#resetBoredom();
    } else if (!this.#grounded && this.#coyoteRemaining === 0) {
      animation = HERO_ANIMATION.JUMP;
      this.#resetBoredom();
    } else if (showingBlockedPush) {
      animation = HERO_ANIMATION.BLOCKED_PUSH;
      this.#resetBoredom();
    } else if (
      horizontalSpeed > 0.08 &&
      this.#movementAnimationHoldRemaining > 0
    ) {
      animation = HERO_ANIMATION.IDLE;
      this.#resetBoredom();
    } else if (horizontalSpeed > 0.08) {
      const running = this.#running || this.#angryEscapeBehavior.active;
      animation = running ? HERO_ANIMATION.RUN : HERO_ANIMATION.WALK;
      const expectedSpeed = running ? RUN_SPEED : MOVE_SPEED;
      animationSpeed = Math.max(
        0.75,
        Math.min(1.25, horizontalSpeed / expectedSpeed),
      );
      this.#resetBoredom();
    } else if (this.#emotionBehavior.state.kind !== HERO_MOOD.CALM) {
      animation = HERO_ANIMATION.IDLE;
      this.#resetBoredom();
    } else if (this.#firstPersonCameraEnabled) {
      animation = HERO_ANIMATION.IDLE;
      animationSpeed = 0;
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
    if (
      !this.#actionBehavior.controlsHeadPresentation
      && animation !== HERO_ANIMATION.PAT_ANNOYED
    ) {
      this.#updateHeadLook(deltaTime);
    }
    this.#actionBehavior.present(deltaTime);
    this.#footPlacement?.update(
      deltaTime,
      this.#grounded &&
        this.#actionBehavior.allowsFootPlacement,
    );
  }

  /**
   *
   * @param {number} deltaTime
   */
  #selectIdleAnimation(deltaTime) {
    return this.#idleBehavior.advance(deltaTime, {
      hasLookTarget: Boolean(this.#idleLookTarget),
    });
  }

  #resetBoredom() {
    this.#idleBehavior.reset();
  }

  /**
   *
   * @param {string} name
   * @param {number} speed
   * @param {number} restart
   */
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

  /**
   *
    * @returns {number}
   */
  get #headLookTargetYaw() {
    if (
      this.#animationState !== HERO_ANIMATION.BORED_CURSOR_LOOK ||
      !this.#idleLookTarget ||
      this.#hasMovementInput ||
      !this.#grounded ||
      !this.#actionBehavior.allowsIdleHeadLook
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

  /**
   *
   * @param {number} deltaTime
   */
  #updateHeadLook(deltaTime) {
    if (this.#actionBehavior.locksHeadForward) {
      this.#headLookYaw = 0;
      return;
    }
    this.#setAngryFace(0);
    if (this.#firstPersonCameraEnabled) {
      const direction = this.#getViewDirection?.();
      const horizontal = Math.hypot(direction?.x ?? 0, direction?.z ?? 0);
      if (direction && horizontal > 0.001) {
        const viewYaw =
          (Math.atan2(direction.x, direction.z) * 180) / Math.PI;
        const relativeYaw = ((viewYaw - this.#facingYaw + 540) % 360) - 180;
        const viewPitch =
          (Math.atan2(direction.y ?? 0, horizontal) * 180) / Math.PI;
        this.#headLookYaw = relativeYaw;
        this.#headEntity?.setLocalEulerAngles(
          -viewPitch,
          relativeYaw,
          0,
        );
        return;
      }
    }
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
    const { kind, elapsed, patPulse, agitation, remaining } =
      this.#emotionBehavior.state;
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

  /**
   *
   * @param {number} amount
   */
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
    if (this.#headEntity) {
      this.#headEntity.enabled = !this.#firstPersonCameraEnabled;
    }
    this.#hairPhysics = new HeroHairPhysics({
      pc: this.#pc,
      app: this.#app,
      headEntity: this.#headEntity,
      hairEntities:
        this.#headEntity?.children.filter(/**
         *
         * @param {import("playcanvas").Entity} entity
         */
        (entity) =>
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
      .flatMap(/**
       *
       * @param {import("playcanvas").Entity} entity
       */
      (entity) => entity?.render?.meshInstances ?? [])
      .map(/**
       *
       * @param {import("playcanvas").Mesh} mesh
       */
      (mesh) => mesh.morphInstance)
      .filter(/**
       *
       * @param {import("playcanvas").MorphInstance} morph
       */
      (morph) => morph?.morph.targets.some(/**
       *
       * @param {{x: number, y: number, z: number}} target
       */
      (target) => target.name === "HappyPat"));
    this.#leftArmEntity = this.#findModelEntity("Left arm");
    this.#rightArmEntity = this.#findModelEntity("Right arm");
    this.#toolAttachmentEntity = this.#findModelEntity("Right arm");
    this.#rightHeldItemAttachmentEntity =
      this.#findModelEntity("Right white glove");
    this.#leftHeldItemAttachmentEntity =
      this.#findModelEntity("Left white glove");
    this.#heroPartColliders = addHeroPartColliders({
      pc: this.#pc,
      modelRoot: this.#modelRoot,
    });

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
      /**
       *
       * @param {number} x
       * @param {number} z
       * @param {number} maximumHeight
       */
      surfaceAt: (x, z, maximumHeight) =>
        this.#physics.surfaceAt(x, z, maximumHeight),
      getHeroPosition: () => this.#position,
      /**
       * @param {number} x
       * @param {number} z
       */
      visualOffsetAt: (x, z) => this.#islandVisualOffsetAt(x, z),
      left: {
        side: "left",
        leg: this.#findModelEntity("Left leg"),
        sole: this.#findModelEntity("Boot sole"),
        cuff: this.#findModelEntity("Boot cuff"),
        tiltingParts: [
          "Boot shaft",
          "Boot front strap",
          "Left ankle",
        ].map(/**
         *
         * @param {string} name
         */
        (name) => this.#findModelEntity(name)),
      },
      right: {
        side: "right",
        leg: this.#findModelEntity("Right leg"),
        sole: this.#findModelEntity("Boot sole.001"),
        cuff: this.#findModelEntity("Boot cuff.001"),
        tiltingParts: [
          "Boot shaft.001",
          "Boot front strap.001",
          "Right ankle",
        ].map(/**
         *
         * @param {string} name
         */
        (name) => this.#findModelEntity(name)),
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

  /**
   *
   * @param {{pickupAction: {targetDistance?: number, minimumDistance: number, maximumDistance: number, radiusClearance: number, maximumStep?: number, maximumForwardStep: number, maximumBackwardStep: number}, targetPosition: {x: number, y: number, z: number}, targetRadius: number, targetDistance: number}} options
   * @param {{targetDistance?: number, minimumDistance: number, maximumDistance: number, radiusClearance: number, maximumStep?: number, maximumForwardStep: number, maximumBackwardStep: number}} options.pickupAction
   * @param {{x: number, y: number, z: number}} options.targetPosition
   * @param {number} options.targetRadius
   * @param {number} options.targetDistance
   */
  #collectionPositioning({
    pickupAction,
    targetPosition,
    targetRadius,
    targetDistance,
  }) {
    const preferredDistance = pickupAction.targetDistance ?? Math.max(
      pickupAction.minimumDistance,
      Math.min(
        pickupAction.maximumDistance,
        targetRadius + pickupAction.radiusClearance,
      ),
    );
    const distanceAdjustment = targetDistance - preferredDistance;
    const maximumForwardStep =
      pickupAction.maximumStep ?? pickupAction.maximumForwardStep;
    const maximumBackwardStep =
      pickupAction.maximumStep ?? pickupAction.maximumBackwardStep;
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

  /**
   *
   * @param {number} toX
   * @param {number} toZ
   */
  #tryGatewayRepulsion(toX, toZ) {
    if (
      this.#actionBehavior.collectAction ||
      this.#actionBehavior.repelAction ||
      this.#gatewayRepelCooldown > 0
    ) {
      return false;
    }
    const direction = this.#collisionWorld?.movementRepulsionFor(
      this.#position.x,
      this.#position.z,
      toX,
      toZ,
      HERO_RADIUS,
    );
    if (!direction) {
      return false;
    }
    this.#actionBehavior.repelAction = { ...direction, elapsed: 0 };
    return true;
  }

  #syncState() {
    const state = {
      lives: this.#lives,
      maxLives: MAX_LIVES,
      gameOver: this.#actionBehavior.gameOver,
      drowning: this.#actionBehavior.drowningAction !== null,
      burning: this.burning,
      ashes: this.ashes,
      wallet: this.wallet,
      inventory: this.inventory,
      mood: this.mood,
      action: this.actionState,
      buffs: this.buffs,
      stats: this.stats,
    };
    this.#presentation?.lifeHud?.setLives(state.lives, state.maxLives);
    this.#presentation?.coinHud?.setWallet(state.wallet);
    this.#presentation?.inventoryScene?.setInventory(state.inventory);
    this.#presentation?.gameOverScene?.syncHeroState(state);
    this.#presentation?.stateStore?.sync(state);
  }

  #showInventoryFull() {
    this.#presentation?.inventoryScene?.showFullReaction(
      this.#presentation?.getInventoryFullScreenPosition?.() ?? null,
    );
  }

  #syncMood() {
    const mood = this.mood;
    if (mood.kind !== HERO_MOOD.CALM) {
      this.#moodVisible = true;
      this.#presentation?.stateStore?.setMood({
        ...mood,
        screen: this.#presentation?.getMoodScreenPosition?.() ?? null,
      });
    } else if (this.#moodVisible) {
      this.#moodVisible = false;
      this.#presentation?.stateStore?.setMood(null);
    }
  }

  /**
   *
   * @param {string} name
   */
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

  /**
   *
   * @param {number} value
   * @param {{x: number, y: number, z: number}} target
   * @param {number} amount
   */
  #approach(value, target, amount) {
    if (value < target) {
      return Math.min(value + amount, target);
    }
    return Math.max(value - amount, target);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").Point3} from
   * @param {import("src/game/objects/ObjectTypes.js").Point3} to
   * @param {number} amount
   */
  #lerpAngle(from, to, amount) {
    const difference = ((to - from + 540) % 360) - 180;
    return from + difference * amount;
  }
}
