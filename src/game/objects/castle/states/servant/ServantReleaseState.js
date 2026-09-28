import { AbstractServantState } from "./AbstractServantState.js";

export class ServantReleaseState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "release", animation: "closeDoor" });
  }
}
