import kingModelUrl from "../../models/castle/royals/king.glb?url";
import { CHARACTER_HEIGHT } from "../../config/character-size.js";
import princessModelUrl from "../../models/castle/royals/princess.glb?url";
import queenModelUrl from "../../models/castle/royals/queen.glb?url";
import { ROYAL_WALK_SPEED } from "../../enum/RoyalWalkSpeed.js";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";
import { KingGameOverBehavior } from "./KingGameOverBehavior.js";
import { PrincessGameOverBehavior } from "./PrincessGameOverBehavior.js";
import { QueenGameOverBehavior } from "./QueenGameOverBehavior.js";
import { RoyalGameOverRouteFollower } from "./RoyalGameOverRouteFollower.js";
import { RoyalTears } from "./RoyalTears.js";
import { NpcDoorAvoidance } from "../shared/NpcDoorAvoidance.js";

const MODEL_URLS = Object.freeze([
  kingModelUrl,
  queenModelUrl,
  princessModelUrl,
]);
const GAME_OVER_BEHAVIOR_TYPES = Object.freeze([
  KingGameOverBehavior,
  QueenGameOverBehavior,
  PrincessGameOverBehavior,
]);
const WALK_OUT_ANIMATION_SPEED = 1.8;
const WALK_START_DELAY = 0.08;
const FALLBACK_VISUAL_SIZE = Object.freeze({ x: 1.2, y: 2.2, z: 1.2 });

/**
 * An imported seated royal whose local +Z axis faces the visitor.
 */
