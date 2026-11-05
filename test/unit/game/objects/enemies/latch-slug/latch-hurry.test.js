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
    stateName: "LatchSeekState",
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

it("gives a moving slime a short burst near a bell bug and requires full recovery after exhaustion", () => {
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

it("ignores distant, hidden, dead, carried, airborne and disabled bugs and other enemies", () => {
  for (const change of [
    bug => {
      bug.distance = 3.01;
    },
    bug => {
      bug.alive = false;
    },
    bug => {
      bug.carrier = {};
    },
    bug => {
      bug.airborne = true;
    },
    bug => {
      bug.entity = { enabled: false };
    },
    bug => {
      bug.isBellBug = false;
    },
  ]) {
    const { hurry, bug } = fixture();
    change(bug);
    hurry.update(0.5);
    assert.equal(hurry.speedFactor, 1);
    assert.equal(hurry.stamina, 2);
  }
  const { hurry, owner } = fixture();
  owner.pack.canSee = () => false;
  hurry.update(0.5);
  assert.equal(hurry.active, false);
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

it("ends the burst and recovers when clear of bugs, without spending stamina on invalid timesteps", () => {
  const { hurry, bug } = fixture();
  bug.distance = 3;
  hurry.update(0.5);
  assert.equal(hurry.active, true, "the proximity boundary is inclusive");
  bug.distance = 4;
  hurry.update(0.5);
  assert.equal(hurry.active, false);
  assert.equal(hurry.stamina, 1.7);
  for (const dt of [NaN, Infinity, 0, -1]) {
    hurry.update(dt);
  }
  assert.equal(hurry.stamina, 1.7);
});
