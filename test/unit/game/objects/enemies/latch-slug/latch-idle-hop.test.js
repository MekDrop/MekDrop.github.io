import assert from "node:assert/strict";
import { it } from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { LatchIdleHop } from "../../../../../../src/game/objects/enemies/latch-slug/LatchIdleHop.js";

const fixture = (random = () => 0) => {
  let starts = 0;
  const owner = {
    entity: new Entity(),
    position: new Vec3(),
    alive: true,
    grounded: true,
    radius: 0.42,
    height: 0.84,
    stateName: "LatchDogState",
    gatewayArrival: { active: false },
    statuses: new Map(),
    affection: { patRemaining: 0 },
    app: {
      systems: {
        rigidbody: {
          gravity: new Vec3(0, -9.81, 0),
          raycastFirst: (from, to) => from.y > to.y ? { normal: Vec3.UP } : null,
        },
      },
    },
    beginIdleHop: () => {
      starts++;

      return true;
    },
  };
  const hop = new LatchIdleHop(owner, random);

  return {
    owner,
    hop,
    starts: () => starts,
  };
};

it("waits a seeded random interval while stationary and resets the wait after actual travel", () => {
  const { owner, hop, starts } = fixture();
  assert.equal(hop.update(2), false);
  assert.equal(hop.update(2), true);
  assert.equal(starts(), 1);
  hop.update(3);
  owner.position.x = 0.2;
  assert.equal(hop.update(1), false);
  assert.equal(hop.update(2), false);
  assert.equal(hop.update(2), true);
  assert.equal(starts(), 2);
  const slow = fixture(() => 0.99);
  assert.equal(slow.hop.update(4), false);
  assert.equal(slow.hop.update(5), true);
});

it("does not queue hops while carried, stunned, airborne, being patted, on stairs or doing door work", () => {
  for (const change of [
    o => {
      o.alive = false;
    },
    o => {
      o.grounded = false;
    },
    o => {
      o.airborne = true;
    },
    o => {
      o.carrier = {};
    },
    o => {
      o.gatewayArrival.active = true;
    },
    o => {
      o.stairCrawl = { active: true };
    },
    o => {
      o.statuses.set("stun", {});
    },
    o => {
      o.statuses.set("confused", {});
    },
    o => {
      o.affection.patRemaining = 1;
    },
    o => {
      o.stateName = "LatchPressState";
    },
    o => {
      o.stateName = "LatchClipState";
    },
  ]) {
    const { owner, hop, starts } = fixture();
    change(owner);
    assert.equal(hop.update(20), false);
    assert.equal(starts(), 0);
  }
});

it("resumes social hops after bonding, but still pauses for pats", () => {
  const { owner, hop, starts } = fixture();
  owner.affection.settling = true;
  assert.equal(hop.update(20), false);
  assert.equal(starts(), 0);
  owner.statuses.set("affection", {});
  assert.equal(hop.update(2), false);
  assert.equal(hop.update(2), true);
  assert.equal(starts(), 1);
  owner.affection.patRemaining = 1;
  assert.equal(hop.update(20), false);
  assert.equal(starts(), 1);
});

it("requires supporting ground and checks headroom across the capsule before jumping", () => {
  const { owner, hop } = fixture();
  assert.equal(hop.clearance, true);
  owner.app.systems.rigidbody.raycastFirst = () => null;
  assert.equal(hop.clearance, false);
  owner.app.systems.rigidbody.raycastFirst = () => ({ normal: Vec3.UP });
  assert.equal(hop.clearance, false, "a ceiling blocks the hop");
  assert.ok(Math.abs(hop.lift ** 2 / (2 * 9.81) - 0.5) < 1e-6);
  assert.ok(hop.flightDuration > 0.6 && hop.flightDuration < 0.7);
});

it("keeps idle hops clear of nearby Bell Bug feet and other living colliders", () => {
  const {owner,hop}=fixture();
  const entity=new Entity();entity.rigidbody={enabled:true};
  const bug={
    entity,
    position:new Vec3(.9,0,0),
    radius:.2541,
    footprintRadius:.45,
    height:.515,
    alive:true,
  };
  owner.actors=[bug];
  assert.equal(hop.clearance,false, 'a close neighbour needs room for the full hop');
  bug.position.x=1.4;
  assert.equal(hop.clearance,true, 'open-space hops remain available');
  bug.position.set(.9,2,0);
  assert.equal(hop.clearance,true, 'another floor does not block a hop');
  bug.position.y=0;bug.alive=false;
  assert.equal(hop.clearance,true);
  bug.alive=true;bug.entity.rigidbody.type="static";
  assert.equal(hop.clearance,true, 'supporting floors and static props use the existing Ammo clearance rays');
});
