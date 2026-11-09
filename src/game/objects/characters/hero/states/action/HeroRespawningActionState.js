import { HERO_ACTION } from "../../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

/**
 * Hero owns the model and effect resources; the state owns when they run.
 * Read these live because a model rebuild can replace the effect mid-respawn.
 * @typedef {object} HeroRespawnPresentation
 * @property {import("../../HeroRespawnEffect.js").HeroRespawnEffect|null} effect
 * @property {number} facingYaw
 * @property {number} baseHeight
 * @typedef {object} HeroRespawnFeedback
 * @property {number} duration
 * @property {() => void} prepare Restore the model scale and supported spawn pose.
 * @property {() => HeroRespawnPresentation} presentation Read current scene resources.
 * @property {() => void} begin Clear recovery cooldowns and publish the restored state.
 * @property {() => void} complete Restart normal animation after leaving respawn.
 */

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

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  enter(owner) {
    super.enter(owner);
    /**
     * @type {HeroRespawnFeedback}
     */
    const feedback = owner.feedback.respawning;
    feedback.prepare();
    const { effect, facingYaw, baseHeight } = feedback.presentation();
    effect.begin(facingYaw, baseHeight);
    feedback.begin();
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
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

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    owner.feedback.respawning.presentation().effect?.reset();
    super.exit(owner);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  present(owner) {
    const feedback = owner.feedback.respawning;
    const { effect, baseHeight } = feedback.presentation();
    effect?.update(
      Math.min(1, this.payload.elapsed / feedback.duration),
      this.payload.elapsed,
      baseHeight,
    );
  }
}
