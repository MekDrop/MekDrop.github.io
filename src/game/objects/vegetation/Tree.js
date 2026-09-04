import { DestructibleVegetation } from "./DestructibleVegetation.js";

export class Tree extends DestructibleVegetation {
  constructor(options) {
    super({ ...options, kind: "tree" });
  }
}
