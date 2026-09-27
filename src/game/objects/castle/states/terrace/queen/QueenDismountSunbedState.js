import { TERRACE_ACTOR_ANIMATION as ANIMATION } from "../../../../../enum/TerraceActorAnimation.js";
import { CASTLE_TERRACE_PHASE as STAGE } from "../../../../../enum/CastleTerracePhase.js";
import { AbstractTerraceParticipantState } from "../AbstractTerraceParticipantState.js";

export class QueenDismountSunbedState extends AbstractTerraceParticipantState {
  constructor(duration) {
    super({ phase: QueenDismountSunbedState.name, stagePhase: STAGE.RISE,
      duration, action: "mountSunbed", animation: ANIMATION.MOUNT_SUNBED });
  }
}
