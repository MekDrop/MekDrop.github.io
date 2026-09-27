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
  static get modelUrls() {
    return [
      ...TerraceServantActions.modelUrls,
      ...TerraceSunbedActions.modelUrls,
      ...TerraceTeaActions.modelUrls,
    ];
  }

  #servant;
  #service;

  constructor({ pc, modelLibrary, stage, kind, royal }) {
    this.#servant = new TerraceServantActions({ pc, modelLibrary, stage });
    this.#service = kind === "queen"
      ? new TerraceSunbedActions({ pc, modelLibrary, stage, royal })
      : new TerraceTeaActions({ pc, modelLibrary, stage, royal });
  }

  get state() {
    return { ...EMPTY_STATE, ...this.#service.state };
  }

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
