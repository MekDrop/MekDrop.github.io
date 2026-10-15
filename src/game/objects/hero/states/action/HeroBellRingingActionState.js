import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

/**
 * Approach, grasp, pull, release, and settle before accepting another action.
 */
export class HeroBellRingingActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.RINGING_BELL, {
      /**
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      animation: ({ payload }) => payload.pulling ? HERO_ANIMATION.RING_BELL : HERO_ANIMATION.WALK,
      requiresGrounded: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
      locksHeadForward: true,
      snapFacing: true,
      /**
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      facing: ({ payload }) => payload.pulling ? payload.facing : this.#direction(payload),
      /**
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       */
      movement: ({ payload }) => {
        if (payload.pulling) { return {
          x: 0,
          z: 0,
        }; }
        const direction = this.#direction(payload);
        const speed = Math.min(0.8, Math.hypot(direction.x, direction.z) * 5);
        const length = Math.hypot(direction.x, direction.z) || 1;
        return {
          x: direction.x / length * speed,
          z: direction.z / length * speed,
        };
      },
    });
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} action
   * @returns {{x:number,z:number}}
   */
  #direction(action) {
    const current = action.currentPosition();
    return {
      x: action.position.x - current.x,
      z: action.position.z - current.z,
    };
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const action = this.payload;
    const direction = this.#direction(action);
    const distance = Math.hypot(direction.x, direction.z);
    if (!action.supported() || (action.pulling && distance > 0.15)) {
      owner.finish();
      return;
    }
    if (!action.pulling) {
      // Allow the capsule's resting margin; the glove encloses the rope here.
      if (distance <= 0.065) {
        action.pulling = true;
        action.begin();
        action.onStart();
        return;
      }
      action.approachElapsed += owner.deltaTime;
      action.closestDistance ??= distance;
      if (distance < action.closestDistance - 0.005) {
        action.closestDistance = distance;
        action.stalledElapsed = 0;
      } else {
        action.stalledElapsed = (action.stalledElapsed ?? 0) + owner.deltaTime;
      }
      if (action.stalledElapsed > 1.5 || action.approachElapsed > 8) { owner.finish(); }
      return;
    }
    action.elapsed += owner.deltaTime;
    action.onProgress?.(Math.min(2.2, action.elapsed));
    // RingBell and the prop's Ring clip share the same elapsed-time clock.
    if (!action.struck && action.elapsed >= 0.9) {
      action.struck = true;
      action.onStrike();
    }
    if (action.elapsed >= 2.2) { owner.finish(); }
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    const end = this.payload.onEnd;
    super.exit(owner);
    // Defer refresh until the state machine has installed its next state.
    queueMicrotask(end);
  }
}
