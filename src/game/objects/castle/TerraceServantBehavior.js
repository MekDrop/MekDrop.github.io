import { TerraceParticipantStateMachine } from "./TerraceParticipantStateMachine.js";
import { TERRACE_SERVICE } from "../../enum/TerraceService.js";
import { ServantCarryInState } from "./states/terrace/servant/ServantCarryInState.js";
import { ServantCarryOutState } from "./states/terrace/servant/ServantCarryOutState.js";
import { ServantCleanupDelayState } from "./states/terrace/servant/ServantCleanupDelayState.js";
import { ServantExitState } from "./states/terrace/servant/ServantExitState.js";
import { ServantFurnishState } from "./states/terrace/servant/ServantFurnishState.js";
import { ServantOffstageState } from "./states/terrace/servant/ServantOffstageState.js";
import { ServantPackState } from "./states/terrace/servant/ServantPackState.js";
import { ServantPourTeaState } from "./states/terrace/servant/ServantPourTeaState.js";
import { ServantReturnState } from "./states/terrace/servant/ServantReturnState.js";

export class TerraceServantBehavior extends TerraceParticipantStateMachine {
  #requested = false;
  #service = null;
  #deliveries = [];
  #delivery = 0;
  #installed = 0;
  #visitId = 0;

  constructor() {
    super({
      dormantPhase: ServantOffstageState.name,
      states: [
        new ServantOffstageState(),
        new ServantCarryInState(),
        new ServantFurnishState(),
        new ServantPourTeaState(),
        new ServantExitState(),
        new ServantCleanupDelayState(),
        new ServantReturnState(),
        new ServantPackState(),
        new ServantCarryOutState(),
      ],
    });
  }

  get cargo() {
    return this.#deliveries[this.#delivery] ?? null;
  }

  get installedCount() {
    return this.#installed;
  }

  get ready() {
    return this.#deliveries.length > 0 &&
      this.#installed === this.#deliveries.length;
  }

  get fulfilledService() {
    return this.ready ? this.#service : null;
  }

  get visitId() {
    return this.#visitId;
  }

  fulfill(service) {
    if (![TERRACE_SERVICE.SUNBED, TERRACE_SERVICE.TEA].includes(service)) {
      return false;
    }
    this.#requested = true;
    if (this.#service !== service) {
      if (this.active || this.#installed > 0) {
        return false;
      }
      this.#service = service;
      this.#deliveries = service === TERRACE_SERVICE.SUNBED
        ? ["sunbed"] : ["table", "chair", "tea"];
    }
    if (this.active || this.ready) {
      return false;
    }
    this.#visitId += 1;
    this.#delivery = 0;
    this.transition(ServantCarryInState.name);
    return true;
  }

  release() {
    this.#requested = false;
    if (this.active || this.#installed === 0) {
      return false;
    }
    this.#delivery = this.#installed - 1;
    this.transition(ServantCleanupDelayState.name);
    return true;
  }

  nextPhase(phase) {
    switch (phase) {
      case ServantCarryInState.name:
        return ServantFurnishState.name;
      case ServantFurnishState.name:
        this.#installed += 1;
        return this.#service === TERRACE_SERVICE.TEA && this.#delivery === 2
          ? ServantPourTeaState.name : ServantExitState.name;
      case ServantPourTeaState.name:
        return ServantExitState.name;
      case ServantExitState.name:
        if (!this.#requested) {
          this.#delivery = this.#installed - 1;
          return ServantCleanupDelayState.name;
        }
        if (this.#delivery < this.#deliveries.length - 1) {
          this.#delivery += 1;
          return ServantCarryInState.name;
        }
        return ServantOffstageState.name;
      case ServantCleanupDelayState.name:
        return ServantReturnState.name;
      case ServantReturnState.name:
        return ServantPackState.name;
      case ServantPackState.name:
        this.#installed -= 1;
        return ServantCarryOutState.name;
      case ServantCarryOutState.name:
        if (this.#installed > 0) {
          this.#delivery = this.#installed - 1;
          return ServantReturnState.name;
        }
        this.#service = null;
        this.#deliveries = [];
        return ServantOffstageState.name;
      default:
        return phase;
    }
  }

  reset() {
    this.#requested = false;
    this.#service = null;
    this.#deliveries = [];
    this.#delivery = 0;
    this.#installed = 0;
    super.reset();
  }
}
