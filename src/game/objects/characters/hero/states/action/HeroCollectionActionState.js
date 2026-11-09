import { HERO_ACTION } from "../../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HERO_COLLECTION_PHASE } from "../../../../../enum/HeroCollectionPhase.js";
import { pickupActionForCategory } from "../../../../../config/hero-pickup-actions.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

/**
 * @typedef {object} HeroCollectionPose
 * @property {import("src/game/objects/ObjectTypes.js").Point3} position
 * @property {import("src/game/objects/ObjectTypes.js").Point3} facingDirection
 * @property {import("playcanvas").Entity|null} leftAttachment
 * @property {import("playcanvas").Entity|null} rightAttachment
 * @typedef {object} HeroCollectionHost
 * @property {() => HeroCollectionPose} readPose
 * @property {(yaw: number) => void} setFacingYaw
 * @typedef {object} HeroChestOptions
 * @property {import("src/game/objects/ObjectTypes.js").Point3} targetPosition
 * @property {() => boolean} onImpact
 * @property {() => void} onComplete
 * @typedef {object} HeroPickupOptions
 * @property {import("src/game/objects/ObjectTypes.js").Point3} targetPosition
 * @property {number} [targetRadius]
 * @property {import("../../tools/HeroTool.js").HeroTool|null} [tool]
 * @property {import("../../../../ground-cover/GroundCoverHeldItem.js").GroundCoverHeldItem|null} [heldItem]
 * @property {() => import("../../../../ground-cover/GroundCoverHeldItem.js").GroundCoverHeldItem|null} [nextHeldItem]
 * @property {() => import("src/game/objects/ObjectTypes.js").Point3} [nextTargetPosition]
 * @property {() => boolean} onImpact
 * @property {() => void} onComplete
 * @typedef {object} HeroRefusalOptions
 * @property {import("src/game/objects/ObjectTypes.js").Point3|null} [targetPosition]
 * @property {number} [targetRadius]
 * @property {(() => void)|null} [onComplete]
 * @typedef {{targetDistance?: number, minimumDistance?: number, maximumDistance?: number, radiusClearance?: number, maximumStep?: number, maximumForwardStep?: number, maximumBackwardStep?: number}} HeroCollectionReach
 * @typedef {object} HeroCollectionPositioningOptions
 * @property {HeroCollectionReach} pickupAction
 * @property {import("src/game/objects/ObjectTypes.js").Point3} targetPosition
 * @property {number} targetRadius
 * @property {number} targetDistance
 */

/**
 *
 * @param {string} action
 * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
 */
function advancePositioning(action, owner) {
  if (!action.positioning) {
    return false;
  }
  const feedback = owner.feedback.collection;
  action.positioningElapsed += owner.deltaTime;
  const progress = Math.min(
    1,
    action.positioningElapsed / feedback.positioningDuration,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);
  const x = action.positioning.startX
    + (action.positioning.targetX - action.positioning.startX) * easedProgress;
  const z = action.positioning.startZ
    + (action.positioning.targetZ - action.positioning.startZ) * easedProgress;
  if (!feedback.canOccupy(x, z)) {
    action.positioning = null;
    action.positioningElapsed = 0;
    feedback.restartAnimation();

    return true;
  }
  feedback.moveTo(x, z);
  if (progress >= 1) {
    action.positioning = null;
    action.positioningElapsed = 0;
    feedback.restartAnimation();
  }
  return true;
}

