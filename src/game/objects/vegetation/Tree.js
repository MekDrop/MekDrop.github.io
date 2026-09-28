import { DestructibleVegetation } from "./DestructibleVegetation.js";

export class Tree extends DestructibleVegetation {
  /**
   *
   * @param {ConstructorParameters<typeof DestructibleVegetation>[0]} options
   */
  constructor(options) {
    super({ ...options, kind: "tree" });
  }
}
