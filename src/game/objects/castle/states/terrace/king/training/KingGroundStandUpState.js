import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingGroundStandUpState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.GROUND_STAND_UP);
  }
}
