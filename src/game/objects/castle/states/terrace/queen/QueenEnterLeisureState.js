import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class QueenEnterLeisureState extends AbstractTerraceParticipantState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super({ phase: QueenEnterLeisureState.name, stagePhase: STAGE.ROYAL_ENTER,
      duration, action: "walk", animation: ANIMATION.WALK });
  }
}
