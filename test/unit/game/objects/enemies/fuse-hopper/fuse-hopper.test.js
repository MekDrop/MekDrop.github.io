import { test } from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";
import { State } from "yuka";
import { FuseHopper } from "../../../../../../src/game/objects/enemies/fuse-hopper/FuseHopper.js";

const make = () => {
  const actors = [];
  const hopper = new FuseHopper({
    pc,
    app: { root: { findComponent: () => null } },
    definition: { id: "hopper" },
    runtime: { objects: actors },
  });
  actors.push(hopper);

  return {
    hopper,
    actors,
  };
};

test("real Yuka states pursue royal and ignore tower goals", () => {
  const { hopper, actors } = make();
  const royal = {
    isRoyal: true,
    entity: new pc.Entity(),
  };
  royal.entity.setPosition(5, 0, 0);
  actors.push({
    isTower: true,
    entity: new pc.Entity(),
  }, royal);
  assert.ok(hopper.behavior.currentState instanceof State);
  assert.equal(hopper.resolveRoyalTarget(), royal);
  let target;
  hopper.moveToward = (actor) => {
    target = actor;
  };
  hopper.update(0.1);
  assert.equal(target, royal);
});

test("fuse continues across carry, throw, landing and bell stop", () => {
  const { hopper } = make();
  hopper.entity.rigidbody = {
    enabled: true,
    linearVelocity: new pc.Vec3(),
    teleport: () => {},
  };
  hopper.ignite();
  const carrier = { entity: new pc.Entity() };
  assert.equal(hopper.beginCarry(carrier), true);
  hopper.update(0.2);
  assert.ok(Math.abs(hopper.fuseRemaining - 0.9) < 1e-8);
  assert.equal(hopper.launch({ velocity: new pc.Vec3(1, 3, 0) }), true);
  hopper.update(0.2);
  hopper.onLanding();
  hopper.onBellRung({ eventId: "one" });
  hopper.update(0.2);
  assert.ok(Math.abs(hopper.fuseRemaining - 0.5) < 1e-8);
  assert.equal(hopper.stateName, "FuseStoppedState");
  hopper.update(0.51);
  assert.equal(hopper.exploded, true);
  assert.equal(hopper.alive, false);
});

test("fire shortens the fuse and repeated ignition cannot extend it", () => {
  const { hopper } = make();
  hopper.receiveDamage(1, null, "fire");
  assert.equal(hopper.fuseRemaining, 0.45);
  hopper.ignite(1.1);
  assert.equal(hopper.fuseRemaining, 0.45);
  hopper.update(0.46);
  assert.equal(hopper.exploded, true);
});

test("blast damages allies once and triggers actual royal lifecycle", () => {
  const { hopper, actors } = make();
  let damage = 0;
  let gameOvers = 0;
  actors.push({
    entity: new pc.Entity(),
    receiveDamage: (amount) => {
      damage += amount;
    },
  });
  actors.push({
    entity: new pc.Entity(),
    beginGameOver: () => {
      gameOvers++;
    },
  });
  const far = new pc.Entity();
  far.setPosition(10, 0, 0);
  actors.push({
    entity: far,
    receiveDamage: () => assert.fail("outside blast"),
  });
  assert.equal(hopper.detonate(), true);
  assert.equal(hopper.detonate(), false);
  assert.equal(damage, 48);
  assert.equal(gameOvers, 1);
  assert.equal(hopper.receiveHealing(100), 0);
});

test("death disarms an active fuse and never explodes later", () => {
  const { hopper } = make();
  hopper.ignite();
  hopper.receiveDamage(100);
  hopper.update(0.2);
  assert.equal(hopper.stateName, "FuseTerminalState");
  assert.equal(hopper.exploded, false);
});

test("door detection uses real door ray hit and accepted opening pose", () => {
  const { hopper, actors } = make();
  const royal = {
    isRoyal: true,
    entity: new pc.Entity(),
  };
  royal.entity.setPosition(4, 0, 0);
  const door = {
    openAmount: 0,
    getHit: () => ({ distance: 0.5 }),
  };
  actors.push({ entranceDoors: [door] }, royal);
  assert.equal(hopper.closedDoorAhead(royal), true);
  hopper.update(0.01);
  assert.equal(hopper.stateName, "FuseWarningState");
  door.openAmount = 1;
  assert.equal(hopper.closedDoorAhead(royal), false);
});
