import { HERO_ACTION } from "../../../../enum/HeroAction.js";
import { HeroRuntimeActionState } from "./HeroRuntimeActionState.js";

export class HeroToolActionState extends HeroRuntimeActionState {
  constructor() {
    super(HERO_ACTION.USING_TOOL, {
      animation: ({ payload }) => {
        if (payload.phase === "summon") {
          return payload.tool.summonAnimation;
        }
        if (payload.phase === "dismiss") {
          return payload.tool.dismissAnimation;
        }
        return payload.useAnimation;
      },
      requiresGrounded: true,
      blocksMovement: true,
      allowsIdleHeadLook: false,
    });
  }

  enter(owner) {
    super.enter(owner);
    owner.feedback.tool.begin(this.payload);
  }

  execute(owner) {
    const action = this.payload;
    const feedback = owner.feedback.tool;
    action.elapsed += owner.deltaTime;
    if (action.phase === "summon") {
      if (action.elapsed >= action.tool.summonDuration) {
        action.phase = "use";
        action.elapsed = 0;
        feedback.restartAnimation();
      }
      return;
    }
    if (action.phase === "dismiss") {
      if (action.elapsed >= action.tool.dismissDuration) {
        owner.finish();
      }
      return;
    }
    if (!action.impacted && action.elapsed >= action.tool.impactTime) {
      action.impacted = true;
      action.stopAfterCycle = action.onImpact?.() === true;
    }
    if (action.elapsed < action.tool.useDuration) {
      return;
    }
    if (!action.stopAfterCycle) {
      action.elapsed = 0;
      action.impacted = false;
      feedback.restartAnimation();
      return;
    }
    action.phase = "dismiss";
    action.elapsed = 0;
    action.impacted = false;
    feedback.restartAnimation();
  }

  exit(owner) {
    const action = this.payload;
    owner.feedback.tool.complete(action);
    super.exit(owner);
  }
}
