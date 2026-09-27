import { StateMachine } from "yuka";
import { HeroBoostingCountryFinancesState } from "../../states/action/HeroBoostingCountryFinancesState.js";
import { HeroExploringState } from "../../states/action/HeroExploringState.js";

export class HeroActivityBehavior {
  #stateMachine;

  constructor() {
    this.#stateMachine = new StateMachine(this);
    for (const state of [
      new HeroExploringState(),
      new HeroBoostingCountryFinancesState(),
    ]) {
      this.#stateMachine.add(state.constructor.name, state);
    }
    this.#stateMachine.changeTo(HeroExploringState.name);
  }

  get state() {
    const current = this.#stateMachine.currentState;
    return {
      name: current.constructor.name,
      action: current.action,
      animation: current.animation,
      boostingCountryFinances: this.boostingCountryFinances,
    };
  }

  get animation() {
    return this.#stateMachine.currentState.animation;
  }

  get boostingCountryFinances() {
    return this.#stateMachine.in(HeroBoostingCountryFinancesState.name);
  }

  set boostingCountryFinances(value) {
    const state = value
      ? HeroBoostingCountryFinancesState.name
      : HeroExploringState.name;
    if (!this.#stateMachine.in(state)) {
      this.#stateMachine.changeTo(state);
    }
  }
}
