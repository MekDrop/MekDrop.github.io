import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroBurningActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.BURNING, {
      animation: HERO_ANIMATION.FALL_DEATH,
      exclusive: true,
      incapacitated: true,
      dying: true,
      locksFacing: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    this.payload = owner.feedback.burning.begin(this.payload);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const feedback = owner.feedback.burning;
    const action = this.payload;
    action.elapsed = Math.min(
      feedback.duration,
      action.elapsed + owner.deltaTime,
    );
    const progress = action.elapsed / feedback.duration;
    const sinkProgress = Math.max(0, Math.min(1, (progress - 0.08) / 0.72));
    const easedSink = sinkProgress * sinkProgress * (3 - 2 * sinkProgress);
    feedback.setHeight(
      action.surfaceY - feedback.submergeDepth * easedSink,
    );
    feedback.updateEffect(progress);
    const collapseProgress = Math.max(
      0,
      Math.min(1, (progress - 0.28) / 0.48),
    );
    const scale = feedback.modelScale * (1 - collapseProgress);
    feedback.setModelScale(
      scale,
      scale * (1 - collapseProgress * 0.35),
      scale,
    );
    if (!feedback.ashes() && progress >= feedback.ashStart) {
      feedback.showAshes();
    }
    if (action.elapsed >= feedback.duration) {
      const nextAction = owner.feedback.death.resolve();
      owner.transition(nextAction, { elapsed: 0 });
    }
  }
}
