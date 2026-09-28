import { DestructibleVegetation } from "./DestructibleVegetation.js";

export class Bush extends DestructibleVegetation {
  /**
   *
   * @param {ConstructorParameters<typeof DestructibleVegetation>[0]} options
   */
  constructor(options) {
    super({ ...options, kind: "bush" });
  }
}
