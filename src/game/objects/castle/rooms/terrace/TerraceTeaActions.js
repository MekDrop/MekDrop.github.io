import { TerraceFurnitureActions } from "./TerraceFurnitureActions.js";
import { TerraceTeaSetActions } from "./TerraceTeaSetActions.js";

/**
 * Routes a tea-service wish to furniture and tea-set actions.
 */
export class TerraceTeaActions {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      ...TerraceFurnitureActions.modelUrls,
      ...TerraceTeaSetActions.modelUrls,
    ];
  }

  /**
   *
    * @type {TerraceFurnitureActions}
   */
  #furniture;
  /**
   *
    * @type {TerraceTeaSetActions}
   */
  #teaSet;

  /**
   *
   * @param {ConstructorParameters<typeof TerraceFurnitureActions>[0]} options
   */
  constructor(options) {
    this.#furniture = new TerraceFurnitureActions(options);
    this.#teaSet = new TerraceTeaSetActions(options);
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").TerraceActivityState}
   */
  get state() {
    return { ...this.#furniture.state, ...this.#teaSet.state };
  }

  /**
   *
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior} servantBehavior
   * @param {number} royalBehavior
   * @param {import("./TerraceActor.js").TerraceActor} servant
   */
  sync(servantBehavior, royalBehavior, servant) {
    this.#furniture.sync(servantBehavior, servant);
    this.#teaSet.sync(servantBehavior, royalBehavior, servant);
  }

  destroy() {
    this.#teaSet.destroy();
  }
}
