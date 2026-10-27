import { HERO_ACTION } from "../../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroToolActionState extends HeroRuntimeActionState {
  /**
   * Axe clips author their planted feet and the top cut's toe contact.
   * @returns {boolean}
   */
  get allowsFootPlacement() {
    return ["axe", "hammer"].includes(this.payload?.tool?.name) && !this.payload.positioning
      ? false : super.allowsFootPlacement;
  }

  /**
   * Keep the authored axe clearance pose instead of replacing it with idle gaze.
   * @returns {boolean}
   */
  get locksHeadForward() {
    return ["axe", "hammer"].includes(this.payload?.tool?.name);
  }

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
      if (action.tool) {
        action.tool.visible = false;
      }
      this.#advancePositioning(owner);

      return;
    }
    action.elapsed += owner.deltaTime;
    action.tool.visible =
      action.phase === "dismiss"
        ? action.elapsed < (action.tool.dismissVisibilityTime ?? Infinity)
        : action.phase !== "summon" || action.elapsed >= (action.tool.summonVisibilityTime ?? 0);
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
      if (action.onCycle?.(action) === false) {
        action.stopAfterCycle = true;
        action.phase = "dismiss";
        action.elapsed = 0;
        feedback.restartAnimation();

        return;
      }
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
    const path = action.positioning.waypoints;
    const lengths = action.positioning.lengths;
    const distance = lengths?.[lengths.length - 1] ?? action.positioning.travel ?? 0;
    const duration = Math.max(feedback.positioningDuration, distance / 2.4);
    const progress = Math.min(1, action.positioningElapsed / duration);
    const eased = progress * progress * (3 - 2 * progress);
    let x = action.positioning.startX + (action.positioning.targetX - action.positioning.startX) * eased;
    let z = action.positioning.startZ + (action.positioning.targetZ - action.positioning.startZ) * eased;
    if (path) {
      const along = eased * distance;
      let segment = 1;
      while (segment < path.length - 1 && lengths[segment] < along) {
        segment += 1;
      }
      const span = lengths[segment] - lengths[segment - 1];
      const amount = span > 0 ? (along - lengths[segment - 1]) / span : 1;
      x = path[segment - 1].x + (path[segment].x - path[segment - 1].x) * amount;
      z = path[segment - 1].y + (path[segment].y - path[segment - 1].y) * amount;
    }
    const canOccupy = action.positioning.context
      ? owner.feedback.tool.canOccupyStance(x, z) : feedback.canOccupy(x, z);
    if (!canOccupy) {
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
