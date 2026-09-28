import { KING_ANIMATION } from "../../../../../enum/KingAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class KingEnterTrainingState extends AbstractTerraceParticipantState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super({ phase: KingEnterTrainingState.name, stagePhase: STAGE.ROYAL_ENTER,
      duration, action: "walk", animation: KING_ANIMATION.TERRACE_WALK });
  }
}
