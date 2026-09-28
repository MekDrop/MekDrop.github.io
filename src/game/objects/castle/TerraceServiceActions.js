import { TerraceServantActions } from "./TerraceServantActions.js";
import { TerraceSunbedActions } from "./TerraceSunbedActions.js";
import { TerraceTeaActions } from "./TerraceTeaActions.js";

const EMPTY_STATE = Object.freeze({
  trayVisible: false,
  tableGripDistance: null,
  bookOpenAmount: null,
  potHandDistance: null,
  cupLipDistance: null,
  cupLipClearance: null,
  saucerVisible: false,
});

/**
 * Routes servant and furnishing states to the matching service actions.
 */
export class TerraceServiceActions {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      ...TerraceServantActions.modelUrls,
      ...TerraceSunbedActions.modelUrls,
      ...TerraceTeaActions.modelUrls,
    ];
  }

  /**
   *
    * @type {TerraceServantActions}
   */
  #servant;
  /**
   *
    * @type {TerraceSunbedActions|TerraceTeaActions}
   */
  #service;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, stage: import("playcanvas").Entity, kind: string, royal: import("./TerraceQueen.js").TerraceQueen|import("./TerracePrincess.js").TerracePrincess}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Entity} options.stage
   * @param {string} options.kind
   * @param {import("./TerraceQueen.js").TerraceQueen|import("./TerracePrincess.js").TerracePrincess} options.royal
   */
  constructor({ pc, modelLibrary, stage, kind, royal }) {
    this.#servant = new TerraceServantActions({ pc, modelLibrary, stage });
    this.#service = kind === "queen"
      ? new TerraceSunbedActions({ pc, modelLibrary, stage, royal })
      : new TerraceTeaActions({ pc, modelLibrary, stage, royal });
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").TerraceActivityState}
   */
  get state() {
    return { ...EMPTY_STATE, ...this.#service.state };
  }

  /**
   *
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior} servantBehavior
   * @param {import("./RoyalTerraceActivityBehavior.js").RoyalTerraceActivityBehavior} royalBehavior
   */
  sync(servantBehavior, royalBehavior) {
    this.#servant.sync(servantBehavior);
    this.#service.sync(
      servantBehavior,
      royalBehavior,
      this.#servant.actor,
    );
  }

  destroy() {
    this.#service.destroy?.();
    this.#servant.destroy();
  }
}
