import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class ServantReturnState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: ServantReturnState.name, stagePhase: STAGE.SERVANT_RETURN,
      duration: 3.2, action: "walk", animation: ANIMATION.WALK });
  }
}
