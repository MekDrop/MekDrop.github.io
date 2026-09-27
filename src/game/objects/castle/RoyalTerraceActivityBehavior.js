import { CASTLE_TERRACE_PHASE as STAGE } from "../../enum/CastleTerracePhase.js";
import { TerraceParticipantStateMachine } from "./TerraceParticipantStateMachine.js";

/**
 * Shared transition mechanics for one castle-owned royal.
 * @abstract
 */
export class RoyalTerraceActivityBehavior extends TerraceParticipantStateMachine {
  #requested = false;
  #phases;
  #onThroneChange;
  #walkSpeed;
  #service;

  constructor({ states, phases, onThroneChange, walkSpeed, service = null }) {
    super({ dormantPhase: phases.throne, states });
    this.#phases = phases;
    this.#onThroneChange = onThroneChange ?? (() => {});
    this.#walkSpeed = walkSpeed;
    this.#service = service;
  }

  get requested() {
    return this.#requested;
  }

  set requested(value) {
    this.#requested = Boolean(value);
    if (this.#requested && this.in(this.#phases.throne)) {
      if (this.#phases.wish) {
        this.transition(this.#phases.wish);
      } else {
        this.#leaveThrone();
      }
      return;
    }
    if (!this.#requested && this.in(this.#phases.wish)) {
      this.transition(this.#phases.throne);
      return;
    }
    if (!this.#requested && this.stagePhase === STAGE.ACTIVITY) {
      this.transition(this.#phases.finish);
    }
  }

  get onThrone() {
    return this.in(this.#phases.throne) ||
      Boolean(this.#phases.wish && this.in(this.#phases.wish));
  }

  get active() {
    return !this.onThrone;
  }

  get wish() {
    return this.#phases.wish && this.in(this.#phases.wish)
      ? this.#service : null;
  }

  get walkSpeed() {
    return this.#walkSpeed;
  }

  fulfillWish(service) {
    if (!this.#requested || !this.#phases.wish ||
      !this.in(this.#phases.wish) || service !== this.#service) {
      return false;
    }
    this.#leaveThrone();
    return true;
  }

  #leaveThrone() {
    this.#onThroneChange(false);
    this.transition(this.#phases.enter);
  }

  nextPhase(phase) {
    switch (phase) {
      case this.#phases.enter:
        return this.#requested ? this.#phases.prepare : this.#phases.return;
      case this.#phases.prepare:
        return this.#requested ? this.#phases.activity : this.#phases.finish;
      case this.#phases.finish:
        return this.#phases.return;
      case this.#phases.return:
        if (this.#requested) {
          return this.#phases.enter;
        }
        this.#onThroneChange(true);
        return this.#phases.throne;
      default:
        return phase;
    }
  }

  resume() {
    const resumed = super.resume();
    if (resumed && !this.#requested && this.stagePhase === STAGE.ACTIVITY) {
      this.transition(this.#phases.finish);
    }
    return resumed;
  }

  reset() {
    this.#requested = false;
    super.reset();
    this.#onThroneChange(true);
  }
}
