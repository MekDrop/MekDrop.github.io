import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroPatReactionActionState extends HeroRuntimeActionState {
  /**
   *
   * @param {boolean} allowedTransitions
   */
  constructor(allowedTransitions = []) {
    super(HERO_ACTION.PAT_REACTION, {
      animation: HERO_ANIMATION.PAT_ANNOYED,
      canBePatted: true,
      allowedTransitions,
      allowsJump: true,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    if (!owner.feedback.patReaction.shouldContinue()) {
      owner.finish();
      return;
    }
    this.payload.remaining = Math.max(
      0,
      this.payload.remaining - owner.deltaTime,
    );
    if (this.payload.remaining === 0) {
      owner.finish();
    }
  }
}
