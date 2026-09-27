import { AbstractServantState } from "./AbstractServantState.js";

export class ServantLookLeftState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "look-left", animation: "turn" });
  }
}
