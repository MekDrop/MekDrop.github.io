import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { LatchHurry } from "../../../../../../src/game/objects/enemies/latch-slug/LatchHurry.js";

const fixture = () => {
  const bug = {
    isBellBug: true,
    alive: true,
    distance: 2,
  };
  const owner = {
    alive: true,
    annoyance: { active: true },
    stateName: "LatchAnnoyedState",
    entity: { rigidbody: { linearVelocity: new Vec3(0, 0, 0.8) } },
    gatewayArrival: { active: false },
    statuses: new Map(),
    actors: [bug],
    distanceTo: actor => actor.distance,
    pack: { canSee: () => true },
  };

  return {
    owner,
    bug,
    hurry: new LatchHurry(owner),
  };
};

it("gives an annoyed moving slime a short burst and requires full recovery after exhaustion", () => {
  const { hurry } = fixture();
  hurry.update(0.5);
  assert.equal(hurry.speedFactor, 1.8);
  assert.equal(hurry.stamina, 1.5);
  hurry.update(1.5);
  assert.equal(hurry.speedFactor, 1);
  assert.equal(hurry.stamina, 0);
  assert.equal(hurry.exhausted, true);
  hurry.update(2.5);
  assert.equal(hurry.stamina, 1);
  assert.equal(hurry.speedFactor, 1, "nearby bugs cannot restart a depleted burst early");
  hurry.update(2.5);
  assert.equal(hurry.exhausted, false);
  hurry.update(0.1);
  assert.equal(hurry.speedFactor, 1.8);
});

it("does not hurry before annoyance reaches its threshold", () => {
  const { hurry, owner } = fixture();
  owner.annoyance.active = false;
  hurry.update(0.5);
  assert.equal(hurry.active, false);
  assert.equal(hurry.stamina, 2);
});

it("preserves stamina while stationary, stunned, carried, airborne, on stairs or in an action", () => {
  for (const change of [
    owner => {
      owner.entity.rigidbody.linearVelocity.set(0, 0, 0);
    },
    owner => {
      owner.statuses.set("stun", {});
    },
    owner => {
      owner.statuses.set("confused", {});
    },
    owner => {
      owner.carrier = {};
    },
    owner => {
      owner.airborne = true;
    },
    owner => {
      owner.stairCrawl = { active: true };
    },
    owner => {
      owner.gatewayArrival.active = true;
    },
    owner => {
      owner.stateName = "LatchPressState";
    },
    owner => {
      owner.alive = false;
    },
  ]) {
    const { hurry, owner } = fixture();
    change(owner);
    hurry.update(0.5);
    assert.equal(hurry.active, false);
    assert.equal(hurry.stamina, 2);
  }
});

it("ends the burst and recovers when no longer annoyed, without spending stamina on invalid timesteps", () => {
  const { hurry, bug, owner: hurryOwner } = fixture();
  bug.distance = 3;
  hurry.update(0.5);
  assert.equal(hurry.active, true, "the proximity boundary is inclusive");
  hurryOwner.annoyance.active = false;
  hurry.update(0.5);
  assert.equal(hurry.active, false);
  assert.equal(hurry.stamina, 1.7);
  for (const dt of [NaN, Infinity, 0, -1]) {
    hurry.update(dt);
  }
  assert.equal(hurry.stamina, 1.7);
});
