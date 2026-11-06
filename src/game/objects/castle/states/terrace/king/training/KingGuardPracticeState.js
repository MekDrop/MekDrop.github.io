import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingGuardPracticeState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.GUARD_PRACTICE);
  }
}
