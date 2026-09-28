import { AbstractServantState } from "./AbstractServantState.js";

export class ServantWaitState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "wait", animation: "idle" });
  }
}
