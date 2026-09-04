import { DestructibleVegetation } from "./DestructibleVegetation.js";

export class Bush extends DestructibleVegetation {
  constructor(options) {
    super({ ...options, kind: "bush" });
  }
}
