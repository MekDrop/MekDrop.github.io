import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingHalfTurnState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.HALF_TURN_PRACTICE);
  }
}
