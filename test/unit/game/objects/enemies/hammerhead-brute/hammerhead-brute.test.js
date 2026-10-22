import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { State } from "yuka";
import { HammerheadBrute } from "../../../../../../src/game/objects/enemies/hammerhead-brute/HammerheadBrute.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";

function fixture() {
  const actors = [];
  const physics = {
    hits: [],
    raycastAll() {
      return this.hits;
    },
  };
  const options = {
    pc: {
      Entity,
      Vec3,
    },
    app: { systems: { rigidbody: physics } },
    definition: { id: "brute" },
    runtime: { objects: actors },
  };
  const brute = new HammerheadBrute(options);
  brute.entity.rigidbody = {
    linearVelocity: new Vec3(),
    enabled: true,
  };
  const royal = new Enemy({
    ...options,
    definition: { id: "royal" },
  });
  royal.isRoyal = true;
  royal.entity.setPosition(0, 0, -2);
  actors.push(brute, royal);
  const touch = (actor) => {
    physics.hits = [{
      entity: actor.entity,
      point: actor.entity.getPosition().clone(),
    }];
  };

  return {
    brute,
    royal,
    actors,
    physics,
    options,
    touch,
  };
}

test("real Yuka windup/contact/recovery applies one blow, including a large timestep", () => {
  const { brute, royal, touch } = fixture();
  touch(royal);
  assert.ok(brute.behavior.currentState instanceof State);
  brute.update(0.01);
  assert.equal(brute.stateName, "HammerWindupState");
  brute.update(1.16);
  assert.equal(royal.health, 100);
  brute.update(0.7);
  assert.equal(royal.health, 55);
  assert.equal(brute.stateName, "HammerRecoverState");
  brute.update(0.1);
  assert.equal(royal.health, 55);
});

test("ringing is ignored and all carry/launch entry points reject", () => {
  const { brute, royal } = fixture();
  assert.equal(brute.onBellRung({ eventId: "bell" }), false);
  assert.equal(brute.statuses.size, 0);
  assert.equal(brute.canBeCarriedBy(royal), false);
  assert.equal(brute.beginCarry(royal), false);
  assert.equal(brute.launch({ velocity: new Vec3(0, 4, 1) }), false);
  assert.equal(brute.carrier, null);
});

test("external stun interrupts committed contact and death is terminal", () => {
  const { brute, royal, touch } = fixture();
  touch(royal);
  brute.update(0.01);
  brute.applyStatus("stun", { duration: 2 });
  brute.update(0.8);
  assert.equal(brute.stateName, "HammerStunState");
  assert.equal(royal.health, 100);
  brute.update(1.3);
  assert.equal(brute.stateName, "HammerStunRecoverState");
  brute.receiveDamage(1000);
  assert.equal(brute.stateName, "HammerDeathState");
  assert.equal(brute.entity.rigidbody.enabled, false);
  brute.strike();
  assert.equal(royal.health, 100);
  brute.update(3);
  brute.update(3);
  assert.equal(brute.alive, false);
});

test("hammer hits allies once and a nearer wall intercepts the contact fan", () => {
  const { brute, royal, touch, physics } = fixture();
  royal.isRoyal = false;
  touch(royal);
  brute.strike();
  assert.equal(royal.health, 55);
  physics.hits.push({
    entity: new Entity("wall"),
    point: new Vec3(0, 0.9, -0.5),
  });
  brute.strike();
  assert.equal(royal.health, 55);
});

test("only nearby blocking towers divert pursuit; a hit releases and launches occupants", () => {
  const { brute, royal, actors, options, touch } = fixture();
  royal.entity.setPosition(0, 0, -8);
  const tower = new Enemy({
    ...options,
    definition: { id: "tower" },
  });
  tower.isSabotageTower = true;
  tower.entity.setPosition(4, 0, -1);
  actors.push(tower);
  brute.pursue();
  assert.equal(brute.attackTarget, royal);
  tower.entity.setPosition(0, 0, -2);
  brute.pursue();
  assert.equal(brute.attackTarget, tower);
  let released = false;
  let launch = null;
  actors.push({
    occupiedTower: tower,
    releaseTarget: () => {
      released = true;
    },
    launch: (options) => {
      launch = options;
    },
  });
  touch(tower);
  brute.strike();
  assert.equal(tower.health, 55);
  assert.equal(released, true);
  assert.equal(launch.velocity.y, 4);
  assert.equal(launch.thrower, brute);
});

test("three physical door contacts request collision-aware opening; open doors are bypassed", () => {
  const { brute, royal, actors, touch } = fixture();
  royal.entity.setPosition(0, 0, -8);
  const door = {
    entity: new Entity("door"),
    openAmount: 0,
    openTemporarily: () => {},
  };
  door.entity.setPosition(0, 0, -2);
  actors.push({ entranceDoors: [door] });
  brute.pursue();
  assert.equal(brute.attackTarget, door);
  touch(door);
  brute.strike();
  brute.strike();
  assert.equal(door.sequenceOpenAmount, undefined);
  brute.strike();
  assert.equal(door.sequenceOpenAmount, 1);
  door.openAmount = 1;
  brute.pursue();
  assert.equal(brute.attackTarget, royal);
});

test("physical hit interrupts a windup before its damage event", () => {
  const { brute, royal, touch } = fixture();
  touch(royal);
  brute.update(0.01);
  brute.receiveDamage(5, royal);
  assert.equal(brute.stateName, "HammerHitState");
  brute.update(0.36);
  assert.equal(brute.stateName, "HammerPursueState");
  assert.equal(royal.health, 100);
});

test("a pursuing Gremlin is not mistaken for an occupied tower attachment", () => {
  const { brute, actors, options, touch } = fixture();
  const tower = new Enemy({
    ...options,
    definition: { id: "tower" },
  });
  tower.isSabotageTower = true;
  tower.entity.setPosition(0, 0, -2);
  let released = false;
  actors.push(tower, {
    target: tower,
    releaseTarget: () => {
      released = true;
    },
    launch: () => {},
  });
  touch(tower);
  brute.strike();
  assert.equal(released, false);
});
