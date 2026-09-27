import { PrincessCryState } from "./PrincessCryState.js";
import { RoyalGameOverBehaviorBase } from "./RoyalGameOverBehaviorBase.js";

const DESTINATION = Object.freeze({ lateral: 1.15, forward: -1, elevation: 0.05 });

export class PrincessGameOverBehavior extends RoyalGameOverBehaviorBase {
  constructor(options) {
    super({
      ...options,
      CryStateType: PrincessCryState,
      destination: DESTINATION,
    });
  }
}
