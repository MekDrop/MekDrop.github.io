import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class QueenOnThroneState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: QueenOnThroneState.name, stagePhase: STAGE.DORMANT,
      duration: Infinity, action: "sitOnThrone", animation: ANIMATION.IDLE });
  }
}
