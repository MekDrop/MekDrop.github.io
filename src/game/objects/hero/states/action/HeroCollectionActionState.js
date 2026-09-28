import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

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
  constructor() {
    super(HERO_ACTION.COLLECTING, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: ({ payload }) => payload.positioning
        ? HERO_ANIMATION.WALK
        : payload.animation,
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
    owner.feedback.collection.begin(this.payload);
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
    if (!action.impacted && action.elapsed >= action.impactTime) {
      action.impacted = true;
      const collected = action.onImpact?.() === true;
      if (collected && action.heldItem) {
        feedback.mountHeldItem(action.heldItem, action.heldItemAttachmentEntity);
      }
    }
    action.heldItem?.follow(owner.deltaTime);
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
    action.completed = true;
    owner.finish();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    const action = this.payload;
    owner.feedback.collection.endCollection(action);
    super.exit(owner);
  }
}

export class HeroInventoryFullActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.INVENTORY_FULL_REACTION, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: ({ payload }) => payload.positioning
        ? HERO_ANIMATION.WALK
        : HERO_ANIMATION.INVENTORY_FULL_COLLAPSE,
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
    owner.feedback.collection.beginInventoryFull(this.payload);
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
    owner.feedback.collection.endInventoryFull(action);
    super.exit(owner);
  }
}
