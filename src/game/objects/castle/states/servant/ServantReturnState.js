import { AbstractServantState } from "./AbstractServantState.js";

export class ServantReturnState extends AbstractServantState {
  constructor(options) {
    super({
      ...options,
      action: "return",
      animation: "walk",
      alignmentAnimation: "closeDoor",
    });
  }
}
