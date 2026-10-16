import { HERO_ACTION } from "../../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
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
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: HeroDodgeActionState.#animation,
      allowedTransitions: [
        HERO_ACTION.USING_TOOL,
        HERO_ACTION.BLOCKED_DIG_REACTION,
      ],
      allowsJump: true,
      requiresGrounded: true,
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      movement: HeroDodgeActionState.#movement,
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      facing: HeroDodgeActionState.#facing,
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      snapFacing: HeroDodgeActionState.#snapFacing,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
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

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #animation({ payload }) {
    return ANIMATIONS[payload.direction]
        ?? HERO_ANIMATION.DODGE_FORWARD;
  }

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #movement({ payload }) {
    return {
      x: payload.x * payload.speed,
      z: payload.z * payload.speed,
    };
  }

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #facing({ payload }) {
    return payload.facing;
  }

  /**
   *
   * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
   */
  static #snapFacing({ payload }) {
    return payload.direction === "left" || payload.direction === "right";
  }
}
