import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { LatchPeerYield } from "../../../../../../src/game/objects/enemies/latch-slug/LatchPeerYield.js";

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
      stop: () => owner.entity.rigidbody.linearVelocity.set(0, 0, 0),
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
