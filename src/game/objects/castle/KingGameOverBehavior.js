import { KingCryState } from "./KingCryState.js";
import { RoyalGameOverBehaviorBase } from "./RoyalGameOverBehaviorBase.js";

const DESTINATION = Object.freeze({ lateral: 0, forward: -1.35, elevation: 0.05 });

export class KingGameOverBehavior extends RoyalGameOverBehaviorBase {
  constructor(options) {
    super({ ...options, CryStateType: KingCryState, destination: DESTINATION });
  }
}
