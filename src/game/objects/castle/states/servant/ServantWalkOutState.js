import { AbstractServantState } from "./AbstractServantState.js";

export class ServantWalkOutState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "walk-out", animation: "walk" });
  }
}
