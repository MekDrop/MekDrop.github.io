import { AbstractServantState } from "./AbstractServantState.js";

export class ServantWaitState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "wait", animation: "idle" });
  }
}
