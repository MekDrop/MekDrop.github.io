import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { readFileSync } from "node:fs";
import { LatchPeerYield } from "../../../../../../src/game/objects/enemies/latch-slug/LatchPeerYield.js";
import { LatchBridgeApproach } from "../../../../../../src/game/objects/enemies/latch-slug/LatchBridgeApproach.js";

function fixture() {
  const actors = [];
  function actor(x) {
    const owner = {
      pc,
      position: new pc.Vec3(x, 0, 0),
      radius: 0.42,
      alive: true,
      gatewayArrival: { active: false },
      statuses: new Map(),
      stateName: "LatchDogState",
      annoyance: { active: false },
      pack: { canSee: () => true },
      deltaTime: 1 / 60,
      actors,
      runtime: {},
      entity: { rigidbody: { linearVelocity: new pc.Vec3() } },
      clearPeerStep: () => true,
      stop: () => owner.entity.rigidbody.linearVelocity.set(0, owner.entity.rigidbody.linearVelocity.y, 0),
      playClip: clip => {
        owner.clip = clip;
      },
      moveToward: target => {
        owner.destination = target.position.clone();
      },
    };
    owner.peerYield = new LatchPeerYield(owner);
    actors.push(owner);

    return owner;
  }
  const passer = actor(0), settled = actor(0.9);
  passer.annoyance.active = true;
  passer.entity.rigidbody.linearVelocity.set(1, -0.2, 0);

  return {
    passer,
    settled,
  };
}

it("brakes before contact, bumps, observes, steps aside, waits for passage, then returns", () => {
  const { passer, settled } = fixture();
  const home = settled.position.clone();
  passer.peerYield.constrain();
  assert.equal(passer.entity.rigidbody.linearVelocity.x, 0);
  assert.deepEqual(settled.position, home, "a request never pushes or teleports the neighbour");
  assert.equal(passer.clip, "nudge");
  assert.equal(settled.clip, "startled");
  assert.equal(settled.peerYield.attentionTarget, passer);
  settled.peerYield.update(0.4);
  assert.equal(settled.clip, "turn");
  assert.equal(settled.destination, undefined);
  settled.peerYield.update(0.4);
  settled.peerYield.update(0.1);
  assert.equal(settled.clip, "scoot");
  settled.position.copy(settled.destination);
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "wait");
  settled.peerYield.update(3);
  assert.equal(settled.peerYield.phase, "wait", "a paused passer keeps the corridor reserved");
  passer.position.set(2, 0, 0);
  settled.peerYield.update(0.1);
  settled.peerYield.update(0.1);
  assert.deepEqual(settled.destination, home);
  settled.position.copy(home);
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.requester, null);
  assert.equal(passer.peerYield.receiver, null);
});

it("waits without pushing when neither side is free and retries when a side opens", () => {
  const { passer, settled } = fixture();
  settled.clearPeerStep = () => false;
  passer.peerYield.constrain();
  assert.equal(passer.peerYield.receiver, null);
  assert.equal(passer.entity.rigidbody.linearVelocity.x, 0);
  settled.clearPeerStep = point => point.z > 0;
  passer.entity.rigidbody.linearVelocity.x = 1;
  passer.peerYield.constrain();
  assert.equal(passer.peerYield.receiver, settled);
  assert.ok(settled.peerYield.aside.z > 0);
});

it("blocks ordinary shoving, preserves gravity and cancels reservations on interruption", () => {
  const { passer, settled } = fixture();
  passer.annoyance.active = false;
  passer.peerYield.constrain();
  assert.equal(passer.entity.rigidbody.linearVelocity.x, 0);
  assert.equal(passer.entity.rigidbody.linearVelocity.y, -0.2);
  assert.equal(settled.peerYield.requester, null);
  passer.annoyance.active = true;
  passer.entity.rigidbody.linearVelocity.x = 1;
  passer.peerYield.constrain();
  settled.carrier = {};
  settled.peerYield.update(0.1);
  assert.equal(passer.peerYield.receiver, null);
  assert.equal(settled.peerYield.requester, null);
});

it("looks before yielding and waits when its return route becomes occupied", () => {
  const { passer, settled } = fixture();
  passer.peerYield.constrain();
  settled.pack.canSee = () => false;
  settled.peerYield.update(1);
  assert.equal(settled.peerYield.phase, "notice");
  settled.pack.canSee = () => true;
  settled.peerYield.update(0.1);
  settled.peerYield.update(0.1);
  settled.position.copy(settled.destination);
  settled.peerYield.update(0.1);
  passer.position.set(2, 0, 0);
  settled.peerYield.update(0.1);
  settled.clearPeerStep = () => false;
  settled.destination = null;
  settled.peerYield.update(0.1);
  assert.equal(settled.destination, null);
  assert.equal(settled.peerYield.phase, "return");
  settled.clearPeerStep = () => true;
  settled.peerYield.update(0.1);
  assert.deepEqual(settled.destination, settled.peerYield.home);
});