export class SeatedRoyal {
  /**
   * @type {NpcDoorAvoidance}
   */
  #doorAvoidance;
  /**
   * @type {number|null}
   */
  #suspendedAnimationSpeed = null;
  /**
   *
    * @returns {string}
   */
  static get modelUrls() {
    return MODEL_URLS;
  }

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #model;
  /**
   * @type {import("./TerraceKing.js").TerraceKing|import("./TerraceQueen.js").TerraceQueen|import("./TerracePrincess.js").TerracePrincess|null}
   */
  #resident;
  /**
   * @type {import("./CastleResidentMotion.js").CastleResidentMotion|null}
   */
  #navigation = null;
  /**
   * @type {boolean}
   */
  #returning = false;
  /**
   *
    * @type {KingGameOverBehavior|QueenGameOverBehavior|PrincessGameOverBehavior}
   */
  #gameOverBehavior;
  /**
   *
    * @type {{follower: RoyalGameOverRouteFollower, collisionRadius: number, isBlocked: (x: number, z: number, radius: number) => boolean, getCameraPosition: () => {x: number, y: number, z: number}}|null}
   */
  #gameOverRoute = null;
  /**
   *
    * @type {RoyalTears}
   */
  #tears;
  /**
   *
    * @type {number}
   */
  #walkDuration;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelUrl: string, modelLibrary: string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {string} options.modelUrl
   * @param {string} options.modelLibrary
   */
  constructor({ pc, app, modelUrl = kingModelUrl, modelLibrary, resident = null }) {
    const modelIndex = MODEL_URLS.indexOf(modelUrl);
    const kind = ["KING", "QUEEN", "PRINCESS"][modelIndex] ?? "KING";
    const GameOverBehaviorType =
      GAME_OVER_BEHAVIOR_TYPES[modelIndex] ?? KingGameOverBehavior;
    const walkAnimationSpeed = WALK_OUT_ANIMATION_SPEED * ROYAL_WALK_SPEED[kind];
    const walkDuration = 3.2 / walkAnimationSpeed;
    this.#walkDuration = walkDuration;
    this.#resident = resident;
    this.#entity = resident?.entity ?? modelLibrary.instantiate(modelUrl);
    this.#model = resident?.model ?? this.#entity;
    this.#entity.name = "Seated royal";

    const tracks = modelLibrary.getAnimationTracks(modelUrl, [
      ROYAL_ANIMATION.SIT,
      ROYAL_ANIMATION.WALK_OUT,
      ROYAL_ANIMATION.CRY,
    ]);
    if (!this.#model.anim) { this.#model.addComponent("anim", { activate: true }); }
    this.#model.anim.addAnimationState(ROYAL_ANIMATION.SIT, tracks.get(ROYAL_ANIMATION.SIT), 1, true);
    this.#model.anim.addAnimationState(
      ROYAL_ANIMATION.WALK_OUT,
      tracks.get(ROYAL_ANIMATION.WALK_OUT),
      walkAnimationSpeed,
      false,
    );
    this.#model.anim.addAnimationState(
      ROYAL_ANIMATION.CRY,
      tracks.get(ROYAL_ANIMATION.CRY),
      1,
      true,
    );
    this.#tears = new RoyalTears({ pc, app, royal: this.#model });
    this.#gameOverBehavior = new GameOverBehaviorType({
      walkDuration,
      walkStartDelay: WALK_START_DELAY,
      beginWalk: () => this.#beginGameOverWalk(),
      /**
       *
       * @param {number} progress
       */
      move: (progress) => this.#moveGameOverWalk(progress),
      /**
       *
       * @param {string} animation
       * @param {number} blendDuration
       */
      playAnimation: (animation, blendDuration) =>
        this.#playAnimation(animation, blendDuration),
    });
    if (!resident) {
      this.#doorAvoidance = new NpcDoorAvoidance(this.#entity, app);
      this.#doorAvoidance.behavior = this.#gameOverBehavior.stateMachine;
    }
    this.sit();
  }

  /**
   * @param {import("./CastleResidentMotion.js").CastleResidentMotion|null} value
   */
  set navigation(value) { this.#navigation = value; }

  /**
   * @returns {boolean}
   */
  get persistent() { return this.#resident !== null; }

  get entity() {
    return this.#entity;
  }

  /**
   *
    * @returns {{lateral: number, forward: number, elevation: number}}
   */
  get gameOverDestination() {
    return this.#gameOverBehavior.destination;
  }

  /**
   * Uses the same authored body bounds and height as the terrace actor.
   *
   * @returns {number}
   */
  get terraceScale() {
    if (this.#resident) { return CHARACTER_HEIGHT / this.#resident.height; }
    let bottom = Number.POSITIVE_INFINITY;
    let top = Number.NEGATIVE_INFINITY;
    for (const render of this.#entity.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        if (/sword|tear|handkerchief/i.test(mesh.node.name)) {
          continue;
        }
        const bounds = mesh.aabb;
        bottom = Math.min(bottom, bounds.center.y - bounds.halfExtents.y);
        top = Math.max(top, bounds.center.y + bounds.halfExtents.y);
      }
    }
    const height = top - bottom;
    return Number.isFinite(height) && height >= 0.01
      ? (CHARACTER_HEIGHT * this.#entity.getLocalScale().y) / height
      : 0.45;
  }

  /**
   *
    * @returns {{center: {x: number, y: number, z: number}, size: {x: number, y: number, z: number}}}
   */
  get visualBounds() {
    let minimumX = Number.POSITIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;
    let minimumZ = Number.POSITIVE_INFINITY;
    let maximumX = Number.NEGATIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;
    let maximumZ = Number.NEGATIVE_INFINITY;

    for (const render of this.#entity.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        const { center, halfExtents } = meshInstance.aabb;
        minimumX = Math.min(minimumX, center.x - halfExtents.x);
        minimumY = Math.min(minimumY, center.y - halfExtents.y);
        minimumZ = Math.min(minimumZ, center.z - halfExtents.z);
        maximumX = Math.max(maximumX, center.x + halfExtents.x);
        maximumY = Math.max(maximumY, center.y + halfExtents.y);
        maximumZ = Math.max(maximumZ, center.z + halfExtents.z);
      }
    }

    if (!Number.isFinite(minimumX)) {
      const position = this.#entity.getPosition();
      return {
        center: {
          x: position.x,
          y: position.y + FALLBACK_VISUAL_SIZE.y / 2,
          z: position.z,
        },
        size: { ...FALLBACK_VISUAL_SIZE },
      };
    }

    return {
      center: {
        x: (minimumX + maximumX) / 2,
        y: (minimumY + maximumY) / 2,
        z: (minimumZ + maximumZ) / 2,
      },
      size: {
        x: maximumX - minimumX,
        y: maximumY - minimumY,
        z: maximumZ - minimumZ,
      },
    };
  }

  /**
   *
   * @param {{route: {waypoints: Array<{x: number, y: number, z: number}>, collisionRadius: number, isBlocked: (x: number, z: number, radius: number) => boolean}, getCameraPosition: () => {x: number, y: number, z: number}}} options
   * @param {{waypoints: Array<{x: number, y: number, z: number}>, collisionRadius: number, isBlocked: (x: number, z: number, radius: number) => boolean}} options.route
   * @param {() => {x: number, y: number, z: number}} options.getCameraPosition
   */
  beginGameOver({ route, getCameraPosition }) {
    if (this.#gameOverBehavior.active) {
      return;
    }
    this.#gameOverRoute = {
      follower: new RoyalGameOverRouteFollower({
        waypoints: route.waypoints,
        duration: this.#walkDuration - WALK_START_DELAY,
      }),
      collisionRadius: route.collisionRadius,
      isBlocked: route.isBlocked,
      getCameraPosition,
    };
    if (this.#resident) { this.#resident.behavior = this.#gameOverBehavior.stateMachine; }
    this.#model.anim.speed = 1;
    this.#gameOverBehavior.start();
  }

  /**
   *
   * Restores the seated pose on the resident model.
   */
  sit() {
    this.#model.anim.baseLayer.play(ROYAL_ANIMATION.SIT);
    this.#model.anim.speed = 0;
    this.#model.anim.baseLayer.activeStateCurrentTime = 0;
    this.#model.anim.update(0);
  }

  /**
   * @param {{blendDuration?:number}} options
   * @param {number} options.blendDuration
   */
  beginCrying({ blendDuration = 0 } = {}) {
    this.#playAnimation(ROYAL_ANIMATION.CRY, blendDuration);
  }

  /**
   *
   * @param {string} animation
   * @param {number} blendDuration
   */
  #playAnimation(animation, blendDuration = 0) {
    this.#model.anim.speed = 1;
    if (blendDuration > 0) {
      this.#model.anim.baseLayer.transition(animation, blendDuration);
    } else {
      this.#model.anim.baseLayer.play(animation);
    }
  }

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this.#gameOverBehavior.stateMachine.reacting) {
      this.#suspendedAnimationSpeed ??= this.#model.anim.speed;
      this.#model.anim.speed = 0;
    } else if (this.#suspendedAnimationSpeed !== null) {
      this.#model.anim.speed = this.#suspendedAnimationSpeed;
      this.#suspendedAnimationSpeed = null;
    }
    if (this.#returning) { this.#navigation.update(deltaTime); }
    this.#gameOverBehavior.update(deltaTime);
  }

  destroy() {
    this.#doorAvoidance?.destroy();
    this.#tears?.destroy();
    if (!this.#resident) { this.#entity?.destroy(); }
    this.#entity = null;
    this.#gameOverBehavior = null;
    this.#gameOverRoute = null;
  }

  #beginGameOverWalk() {
    if (this.#navigation && this.#entity.getPosition().distance(this.#navigation.home) > 0.025) {
      this.#returning = true;
      this.#navigation.moveTo(this.#navigation.home);
      return;
    }
    this.#applyGameOverPose(this.#gameOverRoute.follower.pose);
  }

  /**
   *
   * @param {number} progress
   */
  #moveGameOverWalk(progress) {
    if (this.#returning) {
      if (!this.#navigation.arrived) { return null; }
      this.#returning = false;
      this.#playAnimation(ROYAL_ANIMATION.WALK_OUT);
      this.#model.anim.speed = 1;
    }
    const pose = this.#gameOverRoute.follower.advance(progress);
    const { position } = pose;
    if (
      progress > 0 &&
      this.#gameOverRoute.isBlocked?.(
        position.x,
        position.z,
        this.#gameOverRoute.collisionRadius,
      )
    ) {
      this.#faceGameOverCamera(this.#entity.getLocalPosition());
      return false;
    }
    this.#applyGameOverPose(pose);
    if (progress === 1) {
      this.#faceGameOverCamera(position);
    }
    return true;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} position
   */
  #faceGameOverCamera(position) {
    const cameraPosition = this.#gameOverRoute.getCameraPosition?.();
    if (cameraPosition) {
      this.#face(
        cameraPosition.x - position.x,
        cameraPosition.z - position.z,
      );
    }
  }

  /**
   *
   * @param {{position: {x: number, y: number, z: number}, rotation: number}} options
   * @param {{x: number, y: number, z: number}} options.position
   * @param {number} options.rotation
   */
  #applyGameOverPose({ position, rotation }) {
    this.#entity.setLocalPosition(position.x, position.y, position.z);
    this.#entity.setLocalRotation(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   */
  #face(x, z) {
    if (Math.hypot(x, z) <= 0.001) {
      return;
    }
    this.#entity.setLocalEulerAngles(
      0,
      (Math.atan2(x, z) * 180) / Math.PI,
      0,
    );
  }
}
