import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { DirectionalShadowBudget } from "../../../../src/game/rendering/DirectionalShadowBudget.js";

/**
 * Records requests passed through LightComponent to the renderer.
 * @returns {{light: {shadowUpdateMode: number}, requests: number[], budget: DirectionalShadowBudget}}
 */
function fixture() {
  let cachedMode = pc.SHADOWUPDATE_REALTIME;
  const requests = [];
  const light = {
    get shadowUpdateMode() {
      return cachedMode;
    },
    set shadowUpdateMode(mode) {
      cachedMode = mode;
      if (mode === pc.SHADOWUPDATE_THISFRAME) {
        requests.push(mode);
      }
    },
  };

  return {
    light,
    requests,
    budget: new DirectionalShadowBudget(pc, light),
  };
}

it("refreshes immediately on entry and continues requesting shadow updates", () => {
  const { budget, requests } = fixture();
  budget.limited = true;
  assert.equal(requests.length, 1);
  for (let frame = 0; frame < 60; frame += 1) {
    budget.update(1 / 60);
  }
  assert.equal(requests.length, 16);
});

it("restores realtime shadows when returning to the isometric camera", () => {
  const { budget, light, requests } = fixture();
  budget.limited = true;
  for (let frame = 0; frame < 4; frame += 1) {
    budget.update(1 / 60);
  }
  budget.limited = false;
  budget.update(1);
  assert.equal(light.shadowUpdateMode, pc.SHADOWUPDATE_REALTIME);
  assert.equal(requests.length, 2);
});

it("requests one refresh after a delayed frame without a catch-up burst", () => {
  const { budget, requests } = fixture();
  budget.limited = true;
  budget.update(-1);
  assert.equal(requests.length, 1);
  budget.update(0.5);
  budget.update(0);
  budget.update(0);
  assert.equal(requests.length, 2);
  budget.update(0);
  assert.equal(requests.length, 2);
});

it("keeps reusing shadows when the game runs below the refresh frequency", () => {
  const { budget, requests } = fixture();
  budget.limited = true;
  for (let frame = 0; frame < 8; frame += 1) {
    budget.update(1 / 8);
    assert.equal(requests.length, 1 + Math.floor((frame + 1) / 4));
  }
});
