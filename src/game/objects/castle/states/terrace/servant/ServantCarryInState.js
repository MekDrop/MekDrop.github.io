import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class ServantCarryInState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: ServantCarryInState.name, stagePhase: STAGE.SERVANT_ENTER,
      duration: 3.2, action: "carry", animation: ANIMATION.CARRY });
  }
}
