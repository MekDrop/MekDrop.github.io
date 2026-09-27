import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class PrincessDrinkTeaState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: PrincessDrinkTeaState.name, stagePhase: STAGE.ACTIVITY,
      duration: Infinity, action: "drink", animation: ANIMATION.DRINK });
  }
}