it("a calm unbound bridge traveler requests a verified bank sidestep and keeps passage while the peer moves", () => {
  const { passer, settled } = fixture();
  passer.annoyance.active = false;
  passer.stateName = "LatchBridgeState";
  passer.behavior = {
    currentState: {
      recoveringAge: null,
      spreading: false,
      contactLatch: null,
      bankReturn: null,
    },
  };
  assert.equal(passer.peerYield.available, true);
  passer.peerYield.constrain();
  assert.equal(settled.peerYield.requester, passer);
  assert.equal(passer.peerYield.receiver, settled);
  assert.equal(passer.entity.rigidbody.linearVelocity.y, -0.2);
  settled.peerYield.update(0.8);
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "aside");
  assert.ok(settled.destination);
  settled.position.copy(settled.destination);
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "wait");
  settled.peerYield.update(2);
  assert.equal(settled.peerYield.phase, "wait", "calm cooperative work keeps the passage reserved");
  passer.position.set(2, 0, 0);
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "return");
});

it("physical bridge grips, committed actors and bank recovery cannot be diverted by queue yielding", () => {
  const { passer } = fixture();
  passer.annoyance.active = false;
  passer.stateName = "LatchBridgeState";
  const state = {
    recoveringAge: null,
    spreading: false,
    contactLatch: { point: new pc.Vec3() },
    bankReturn: null,
  };
  passer.behavior = { currentState: state };
  assert.equal(passer.peerYield.available, false);
  passer.peerYield.constrain();
  assert.equal(passer.entity.rigidbody.linearVelocity.x, 1);
  state.contactLatch = null;
  state.spreading = true;
  assert.equal(passer.peerYield.available, false);
  state.spreading = false;
  state.bankReturn = {};
  assert.equal(passer.peerYield.available, false);
});

for (const loserFirst of [false, true]) {
  it(`two simultaneous bridge travelers resolve priority regardless of ${loserFirst ? "loser" : "winner"} update order`, () => {
    const { passer, settled } = fixture();
    for (const [owner, id] of [[passer, "worker-1"], [settled, "worker-2"]]) {
      owner.definition = { id };
      owner.annoyance.active = false;
      owner.stateName = "LatchBridgeState";
      owner.behavior = {
        currentState: {
          recoveringAge: null,
          spreading: false,
          contactLatch: null,
          bankReturn: null,
        },
      };
    }
    settled.entity.rigidbody.linearVelocity.set(-1, -0.2, 0);
    if (loserFirst) {
      settled.peerYield.constrain();
    }
    passer.peerYield.constrain();
    if (!loserFirst) {
      settled.peerYield.constrain();
    }
    assert.equal(passer.peerYield.receiver, settled);
    assert.equal(settled.peerYield.requester, passer);
    settled.peerYield.update(0.8);
    settled.peerYield.update(0.1);
    assert.equal(settled.peerYield.phase, "aside");
    assert.ok(settled.destination);
  });
}

for (const kind of ["committed", "disabled"]) {
  it(`a ${kind} donor proxy cannot invisibly brake a bank traveler`, () => {
    const { passer, settled } = fixture();
    settled.isBridgeCommitted = kind === "committed";
    settled.entity.rigidbody.enabled = kind !== "disabled";
    passer.peerYield.constrain();
    assert.equal(passer.entity.rigidbody.linearVelocity.x, 1);
    assert.equal(passer.entity.rigidbody.linearVelocity.y, -0.2);
    assert.equal(passer.peerYield.receiver, null);
    assert.equal(settled.peerYield.requester, null);
  });
}

it("the actual builder takes passage priority over a lower-id staged worker with a prompt safe sidestep", () => {
  const { passer, settled } = fixture();
  for (const [owner, id, staging] of [[passer, "worker-z", false], [settled, "worker-a", true]]) {
    owner.definition = { id };
    owner.annoyance.active = false;
    owner.stateName = "LatchBridgeState";
    owner.behavior = {
      currentState: {
        assignment: { staging },
        recoveringAge: null,
        spreading: false,
        contactLatch: null,
        bankReturn: null,
      },
    };
  }
  passer.peerYield.constrain();
  assert.equal(settled.peerYield.requester, passer);
  settled.peerYield.update(0.19);
  assert.equal(settled.peerYield.phase, "notice");
  settled.peerYield.update(0.02);
  assert.equal(settled.peerYield.phase, "aside");
});

