import { AbstractServantState } from "./AbstractServantState.js";

export class ServantGraspState extends AbstractServantState {
  constructor(options) {
    super({ ...options, action: "grasp", animation: "closeDoor" });
  }
}
