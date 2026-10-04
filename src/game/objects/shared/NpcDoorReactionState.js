import { State } from "yuka";

/**
 * Temporary reaction executed inside the NPC's existing task machine.
 */
export class NpcDoorReactionState extends State {
  /**
   * @type {State|null}
   */
  suspendedState = null;
  /**
   * @type {() => void}
   */
  #react;

  /**
   * @param {() => void} react
   */
  constructor(react) {
    super();
    this.#react = react;
  }

  /**
   * @returns {string}
   */
  get phase() { return this.constructor.name; }

  /**
   * @returns {string|null}
   */
  get stagePhase() { return this.suspendedState?.stagePhase ?? null; }

  /**
   * @returns {number}
   */
  get duration() { return this.suspendedState?.duration ?? Infinity; }

  /**
   * @returns {string}
   */
  get action() { return "walk"; }

  /**
   * @returns {string}
   */
  get animation() { return "walk"; }

  execute() { this.#react(); }
}
