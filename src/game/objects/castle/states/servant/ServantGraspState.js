import { AbstractServantState } from "./AbstractServantState.js";

export class ServantGraspState extends AbstractServantState {
  /**
   *
   * @param {ConstructorParameters<typeof AbstractServantState>[0]} options
   */
  constructor(options) {
    super({ ...options, action: "grasp", animation: "closeDoor" });
  }
}
