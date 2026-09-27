import { TerraceFurnitureActions } from "./TerraceFurnitureActions.js";
import { TerraceTeaSetActions } from "./TerraceTeaSetActions.js";

/**
 * Routes a tea-service wish to furniture and tea-set actions.
 */
export class TerraceTeaActions {
  static get modelUrls() {
    return [
      ...TerraceFurnitureActions.modelUrls,
      ...TerraceTeaSetActions.modelUrls,
    ];
  }

  #furniture;
  #teaSet;

  constructor(options) {
    this.#furniture = new TerraceFurnitureActions(options);
    this.#teaSet = new TerraceTeaSetActions(options);
  }

  get state() {
    return { ...this.#furniture.state, ...this.#teaSet.state };
  }

  sync(servantBehavior, royalBehavior, servant) {
    this.#furniture.sync(servantBehavior, servant);
    this.#teaSet.sync(servantBehavior, royalBehavior, servant);
  }

  destroy() {
    this.#teaSet.destroy();
  }
}
