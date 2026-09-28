import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class PrincessStandState extends AbstractTerraceParticipantState {
  /**
   *
   * @param {number} duration
   */
  constructor(duration) {
    super({ phase: PrincessStandState.name, stagePhase: STAGE.RISE,
      duration, action: "drink", animation: ANIMATION.SIT });
  }
}
