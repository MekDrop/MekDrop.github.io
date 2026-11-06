import { KING_ANIMATION } from "../../../../../../enum/KingAnimation.js";
import { KingTrainingActionState } from "./KingTrainingActionState.js";

export class KingJumpSpinState extends KingTrainingActionState {
  constructor() {
    super(KING_ANIMATION.JUMP_SPIN);
  }
}
