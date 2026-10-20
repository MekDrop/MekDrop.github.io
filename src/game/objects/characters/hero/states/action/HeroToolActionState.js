import { HERO_ACTION } from "../../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroToolActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.USING_TOOL, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: HeroToolActionState.#animation,
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
    owner.feedback.tool.begin(this.payload);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const action = this.payload;
    const feedback = owner.feedback.tool;
    if (action.positioning) {
      this.#advancePositioning(owner);

      return;
    }
    action.elapsed += owner.deltaTime;
    action.tool.visible =
      action.phase !== "summon" || action.elapsed >= (action.tool.summonVisibilityTime ?? 0);
    if (action.phase === "summon") {
      if (action.elapsed >= action.tool.summonDuration) {
        action.phase = "use";
        action.elapsed = 0;
        feedback.restartAnimation();
      }
      return;
    }
    if (action.phase === "dismiss") {
      if (action.elapsed >= action.tool.dismissDuration) {
        owner.finish();
      }
      return;
    }
    const impactTimes = action.impactTimes ?? [action.tool.impactTime];
    action.impactIndex ??= action.impacted ? impactTimes.length : 0;
    while (!action.stopAfterCycle && action.impactIndex < impactTimes.length &&
      action.elapsed >= impactTimes[action.impactIndex]) {
      action.impacted = true;
      action.impactIndex += 1;
      action.stopAfterCycle = action.onImpact?.(action) === true;
    }
    const duration = action.stopAfterCycle
      ? action.impactIndex * (action.strokeDuration ?? action.tool.useDuration)
      : (action.useDuration ?? action.tool.useDuration);
    if (action.elapsed < duration) {
      return;
    }
    if (!action.stopAfterCycle) {
      action.elapsed = 0;
      action.impacted = false;
      action.impactIndex = 0;
      action.useAnimation = action.tool.useAnimation(action.toolContext);
      action.useDuration = action.tool.useDurationFor?.(action.toolContext) ?? action.tool.useDuration;
      action.strokeDuration = action.tool.strokeDurationFor?.(action.toolContext) ?? action.tool.useDuration;
      action.impactTimes = action.tool.impactTimes?.(action.toolContext) ?? [action.tool.impactTime];
      feedback.restartAnimation();

      return;
    }
    action.phase = "dismiss";
    action.elapsed = 0;
    action.impacted = false;
    feedback.restartAnimation();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    const action = this.payload;
    owner.feedback.tool.complete(action);
    super.exit(owner);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  #advancePositioning(owner) {
    const action = this.payload;
    const feedback = owner.feedback.collection;
    action.positioningElapsed += owner.deltaTime;
    const progress = Math.min(1, action.positioningElapsed / feedback.positioningDuration);
    const eased = progress * progress * (3 - 2 * progress);
    const x = action.positioning.startX + (action.positioning.targetX - action.positioning.startX) * eased;
    const z = action.positioning.startZ + (action.positioning.targetZ - action.positioning.startZ) * eased;
    if (!feedback.canOccupy(x, z)) {
      owner.finish();

      return;
    }
    feedback.moveTo(x, z);
    if (progress >= 1) {
      action.positioning = null;
      action.positioningElapsed = 0;
      owner.feedback.tool.restartAnimation();
    }
  }

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #animation({ payload }) {
    if (payload.positioning) {
      return HERO_ANIMATION.WALK;
    }
    if (payload.phase === "summon") {
      return payload.tool.summonAnimation;
    }
    if (payload.phase === "dismiss") {
      return payload.tool.dismissAnimation;
    }
    return payload.useAnimation;
  }
}
