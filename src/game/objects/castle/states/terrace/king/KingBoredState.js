import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingBoredState extends AbstractTerraceParticipantState {
  constructor() {
    super({
      phase: KingBoredState.name,
      stagePhase: STAGE.DORMANT,
      duration: 7,
      action: "bored",
      animation: null,
    });
  }
}
