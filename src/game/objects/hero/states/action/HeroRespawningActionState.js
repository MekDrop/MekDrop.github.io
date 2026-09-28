import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroRespawningActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.RESPAWNING, {
      animation: HERO_ANIMATION.RESPAWN,
      incapacitated: true,
    });
  }

  execute(owner) {
    const feedback = owner.feedback.respawning;
    this.payload.elapsed = Math.min(
      feedback.duration,
      this.payload.elapsed + owner.deltaTime,
    );
    feedback.update();
    if (this.payload.elapsed >= feedback.duration) {
      owner.finish();
      feedback.complete();
    }
  }
}
