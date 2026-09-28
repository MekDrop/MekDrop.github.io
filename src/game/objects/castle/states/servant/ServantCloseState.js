import { AbstractServantState } from "./AbstractServantState.js";

export class ServantCloseState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "close", animation: "closeDoor" });
  }
}
