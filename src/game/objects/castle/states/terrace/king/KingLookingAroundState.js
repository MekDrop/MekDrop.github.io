import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingLookingAroundState extends AbstractTerraceParticipantState {
  constructor() {
    super({
      phase: KingLookingAroundState.name,
      stagePhase: STAGE.DORMANT,
      duration: 7,
      action: "looking",
      animation: null,
    });
  }
}
