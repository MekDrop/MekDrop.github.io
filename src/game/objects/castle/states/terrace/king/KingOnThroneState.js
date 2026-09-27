import { KING_ANIMATION } from "../../../../../enum/KingAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingOnThroneState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: KingOnThroneState.name, stagePhase: STAGE.DORMANT,
      duration: Infinity, action: "sitOnThrone",
      animation: KING_ANIMATION.TERRACE_IDLE });
  }
}