export class HeroCollectingActionState extends HeroRuntimeActionState {
  /**
   * Builds one pickup sequence. The host is read again when a chained pickup
   * retargets, because physics may have replaced the hero position object.
   * @param {string} category
   * @param {HeroPickupOptions} options
   * @param {HeroCollectionHost} host
   * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  static createPickup(category,
    {
      targetPosition,
      targetRadius = 0,
      tool = null,
      heldItem = null,
      nextHeldItem = null,
      nextTargetPosition = null,
      onImpact,
      onComplete,
    },
    host,
  ) {
    const { position, facingDirection, leftAttachment, rightAttachment } = host.readPose();
    const targetX = targetPosition.x - position.x;
    const targetZ = targetPosition.z - position.z;
    const targetDistance = Math.hypot(targetX, targetZ);
    if (targetDistance > 0.001) {
      host.setFacingYaw((Math.atan2(targetX, targetZ) * 180) / Math.PI);
    }
    const pickupAction = pickupActionForCategory(category);
    if (!pickupAction) {
      return null;
    }
    const collectionTool = pickupAction.requiresTool ? tool : null;
    if (pickupAction.requiresTool && !collectionTool) {
      return null;
    }
    const positioning = HeroCollectingActionState.positioning({
      position,
      facingDirection,
    }, {
      pickupAction,
      targetPosition,
      targetRadius,
      targetDistance,
    });

    return {
      animation: pickupAction.animation,
      duration: pickupAction.duration,
      cutStartTime: pickupAction.cutStartTime,
      liftStartTime: pickupAction.liftStartTime,
      toolHideTime: pickupAction.toolHideTime,
      impactTime: pickupAction.impactTime,
      stowStartTime: pickupAction.stowStartTime,
      elapsed: 0,
      impacted: false,
      positioning,
      positioningElapsed: 0,
      tool: collectionTool,
      heldItem,
      nextHeldItem,
      /**
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
       */
      retarget: nextTargetPosition ? (action) => {
        const next = nextTargetPosition();
        const { position, facingDirection } = host.readPose();
        const x = next.x - position.x;
        const z = next.z - position.z;
        const distance = Math.hypot(x, z);
        if (distance > 0.001) {
          host.setFacingYaw(Math.atan2(x, z) * 180 / Math.PI);
        }
        action.positioning = HeroCollectingActionState.positioning({
          position,
          facingDirection,
        }, {
          pickupAction,
          targetPosition: next,
          targetRadius,
          targetDistance: distance,
        });
        action.positioningElapsed = 0;
      } : null,
      heldItemAttachmentEntity: pickupAction.heldItemAttachment === "left"
        ? leftAttachment
        : rightAttachment,
      heldItemHideTime: pickupAction.heldItemHideTime,
      onImpact,
      onComplete,
    };
  }

  /**
   * @param {HeroChestOptions} options
   * @param {HeroCollectionHost} host
   * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload}
   */
  static createChest({ targetPosition, onImpact, onComplete }, host) {
    const { position } = host.readPose();
    host.setFacingYaw(Math.atan2(targetPosition.x - position.x,
      targetPosition.z - position.z) * 180 / Math.PI);

    return {
      animation: HERO_ANIMATION.OPEN_CHEST,
      duration: 1.8,
      impactTime: 0.65,
      elapsed: 0,
      impacted: false,
      positioning: HeroCollectingActionState.positioning(host.readPose(), {
        pickupAction: {
          targetDistance: 0.535,
          maximumStep: 0.55,
        },
        targetPosition,
        targetRadius: 0.3,
        targetDistance: Math.hypot(targetPosition.x - position.x,
          targetPosition.z - position.z),
      }),
      positioningElapsed: 0,
      onImpact,
      onComplete,
    };
  }

  /**
   * @param {HeroCollectionPose} pose
   * @param {HeroCollectionPositioningOptions} options
   * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload|null}
   */
  static positioning({ position, facingDirection }, {
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
          x: (targetPosition.x - position.x) / targetDistance,
          z: (targetPosition.z - position.z) / targetDistance,
        }
        : facingDirection;

    return {
      animationSpeed: 0.8,
      startX: position.x,
      startZ: position.z,
      targetX: position.x + direction.x * stepDistance,
      targetZ: position.z + direction.z * stepDistance,
    };
  }

  /**
   * The knife crouch authors both boot contacts on flat harvesting ground.
   * @returns {boolean}
   */
  get allowsFootPlacement() {
    return this.payload?.cutStartTime === undefined;
  }

  constructor() {
    super(HERO_ACTION.COLLECTING, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: HeroCollectingActionState.#animation,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      requiresGrounded: true,
      blocksMovement: true,
      allowsIdleHeadLook: false,
      controlsHeadPresentation: true,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    this.payload.phase = this.payload.positioning
      ? HERO_COLLECTION_PHASE.APPROACHING
      : HERO_COLLECTION_PHASE.REACHING;
    HeroCollectingActionState.#begin(owner);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const action = this.payload;
    const feedback = owner.feedback.collection;
    if (advancePositioning(action, owner)) {
      return;
    }
    action.elapsed += owner.deltaTime;
    action.phase = HeroCollectingActionState.#phase(action);
    if (!action.impacted && action.elapsed >= action.impactTime) {
      action.impacted = true;
      const collected = action.onImpact?.() === true;
      action.collected = collected;
      if (collected && action.heldItem) {
        feedback.mountHeldItem(action.heldItem, action.heldItemAttachmentEntity);
      }
    }
    action.heldItem?.follow(owner.deltaTime);
    if (action.tool && action.elapsed >= (action.toolHideTime ?? Infinity)) {
      action.tool.visible = false;
    }
    if (
      action.heldItem
      && action.heldItemHideTime !== null
      && action.elapsed >= action.heldItemHideTime
    ) {
      action.heldItem.destroy();
      action.heldItem = null;
    }
    if (action.elapsed < action.duration) {
      return;
    }
    const nextHeldItem = action.collected ? action.nextHeldItem?.() : null;
    if (nextHeldItem) {
      action.heldItem?.destroy();
      action.heldItem = nextHeldItem;
      action.elapsed = 0;
      action.impacted = false;
      action.collected = false;
      action.retarget?.(action);
      action.phase = action.positioning
        ? HERO_COLLECTION_PHASE.APPROACHING
        : HERO_COLLECTION_PHASE.REACHING;
      HeroCollectingActionState.#begin(owner);

      return;
    }
    action.completed = true;
    owner.finish();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    const action = this.payload;
    const feedback = owner.feedback.collection;
    if (action.completed) {
      feedback.playPickupSound();
    }
    if (action.tool) {
      action.tool.visible = false;
    }
    action.heldItem?.destroy();
    action.heldItem = null;
    feedback.restartAnimation();
    if (action.completed) {
      action.onComplete?.();
    }
    super.exit(owner);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  static #begin(owner) {
    const action = owner.payload;
    const feedback = owner.feedback.collection;
    if (action.tool) {
      feedback.mountTool(action.tool);
      action.tool.visible = true;
    }
    feedback.begin();
  }

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #animation({ payload }) {
    return payload.positioning
      ? HERO_ANIMATION.WALK
      : payload.animation;
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   * @returns {string}
   */
  static #phase(action) {
    if (action.elapsed >= (action.heldItemHideTime ?? action.duration)) {
      return HERO_COLLECTION_PHASE.RECOVERING;
    }
    if (action.elapsed >= (action.stowStartTime ?? action.duration)) {
      return HERO_COLLECTION_PHASE.STOWING;
    }
    if (action.elapsed >= action.impactTime) {
      return action.elapsed < (action.liftStartTime ?? action.impactTime)
        ? HERO_COLLECTION_PHASE.WITHDRAWING
        : HERO_COLLECTION_PHASE.LIFTING;
    }
    if (action.elapsed >= (action.cutStartTime ?? Infinity)) {
      return HERO_COLLECTION_PHASE.CUTTING;
    }
    return HERO_COLLECTION_PHASE.REACHING;
  }
}

