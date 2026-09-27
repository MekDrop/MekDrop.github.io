import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class PrincessReturnToThroneState extends AbstractTerraceParticipantState {
  constructor(duration) {
    super({ phase: PrincessReturnToThroneState.name, stagePhase: STAGE.ROYAL_EXIT,
      duration, action: "walk", animation: ANIMATION.WALK });
  }
}
