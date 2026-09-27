import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class ServantCleanupDelayState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: ServantCleanupDelayState.name,
      stagePhase: STAGE.CLEANUP_DELAY, duration: 2.5,
      action: "idle", animation: ANIMATION.IDLE });
  }
}