export class HeroInventoryFullActionState extends HeroRuntimeActionState {
  /**
   * @param {string} category
   * @param {HeroRefusalOptions} options
   * @param {HeroCollectionHost} host
   * @returns {import("src/game/objects/ObjectTypes.js").HeroActionPayload}
   */
  static createPayload(category, { targetPosition = null, targetRadius = 0, onComplete = null } = {}, host) {
    const { position, facingDirection } = host.readPose();
    let positioning = null;
    if (targetPosition) {
      const targetX = targetPosition.x - position.x;
      const targetZ = targetPosition.z - position.z;
      const targetDistance = Math.hypot(targetX, targetZ);
      if (targetDistance > 0.001) {
        host.setFacingYaw((Math.atan2(targetX, targetZ) * 180) / Math.PI);
      }
      positioning = HeroCollectingActionState.positioning({
        position,
        facingDirection,
      }, {
        pickupAction: pickupActionForCategory(category),
        targetPosition,
        targetRadius,
        targetDistance,
      });
    }
    return {
      elapsed: 0,
      notified: false,
      positioning,
      positioningElapsed: 0,
      onComplete,
    };
  }

  constructor() {
    super(HERO_ACTION.INVENTORY_FULL_REACTION, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: HeroInventoryFullActionState.#animation,
      allowedTransitions: [HERO_ACTION.BLOCKED_DIG_REACTION],
      requiresGrounded: true,
      blocksMovement: true,
      allowsIdleHeadLook: false,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    owner.feedback.collection.begin();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const action = this.payload;
    const feedback = owner.feedback.collection;
    if (advancePositioning(action, owner)) {
      return;
    }
    action.elapsed += owner.deltaTime;
    if (!action.notified && action.elapsed >= feedback.fullEffectTime) {
      action.notified = true;
      feedback.showInventoryFull();
    }
    if (action.elapsed >= feedback.fullDuration) {
      action.completed = true;
      owner.finish();
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    const action = this.payload;
    owner.feedback.collection.restartAnimation();
    if (action.completed) {
      action.onComplete?.();
    }
    super.exit(owner);
  }

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #animation({ payload }) {
    return payload.positioning
      ? HERO_ANIMATION.WALK
      : HERO_ANIMATION.INVENTORY_FULL_COLLAPSE;
  }
}
