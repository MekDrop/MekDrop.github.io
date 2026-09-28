import { AbstractServantState } from "./AbstractServantState.js";

export class ServantLookRightState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "look-right", animation: "turn" });
  }
}
