import assert from "node:assert/strict";
import test from "node:test";
import * as pc from "playcanvas";
import { State, StateMachine } from "yuka";
import { MaskShaman } from "../../../../../../src/game/objects/enemies/mask-shaman/MaskShaman.js";

const fixture = () => {
  const actors = [];
  const shaman = new MaskShaman({
    pc,
    app: {},
    definition: { id: "shaman" },
    runtime: { objects: actors },
  });
  const ally = {
    entity: new pc.Entity("rival"),
    isEnemy: true,
    alive: true,
    grudge: "rival target",
  };
  actors.push(shaman, ally);

  return {
    shaman,
    ally,
    actors,
  };
};

test("real Yuka states cast before discipline; suppression preserves grudges and range", () => {
  const { shaman, ally } = fixture();
  assert.ok(shaman.behavior instanceof StateMachine);
  assert.ok(shaman.behavior.currentState instanceof State);
  assert.equal(shaman.auraActive, false);
  shaman.update(0.86);
  assert.equal(shaman.auraActive, true);
  assert.equal(shaman.suppressesGrudgesFor(ally), true);
  assert.equal(ally.grudge, "rival target");
  ally.entity.setPosition(10, 0, 0);
  assert.equal(shaman.suppressesGrudgesFor(ally), false);
  assert.equal(shaman.suppressesGrudgesFor(shaman), false);
  shaman.destroy();
});

test("bell pauses immediately, deduplicates, and requires recovery plus a fresh cast", () => {
  const { shaman, ally } = fixture();
  shaman.update(0.86);
  assert.equal(shaman.onBellRung({
    eventId: 1,
    duration: 1,
  }), true);
  assert.equal(shaman.suppressesGrudgesFor(ally), false);
  assert.equal(shaman.onBellRung({ eventId: 1 }), false);
  assert.equal(shaman.onBellRung({
    eventId: 2,
    secondary: true,
  }), false);
  shaman.update(0.5);
  assert.equal(shaman.requestedClip, "confused_loop");
  shaman.update(0.51);
  assert.equal(shaman.stateName, "ShamanRecoverState");
  assert.equal(shaman.auraActive, false);
  shaman.update(0.61);
  assert.equal(shaman.stateName, "ShamanCastState");
  assert.equal(shaman.auraActive, false);
  shaman.update(0.86);
  assert.equal(shaman.suppressesGrudgesFor(ally), true);
  shaman.destroy();
});

test("overlapping stun and confusion cannot resume concentration early", () => {
  const { shaman } = fixture();
  shaman.update(0.86);
  shaman.applyStatus("stun", { duration: 2 });
  shaman.onBellRung({ duration: 0.5 });
  shaman.update(0.6);
  assert.equal(shaman.requestedClip, "stun_loop");
  assert.equal(shaman.auraActive, false);
  shaman.update(1.5);
  assert.equal(shaman.stateName, "ShamanRecoverState");
  shaman.destroy();
});

test("unwilling carry, Ammo launch velocity and landing preserve confusion and pause discipline", () => {
  const { shaman, ally } = fixture();
  shaman.update(0.86);
  const carrier = { entity: new pc.Entity("carrier") };
  assert.equal(shaman.beginCarry(carrier), true);
  assert.equal(shaman.requestedClip, "carried_struggle");
  assert.equal(shaman.suppressesGrudgesFor(ally), false);
  // A body test double verifies delegation, not physical flight/contact simulation.
  shaman.entity.rigidbody = {
    enabled: false,
    teleport: () => {},
    linearVelocity: new pc.Vec3(),
  };
  assert.equal(shaman.launch({
    velocity: {
      x: 2,
      y: 4,
      z: 1,
    },
  }), true);
  shaman.onBellRung({ duration: 2 });
  shaman.update(0.3);
  assert.deepEqual(shaman.entity.rigidbody.linearVelocity, new pc.Vec3(2, 4, 1));
  assert.equal(shaman.requestedClip, "airborne");
  assert.equal(shaman.onLanding(), true);
  shaman.update(0.1);
  assert.equal(shaman.requestedClip, "confused_loop");
  assert.equal(shaman.onLanding(), false);
  delete shaman.entity.rigidbody;
  shaman.destroy();
});

test("independent auras do not clear each other or mutate a rival's grudge", () => {
  const a = fixture();
  const b = fixture();
  a.shaman.update(0.86);
  b.shaman.update(0.86);
  a.shaman.onBellRung();
  assert.equal(a.shaman.suppressesGrudgesFor(a.ally), false);
  assert.equal(b.shaman.suppressesGrudgesFor(a.ally), true);
  assert.equal(a.ally.grudge, "rival target");
  a.shaman.destroy();
  b.shaman.destroy();
});

test("actual royal capability wins over a nearby tower; staff contacts once per swing", () => {
  const { shaman, actors } = fixture();
  let contacts = 0;
  const tower = {
    entity: new pc.Entity("tower"),
    receiveDamage: () => assert.fail("tower attacked"),
  };
  const royal = {
    entity: new pc.Entity("royal"),
    isRoyal: true,
    receiveDamage: () => contacts++,
  };
  royal.entity.setPosition(0.5, 0, 0);
  actors.push(tower, royal);
  assert.equal(shaman.resolveRoyalTarget(), royal);
  shaman.update(0.86);
  shaman.update(0.01);
  assert.equal(shaman.stateName, "ShamanStaffAttackState");
  shaman.update(0.41);
  shaman.update(0.2);
  assert.equal(contacts, 1);
  shaman.destroy();
});

test("damage cancels an attack contact; death permanently releases suppression", () => {
  const { shaman, actors, ally } = fixture();
  let contacts = 0;
  actors.push({
    entity: new pc.Entity("royal"),
    isRoyal: true,
    receiveDamage: () => contacts++,
  });
  shaman.update(0.86);
  shaman.update(0.01);
  shaman.receiveDamage(1);
  shaman.update(0.41);
  assert.equal(contacts, 0);
  shaman.receiveDamage(999);
  assert.equal(shaman.stateName, "ShamanDeadState");
  assert.equal(shaman.suppressesGrudgesFor(ally), false);
  assert.equal(shaman.receiveHealing(100), 0);
  shaman.update(1.21);
  assert.equal(shaman.alive, false);
});
