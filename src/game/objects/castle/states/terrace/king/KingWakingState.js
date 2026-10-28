import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingWakingState extends AbstractTerraceParticipantState {
  constructor() {
    super({
      phase: KingWakingState.name,
      stagePhase: STAGE.DORMANT,
      duration: 4.9,
      action: "waking",
      animation: null,
    });
  }
}
