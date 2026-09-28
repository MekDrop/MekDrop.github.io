import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroFallingToDeathActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.FALLING_TO_DEATH, {
      animation: HERO_ANIMATION.FALL_DEATH,
      incapacitated: true,
      dying: true,
      movement: ({ velocity }) => ({ x: velocity.x, z: velocity.z }),
      locksFacing: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
    });
  }

  enter(owner) {
    super.enter(owner);
    owner.feedback.falling.begin();
  }

  execute(owner) {
    if (!owner.feedback.falling.finished()) {
      return;
    }
    const nextAction = owner.feedback.death.resolve();
    owner.transition(nextAction, { elapsed: 0 });
  }
}
