import { KING_ANIMATION } from "../../../../../enum/KingAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingPrepareTrainingState extends AbstractTerraceParticipantState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super({ phase: KingPrepareTrainingState.name, stagePhase: STAGE.SETTLE,
      duration, action: "sword", animation: KING_ANIMATION.SWORD_READY });
  }
}
