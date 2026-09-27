import { KING_ANIMATION } from "../../../../../enum/KingAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingCombatTrainingState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: KingCombatTrainingState.name, stagePhase: STAGE.ACTIVITY,
      duration: Infinity, action: "sword",
      animation: KING_ANIMATION.SWORD_READY });
  }
}
