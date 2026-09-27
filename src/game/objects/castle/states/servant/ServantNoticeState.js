import { AbstractServantState } from "./AbstractServantState.js";

export class ServantNoticeState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "notice", animation: "idle" });
  }
}
