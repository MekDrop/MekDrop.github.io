import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

const ANIMATIONS = Object.freeze({
  up: HERO_ANIMATION.DODGE_FORWARD,
  down: HERO_ANIMATION.DODGE_BACKWARD,
  left: HERO_ANIMATION.DODGE_LEFT,
  right: HERO_ANIMATION.DODGE_RIGHT,
});

export class HeroDodgeActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.DODGING, {
      animation: ({ payload }) => ANIMATIONS[payload.direction]
        ?? HERO_ANIMATION.DODGE_FORWARD,
      allowedTransitions: [
        HERO_ACTION.USING_TOOL,
        HERO_ACTION.BLOCKED_DIG_REACTION,
      ],
      allowsJump: true,
      requiresGrounded: true,
      movement: ({ payload }) => ({
        x: payload.x * payload.speed,
        z: payload.z * payload.speed,
      }),
      facing: ({ payload }) => payload.facing,
      snapFacing: ({ payload }) =>
        payload.direction === "left" || payload.direction === "right",
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
    });
  }

  execute(owner) {
    const action = this.payload;
    action.elapsed = Math.min(
      action.duration,
      action.elapsed + owner.deltaTime,
    );
    if (action.elapsed < action.duration) {
      return;
    }
    const crossedLedge = action.crossedLedge;
    owner.finish();
    owner.feedback.dodge.complete(crossedLedge);
  }
}