it("a stage-upgrade corridor change replans the waiting peer onto supported bank grass instead of blocking the builder", () => {
  const { passer, settled } = fixture();
  const map = JSON.parse(readFileSync(new URL("../../../../../../src/game/maps/tests/slime-bridge-span.json", import.meta.url), "utf8"));
  passer.position.set(-4.378, 2, 7.462);
  settled.position.set(-3.506, 2, 6.962);
  for (const [owner, staging] of [[passer, false], [settled, true]]) {
    owner.annoyance.active = false;
    owner.stateName = "LatchBridgeState";
    owner.behavior = {
      currentState: {
        assignment: {
          staging,
          approach: new pc.Vec3(-2.5, 2, 7),
        },
        recoveringAge: null,
        spreading: false,
        contactLatch: null,
        bankReturn: null,
      },
    };
  }
  settled.height = 0.84;
  settled.app = {
    systems: {
      rigidbody: {
        raycastFirst: (from, to) => {
          if (from.y <= to.y) {
            return null;
          }
          const col = Math.round(from.x + (map.cols - 1) / 2);
          const row = Math.round(from.z + (map.rows - 1) / 2);
          const height = map.heightmap[row]?.[col];
          if (!map.grid[row]?.[col] || height > from.y || height < to.y) {
            return null;
          }

          return {
            entity: { rigidbody: { type: "static" } },
            point: new pc.Vec3(from.x, height, from.z),
            normal: pc.Vec3.UP,
          };
        },
      },
    },
  };
  settled.clearPeerStep = (point, peer) => LatchBridgeApproach.clearPeerStep(settled, point, peer);
  passer.peerYield.receiver = settled;
  settled.peerYield.requester = passer;
  settled.peerYield.home = new pc.Vec3(-4.3, 2, 7);
  settled.peerYield.direction = new pc.Vec3(1, 0, 0);
  settled.peerYield.phase = "wait";
  settled.peerYield.bridgePassage = true;
  const before = settled.position.clone();
  const home = settled.peerYield.home.clone();
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "aside");
  assert.deepEqual(settled.position, before, "replanning never relocates the actor");
  assert.deepEqual(settled.peerYield.home, home, "correction preserves the eventual return destination");
  const heading = passer.behavior.currentState.assignment.approach.clone().sub(passer.position).normalize();
  const normal = new pc.Vec3(heading.z, 0, -heading.x);
  assert.ok(Math.abs(settled.peerYield.aside.clone().sub(passer.position).dot(normal)) >= 1.0799);
  settled.peerYield.update(0.1);
  assert.deepEqual(settled.destination, settled.peerYield.aside);
});

it("bridge sidestep arrival tolerance cannot trigger an endless aside-wait replan loop", () => {
  const { passer, settled } = fixture();
  passer.position.set(-4.8, 2, 6.553);
  settled.position.set(-4.8, 2, 7.45);
  for (const [owner, staging] of [[passer, false], [settled, true]]) {
    owner.annoyance.active = false;
    owner.stateName = "LatchBridgeState";
    owner.behavior = {
      currentState: {
        assignment: {
          staging,
          approach: new pc.Vec3(-3.15, 2.031, 7),
        },
        recoveringAge: null,
        spreading: false,
        contactLatch: null,
        bankReturn: null,
      },
    };
  }
  passer.entity.rigidbody.linearVelocity.set(0.869, 0, 0.237);
  passer.peerYield.constrain();
  const aside = settled.peerYield.aside.clone();
  const travel = aside.clone().sub(settled.position).normalize();
  settled.position.copy(aside).sub(travel.mulScalar(0.055));
  settled.peerYield.phase = "aside";
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "wait");
  for (let frame = 0; frame < 10; frame++) {
    settled.peerYield.update(0.1);
    assert.equal(settled.peerYield.phase, "wait", "arrival slack stays safely outside the requested corridor");
  }
});

it("a native peer already outside the bridge corridor releases passage when its final sidestep is blocked", () => {
  const { passer, settled } = fixture();
  passer.annoyance.active = false;
  passer.stateName = "LatchBridgeState";
  passer.behavior = {
    currentState: {
      assignment: { approach: new pc.Vec3(3, 0, 0) },
      recoveringAge: null,
      spreading: false,
    },
  };
  passer.peerYield.constrain();
  assert.equal(passer.peerYield.receiver, settled);
  settled.peerYield.phase = "aside";
  settled.peerYield.bridgePassage = true;
  settled.position.set(0.9, 0, 1.01);
  settled.clearPeerStep = () => false;
  const before = settled.position.clone();
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "wait");
  assert.deepEqual(settled.position, before, "only the real reached clearance admits passage; no pose is changed");
  passer.peerYield.update(0.1);
  assert.equal(passer.peerYield.receiver, settled, "the peer still waits until the original passer has crossed");
  settled.peerYield.update(0.1);
  assert.equal(settled.peerYield.phase, "wait");
});

it("a bridge peer replans an obstructed partial sidestep instead of holding the passer forever", () => {
  const { passer, settled } = fixture();
  passer.annoyance.active = false;
  passer.stateName = "LatchBridgeState";
  passer.behavior = {
    currentState: {
      assignment: { approach: new pc.Vec3(3, 0, 0) },
      recoveringAge: null,
      spreading: false,
    },
  };
  passer.peerYield.constrain();
  const home = settled.peerYield.home.clone();
  settled.peerYield.phase = "aside";
  settled.peerYield.bridgePassage = true;
  settled.peerYield.aside = new pc.Vec3(0.9, 0, -1.1);
  settled.position.z = 0.3;
  settled.clearPeerStep = (point) => point.z > settled.position.z;
  const before = settled.position.clone();
  settled.peerYield.update(2.1);
  assert.equal(settled.peerYield.phase, "aside");
  assert.ok(settled.peerYield.aside.z > 0.3, "the new supported free side replaces the blocked target");
  assert.equal(settled.peerYield.age, 0);
  assert.deepEqual(settled.peerYield.home, home);
  assert.deepEqual(settled.position, before);
});
