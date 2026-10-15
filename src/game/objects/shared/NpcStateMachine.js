import { StateMachine } from "yuka";
import { NpcIdleState } from "./NpcIdleState.js";
import { NpcDoorReactionState } from "./NpcDoorReactionState.js";

/**
 * Adds resumable reactions to Yuka without restarting the suspended task.
 */
export class NpcStateMachine extends StateMachine {
  /**
   * @type {import("yuka").State|null}
   */
  #savedPrevious = null;
  /**
   * @type {boolean}
   */
  #reactionTransition = false;
  /**
   * @type {boolean}
   */
  #resumingReaction = false;

  /**
   * @param {import("yuka").GameEntity|null} owner
   */
  constructor(owner = null) {
    super(owner);

    this.add(NpcIdleState.name, new NpcIdleState());
    this.changeTo(NpcIdleState.name);
  }

  /**
   * @returns {boolean}
   */
  get reacting() { return this.currentState instanceof NpcDoorReactionState; }

  get reactionTransition() { return this.#reactionTransition; }

  get resumingReaction() { return this.#resumingReaction; }

  /**
   * @returns {import("yuka").State|null}
   */
  get taskState() {
    const state = this.reacting ? this.currentState.suspendedState : this.currentState;
    return state instanceof NpcIdleState ? null : state;
  }

  /**
   * @param {NpcDoorReactionState} state
   * @returns {boolean}
   */
  interruptReaction(state) {
    if (this.reacting) { return this.currentState === state; }
    this.add(state.constructor.name, state);
    state.suspendedState = this.currentState;
    this.#savedPrevious = this.previousState;
    this.#reactionTransition = true;
    try {
      // Yuka records currentState in previousState before entering the reaction.
      super.changeTo(state.constructor.name);
    } finally { this.#reactionTransition = false; }
    return true;
  }

  /**
   * @param {NpcDoorReactionState} state
   * @returns {boolean}
   */
  resumeReaction(state) {
    if (this.currentState !== state) { return false; }
    this.#resumingReaction = true;
    try {
      super.revert();
      // Preserve any previous task transition or nested interruption as well.
      this.previousState = this.#savedPrevious;
    } finally { this.#resumingReaction = false; }
    this.#savedPrevious = null;
    state.suspendedState = null;
    return true;
  }

  /**
   * An explicit task change cancels the reaction instead of resuming stale work.
   * @param {string} id
   * @returns {NpcStateMachine}
   */
  changeTo(id) {
    const reaction = this.reacting ? this.currentState : null;
    const suspended = reaction?.suspendedState;
    suspended?.exit(this.owner);
    super.changeTo(id);
    if (reaction) {
      this.previousState = suspended;
      reaction.suspendedState = null;
      this.#savedPrevious = null;
    }
    return this;
  }

  update() {
    // Reaction movement runs at prerender, after authored scene placement.
    if (this.reacting) { return this; }
    return super.update();
  }
}
