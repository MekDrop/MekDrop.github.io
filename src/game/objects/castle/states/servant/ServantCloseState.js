import { AbstractServantState } from "./AbstractServantState.js";

export class ServantCloseState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "close", animation: "closeDoor" });
  }
}
