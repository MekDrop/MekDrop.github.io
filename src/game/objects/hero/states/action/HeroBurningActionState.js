import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";
import { HeroLavaDeathEffect } from "../../HeroLavaDeathEffect.js";

const DURATION = 1.35;
const ASH_START = 0.68;
const SUBMERGE_DEPTH = 0.82;
const FAREWELL_SUBMERGE_DEPTH = 1.6;

export class HeroBurningActionState extends HeroRuntimeActionState {
  /**
   * @type {HeroLavaDeathEffect|null}
   */
  #effect = null;

  constructor() {
    super(HERO_ACTION.BURNING, {
      animation: HERO_ANIMATION.FALL_DEATH,
      exclusive: true,
      incapacitated: true,
      dying: true,
      locksFacing: true,
      allowsFootPlacement: false,
      allowsIdleHeadLook: false,
      controlsHeadPresentation: true,
    });
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    const feedback = owner.feedback.burning;
    this.payload = {
      elapsed: 0,
      surfaceY: this.payload.cell.elevation + 0.02,
      farewell: feedback.lives() > 1,
      ashes: false,
    };
    feedback.freezeAtHeight(this.payload.surfaceY);
    const presentation = feedback.presentation?.();
    if (presentation) {
      this.#effect = new HeroLavaDeathEffect(presentation);
      presentation.parent.addChild(this.#effect.entity);
      this.#effect.begin();
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const feedback = owner.feedback.burning;
    const action = this.payload;
    action.elapsed = Math.min(
      DURATION,
      action.elapsed + owner.deltaTime,
    );
    const progress = action.elapsed / DURATION;
    const sinkStart = action.farewell ? 0.2 : 0.08;
    const sinkProgress = Math.max(0, Math.min(1, (progress - sinkStart) / 0.72));
    const easedSink = sinkProgress * sinkProgress * (3 - 2 * sinkProgress);
    feedback.setHeight(
      action.surfaceY - (action.farewell ? FAREWELL_SUBMERGE_DEPTH : SUBMERGE_DEPTH) * easedSink,
    );
    this.#effect?.update(progress);
    const collapseProgress = Math.max(
      0,
      Math.min(1, (progress - 0.28) / 0.48),
    );
    const scale = feedback.modelScale * (action.farewell ? 1 : 1 - collapseProgress);
    feedback.setModelScale(
      scale,
      scale * (action.farewell ? 1 : 1 - collapseProgress * 0.35),
      scale,
    );
    if (!action.ashes && progress >= (action.farewell ? 0.9 : ASH_START)) {
      action.ashes = true;
      feedback.syncState();
    }
    if (action.elapsed >= DURATION) {
      feedback.setModelScale(0, 0, 0);
      const nextAction = owner.feedback.death.resolve();
      owner.transition(nextAction, {
        elapsed: 0,
        ashes: nextAction === HERO_ACTION.GAME_OVER,
      });
    }
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    this.#effect?.destroy();
    this.#effect = null;
    const scale = this.payload.elapsed >= DURATION
      ? 0
      : owner.feedback.burning.modelScale;
    owner.feedback.burning.setModelScale(scale, scale, scale);
    super.exit(owner);
  }

  /**
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   * @returns {string}
   */
  animationFor(owner) {
    return this.payload?.farewell
      ? HERO_ANIMATION.LAVA_FAREWELL
      : super.animationFor(owner);
  }
}
