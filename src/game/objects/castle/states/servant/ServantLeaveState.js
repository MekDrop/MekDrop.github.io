import { AbstractServantState } from "./AbstractServantState.js";

export class ServantLeaveState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      action: "leave",
      animation: "walk",
      alignmentAnimation: "closeDoor",
    });
  }
}
