import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingGroundRestState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.GROUND_REST);
  }
}
