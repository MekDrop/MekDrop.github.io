import { AbstractServantState } from "./AbstractServantState.js";

export class ServantLeaveState extends AbstractServantState {
  constructor(options) {
    super({
      ...options,
      action: "leave",
      animation: "walk",
      alignmentAnimation: "closeDoor",
    });
  }
}
