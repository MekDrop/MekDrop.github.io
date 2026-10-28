import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingDozingState extends AbstractTerraceParticipantState {
  constructor() {
    super({
      phase: KingDozingState.name,
      stagePhase: STAGE.DORMANT,
      duration: 9.1,
      action: "dozing",
      animation: null,
    });
  }
}
