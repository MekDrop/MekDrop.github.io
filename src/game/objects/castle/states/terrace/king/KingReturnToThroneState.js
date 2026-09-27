import { KING_ANIMATION } from "../../../../../enum/KingAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingReturnToThroneState extends AbstractTerraceParticipantState {
  constructor(duration) {
    super({ phase: KingReturnToThroneState.name, stagePhase: STAGE.ROYAL_EXIT,
      duration, action: "walk", animation: KING_ANIMATION.TERRACE_WALK });
  }
}
