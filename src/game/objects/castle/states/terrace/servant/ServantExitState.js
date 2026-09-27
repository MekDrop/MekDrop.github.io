import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class ServantExitState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: ServantExitState.name, stagePhase: STAGE.SERVANT_EXIT,
      duration: 3.2, action: "walk", animation: ANIMATION.WALK });
  }
}
