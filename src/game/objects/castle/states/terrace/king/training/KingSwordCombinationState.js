import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingSwordCombinationState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.SWORD_COMBINATION);
  }
}
