import kingModelUrl from "../../models/castle/royals/king.glb?url";
import princessModelUrl from "../../models/castle/royals/princess.glb?url";
import queenModelUrl from "../../models/castle/royals/queen.glb?url";
import { ROYAL_WALK_SPEED } from "../../enum/RoyalWalkSpeed.js";
import { ROYAL_ANIMATION } from "../../enum/RoyalAnimation.js";
import { KingGameOverBehavior } from "./KingGameOverBehavior.js";
import { PrincessGameOverBehavior } from "./PrincessGameOverBehavior.js";
import { QueenGameOverBehavior } from "./QueenGameOverBehavior.js";
import { RoyalGameOverRouteFollower } from "./RoyalGameOverRouteFollower.js";
import { RoyalTears } from "./RoyalTears.js";

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
  static get modelUrls() {
    return MODEL_URLS;
  }

  #entity;
  #gameOverBehavior;
  #gameOverRoute = null;
  #tears;
  #walkDuration;

  constructor({ pc, app, modelUrl = kingModelUrl, modelLibrary }) {
    const modelIndex = MODEL_URLS.indexOf(modelUrl);
    const kind = ["KING", "QUEEN", "PRINCESS"][modelIndex] ?? "KING";
    const GameOverBehaviorType =
      GAME_OVER_BEHAVIOR_TYPES[modelIndex] ?? KingGameOverBehavior;
    const walkAnimationSpeed = WALK_OUT_ANIMATION_SPEED * ROYAL_WALK_SPEED[kind];
    const walkDuration = 3.2 / walkAnimationSpeed;
    this.#walkDuration = walkDuration;
    this.#entity = modelLibrary.instantiate(modelUrl);
    this.#entity.name = "Seated royal";
    const tracks = modelLibrary.getAnimationTracks(modelUrl, [
      ROYAL_ANIMATION.WALK_OUT,
      ROYAL_ANIMATION.CRY,
    ]);
    this.#entity.addComponent("anim", { activate: true });
    this.#entity.anim.addAnimationState(
      ROYAL_ANIMATION.WALK_OUT,
      tracks.get(ROYAL_ANIMATION.WALK_OUT),
      walkAnimationSpeed,
      false,
    );
    this.#entity.anim.addAnimationState(
      ROYAL_ANIMATION.CRY,
      tracks.get(ROYAL_ANIMATION.CRY),
      1,
      true,
    );
    this.#tears = new RoyalTears({ pc, app, royal: this.#entity });
    this.#gameOverBehavior = new GameOverBehaviorType({
      walkDuration,
      walkStartDelay: WALK_START_DELAY,
      beginWalk: () => this.#beginGameOverWalk(),
      move: (progress) => this.#moveGameOverWalk(progress),
      playAnimation: (animation, blendDuration) =>
        this.#playAnimation(animation, blendDuration),
    });
  }

  get entity() {
    return this.#entity;
  }

  get gameOverDestination() {
    return this.#gameOverBehavior.destination;
  }

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
    this.#gameOverBehavior.start();
  }

  beginCrying({ blendDuration = 0 } = {}) {
    this.#playAnimation(ROYAL_ANIMATION.CRY, blendDuration);
  }

  #playAnimation(animation, blendDuration = 0) {
    if (blendDuration > 0) {
      this.#entity.anim.baseLayer.transition(animation, blendDuration);
    } else {
      this.#entity.anim.baseLayer.play(animation);
    }
  }

  update(deltaTime) {
    this.#gameOverBehavior.update(deltaTime);
  }

  destroy() {
    this.#tears?.destroy();
    this.#entity?.destroy();
    this.#entity = null;
    this.#gameOverBehavior = null;
    this.#gameOverRoute = null;
  }

  #beginGameOverWalk() {
    this.#applyGameOverPose(this.#gameOverRoute.follower.pose);
  }

  #moveGameOverWalk(progress) {
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

  #faceGameOverCamera(position) {
    const cameraPosition = this.#gameOverRoute.getCameraPosition?.();
    if (cameraPosition) {
      this.#face(
        cameraPosition.x - position.x,
        cameraPosition.z - position.z,
      );
    }
  }

  #applyGameOverPose({ position, rotation }) {
    this.#entity.setLocalPosition(position.x, position.y, position.z);
    this.#entity.setLocalRotation(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    );
  }

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
