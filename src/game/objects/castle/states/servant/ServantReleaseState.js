import { AbstractServantState } from "./AbstractServantState.js";

export class ServantReleaseState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "release", animation: "closeDoor" });
  }
}
