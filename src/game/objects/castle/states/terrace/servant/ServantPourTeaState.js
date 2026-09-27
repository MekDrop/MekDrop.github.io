import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class ServantPourTeaState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: ServantPourTeaState.name, stagePhase: STAGE.POUR,
      duration: 3, action: "pour", animation: ANIMATION.POUR });
  }
}
