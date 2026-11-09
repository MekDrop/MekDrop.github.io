import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { HeroToolStancePlanner } from "../../../../../../src/game/objects/characters/hero/HeroToolStancePlanner.js";

it("uses fresh support state on every plan and leaves execution state untouched", () => {
  const position = new Vec3(0, 2, 0);
  const surfaceState = { grounded: true };
  const calls = [];
  const state = {
    position,
    facingYaw: 0,
    surfaceState,
    movementSurface: {
      canEscapeAcross: (from, to, current, radius) => {
        calls.push({
          from,
          to,
          current,
          radius,
        });

        return current.grounded;
      },
    },
    canOccupy: () => true,
  };
  const target = new Vec3(0, 2, 0.2);
  const plan = HeroToolStancePlanner.plan(state, target, 0.535, 30, true);
  assert.ok(Math.abs(plan.travel - 0.335) < 1e-6);
  assert.equal(calls[0].from, position);
  assert.equal(calls[0].current, surfaceState);
  assert.equal(calls[0].to.y, 2);
  assert.equal(calls[0].radius, 0.48);
  assert.deepEqual(position, new Vec3(0, 2, 0));
  surfaceState.grounded = false;
  assert.equal(HeroToolStancePlanner.plan(state, target, 0.535, 30, true), false);
});

it("rejects an out-of-range calibrated stance before querying clearance", () => {
  const state = {
    position: new Vec3(),
    facingYaw: 0,
    surfaceState: {},
    movementSurface: { canEscapeAcross: () => assert.fail("unreachable stance") },
    canOccupy: () => assert.fail("unreachable stance"),
  };
  assert.equal(HeroToolStancePlanner.plan(state, new Vec3(0, 0, 3), 1, 180,
    true, false, [{
      yaw: 0,
      context: {},
    }], 1.8), false);
});
