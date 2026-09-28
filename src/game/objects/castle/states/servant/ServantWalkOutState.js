import { AbstractServantState } from "./AbstractServantState.js";

export class ServantWalkOutState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "walk-out", animation: "walk" });
  }
}
