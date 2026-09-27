import { AbstractServantState } from "./AbstractServantState.js";

export class ServantLookRightState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "look-right", animation: "turn" });
  }
}
