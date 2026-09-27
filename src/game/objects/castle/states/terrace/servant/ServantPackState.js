import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class ServantPackState extends AbstractTerraceParticipantState {
  constructor() {
    super({ phase: ServantPackState.name, stagePhase: STAGE.PACK,
      duration: 2, action: "place", animation: ANIMATION.PLACE });
  }
}
