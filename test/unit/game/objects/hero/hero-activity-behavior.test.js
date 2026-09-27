import assert from "node:assert/strict";
import { it } from "node:test";
import { State } from "yuka";
import { HERO_ANIMATION } from "../../../../../src/game/enum/HeroAnimation.js";
import { HeroActivityBehavior } from "../../../../../src/game/objects/hero/behaviors/action/HeroActivityBehavior.js";
import { HeroBoostingCountryFinancesState } from "../../../../../src/game/objects/hero/states/action/HeroBoostingCountryFinancesState.js";
import { HeroExploringState } from "../../../../../src/game/objects/hero/states/action/HeroExploringState.js";

it("links every hero activity state to an animation", () => {
  const states = [
    new HeroExploringState(),
    new HeroBoostingCountryFinancesState(),
  ];

  for (const state of states) {
    assert.ok(state instanceof State);
    assert.equal(state.action, state.constructor.name);
    assert.equal(state.animation, HERO_ANIMATION.IDLE);
  }
});

it("enters and leaves the country-finance action state", () => {
  const behavior = new HeroActivityBehavior();

  assert.deepEqual(behavior.state, {
    name: HeroExploringState.name,
    action: HeroExploringState.name,
    animation: HERO_ANIMATION.IDLE,
    boostingCountryFinances: false,
  });

  behavior.boostingCountryFinances = true;
  assert.deepEqual(behavior.state, {
    name: HeroBoostingCountryFinancesState.name,
    action: HeroBoostingCountryFinancesState.name,
    animation: HERO_ANIMATION.IDLE,
    boostingCountryFinances: true,
  });

  behavior.boostingCountryFinances = false;
  assert.equal(behavior.state.name, HeroExploringState.name);
});
