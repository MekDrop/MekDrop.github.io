import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HERO_ANIMATION } from "../../../../enum/HeroAnimation.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

/**
 *
 * @param {number} progress
 */
function smoothProgress(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

export class HeroBridgeClimbActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.BRIDGE_CLIMB, {
      /**
       *
       * @param {{payload: import("src/game/objects/ObjectTypes.js").HeroActionPayload, bridgeClimbEnd: ConstructorParameters<typeof HeroRuntimeActionState>[0]}} options
       * @param {import("src/game/objects/ObjectTypes.js").HeroActionPayload} options.payload
       * @param {ConstructorParameters<typeof HeroRuntimeActionState>[0]} options.bridgeClimbEnd
       */
      animation: ({ payload, bridgeClimbEnd }) =>
        payload.elapsed < bridgeClimbEnd
          ? HERO_ANIMATION.BLOCKED_PUSH
          : HERO_ANIMATION.JUMP,
      exclusive: true,
      incapacitated: true,
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
    this.payload = owner.feedback.bridgeClimb.begin(this.payload);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  execute(owner) {
    const feedback = owner.feedback.bridgeClimb;
    const action = this.payload;
    action.elapsed = Math.min(
      feedback.duration,
      action.elapsed + owner.deltaTime,
    );
    const progress = action.elapsed / feedback.duration;
    const catchProgress = feedback.catchEnd / feedback.duration;
    const climbProgress = feedback.climbEnd / feedback.duration;
    const catchY = action.cell.terrainHeight - feedback.catchHeightOffset;
    const railY = action.cell.terrainHeight + feedback.railOffset;
    let next;
    if (progress < catchProgress) {
      const phase = smoothProgress(progress / catchProgress);
      next = {
        x: action.startX,
        y: action.startY + (catchY - action.startY) * phase,
        z: action.startZ,
      };
    } else if (progress < climbProgress) {
      const phase = smoothProgress(
        (progress - catchProgress) / (climbProgress - catchProgress),
      );
      const pullPhase = phase * phase;
      next = {
        x: action.startX + (action.railX - action.startX) * pullPhase,
        y: catchY + (railY - catchY) * phase,
        z: action.startZ + (action.railZ - action.startZ) * pullPhase,
      };
    } else {
      const phase = smoothProgress(
        (progress - climbProgress) / (1 - climbProgress),
      );
      next = {
        x: action.railX + (action.deckX - action.railX) * phase,
        y: railY
          + (action.cell.terrainHeight - railY) * phase
          + Math.sin(phase * Math.PI) * feedback.hopHeight,
        z: action.railZ + (action.deckZ - action.railZ) * phase,
      };
    }
    feedback.moveTo(next, owner.deltaTime);
    if (progress >= 1) {
      owner.finish();
      feedback.complete();
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  exit(owner) {
    owner.feedback.bridgeClimb?.resetPresentation?.();
    super.exit(owner);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").HeroActionContext} owner
   */
  present(owner) {
    const feedback = owner.feedback.bridgeClimb;
    const elapsed = this.payload.elapsed;
    let armPitch;
    let armSpread;
    if (elapsed < feedback.catchEnd) {
      const phase = smoothProgress(elapsed / feedback.catchEnd);
      armPitch = -92 * phase;
      armSpread = 12 * phase;
    } else if (elapsed < feedback.climbEnd) {
      const phase = smoothProgress(
        (elapsed - feedback.catchEnd)
          / (feedback.climbEnd - feedback.catchEnd),
      );
      armPitch = -92 + phase * 27;
      armSpread = 12 - phase * 5;
    } else {
      const phase = smoothProgress(
        (elapsed - feedback.climbEnd)
          / (feedback.duration - feedback.climbEnd),
      );
      armPitch = -65 * (1 - phase);
      armSpread = 7 * (1 - phase);
    }
    const headPitch = elapsed < feedback.climbEnd
      ? -10 + Math.sin(elapsed * 18) * 4
      : -10
        * (1 - (elapsed - feedback.climbEnd)
          / (feedback.duration - feedback.climbEnd));
    feedback.updatePresentation?.({ armPitch, armSpread, headPitch });
  }
}
