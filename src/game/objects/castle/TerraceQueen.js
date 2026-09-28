import queenModelUrl from "../../models/castle/royals/queen.glb?url";
import { TerraceActor } from "./TerraceActor.js";

/**
 * Owns the queen model and her terrace-specific pose entry points.
 */
export class TerraceQueen {
  /**
   *
    * @returns {string}
   */
  static get kind() {
    return "queen";
  }

  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return queenModelUrl;
  }

  /**
   *
    * @type {TerraceActor|null}
   */
  #actor;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   */
  constructor({ pc, modelLibrary }) {

    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: queenModelUrl,
      kind: TerraceQueen.kind,
    });
  }

  /**
   *
    * @returns {import("playcanvas").Entity}
   */
  get entity() {
    return this.#actor.entity;
  }

  /**
   *
    * @returns {number}
   */
  get rightHand() {
    return this.#actor.rightHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get leftHand() {
    return this.#actor.leftHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get head() {
    return this.#actor.head;
  }

  /**
   *
    * @returns {number}
   */
  get height() {
    return this.#actor.height;
  }

  /**
   *
   * @param {string} action
   * @param {number} time
   * @param {number} blend
   */
  pose(action, time = 0, blend = 1) {
    this.#actor.pose(action, time, blend);
  }

  destroy() {
    this.#actor.destroy();
    this.#actor = null;
  }
}
