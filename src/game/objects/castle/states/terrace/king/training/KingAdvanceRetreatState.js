import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingAdvanceRetreatState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.ADVANCE_RETREAT);
  }
}
