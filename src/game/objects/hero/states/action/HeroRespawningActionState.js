import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroRespawningActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.RESPAWNING, {
      animation: HERO_ANIMATION.RESPAWN,
      incapacitated: true,
      blocksMovement: true,
      locksFacing: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
    });
  }

  execute(owner) {
    const feedback = owner.feedback.respawning;
    this.payload.elapsed = Math.min(
      feedback.duration,
      this.payload.elapsed + owner.deltaTime,
    );
    if (this.payload.elapsed >= feedback.duration) {
      owner.finish();
      feedback.complete();
    }
  }

  exit(owner) {
    owner.feedback.respawning?.resetPresentation?.();
    super.exit(owner);
  }

  present(owner) {
    const feedback = owner.feedback.respawning;
    feedback.updatePresentation?.(
      Math.min(1, this.payload.elapsed / feedback.duration),
      this.payload.elapsed,
    );
  }
}
