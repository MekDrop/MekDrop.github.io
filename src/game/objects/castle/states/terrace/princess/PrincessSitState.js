import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class PrincessSitState extends AbstractTerraceParticipantState {
  constructor(duration) {
    super({ phase: PrincessSitState.name, stagePhase: STAGE.SETTLE,
      duration, action: "drink", animation: ANIMATION.SIT });
  }
}
