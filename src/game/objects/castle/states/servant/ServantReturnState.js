import { AbstractServantState } from "./AbstractServantState.js";

export class ServantReturnState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      action: "return",
      animation: "walk",
      alignmentAnimation: "closeDoor",
    });
  }
}
