import { AbstractServantState } from "./AbstractServantState.js";

export class ServantLookLeftState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "look-left", animation: "turn" });
  }
}
