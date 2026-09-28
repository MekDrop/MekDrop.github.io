import { AbstractServantState } from "./AbstractServantState.js";

export class ServantNoticeState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "notice", animation: "idle" });
  }
}
