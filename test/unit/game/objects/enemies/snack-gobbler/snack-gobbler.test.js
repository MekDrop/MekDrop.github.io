import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { State } from "yuka";
import { SnackGobbler } from "../../../../../../src/game/objects/enemies/snack-gobbler/SnackGobbler.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { PitcherOgre } from "../../../../../../src/game/objects/enemies/pitcher-ogre/PitcherOgre.js";

function create(actors = []) {
  return new SnackGobbler({
    pc: {
      Entity,
      Vec3,
    },
    app: {},
    definition: { id: "gobbler" },
    runtime: { objects: actors },
  });
}

function food() {
  return {
    entity: new Entity("food"),
    health: 20,
    alive: true,
    isEnemy: true,
    edibleByGobbler: true,
    receiveDamage(amount) {
      this.health -= amount;
      this.alive = this.health > 0;

      return amount;
    },
  };
}

test("Yuka bite contact consumes once, heals, notifies queue owner and causes sleepiness", () => {
  const victim = food();
  const events = [];
  const observer = { onAllyConsumed: (event) => events.push(event) };
  const gobbler = create([victim, observer]);
  gobbler.health = 30;
  gobbler.update(0.01);
  assert.ok(gobbler.behavior.currentState instanceof State);
  assert.equal(gobbler.stateName, "GobblerBiteState");
  gobbler.update(0.34);
  assert.equal(victim.alive, true);
  gobbler.update(0.1);
  assert.equal(victim.alive, false);
  assert.equal(gobbler.health, 65);
  assert.equal(gobbler.stateName, "GobblerDigestState");
  assert.equal(gobbler.hungry, false);
  assert.equal(gobbler.movementSpeed, 0.109);
  assert.equal(events.length, 1);
  assert.equal(events[0].victim, victim);
  assert.equal(events[0].consumer, gobbler);
  assert.equal(gobbler.consume(victim), false);
  gobbler.update(4.4);
  assert.equal(gobbler.stateName, "GobblerPursueState");
  gobbler.update(14);
  assert.equal(gobbler.hungry, true);
  assert.equal(gobbler.sleepy, false);
});

test("meal eligibility excludes royals, large allies, airborne and carried allies", () => {
  const gobbler = create();
  const victim = food();
  assert.equal(gobbler.canEat(victim), true);
  victim.edibleByGobbler = false;
  assert.equal(gobbler.canEat(victim), false);
  victim.edibleByGobbler = true;
  victim.isRoyal = true;
  assert.equal(gobbler.canEat(victim), false);
  victim.isRoyal = false;
  victim.carrier = {};
  assert.equal(gobbler.canEat(victim), false);
  victim.carrier = null;
  victim.airborne = true;
  assert.equal(gobbler.canEat(victim), false);
});

test("bite rechecks distance at contact and cannot damage an escaping ally", () => {
  const victim = food();
  const gobbler = create([victim]);
  gobbler.update(0.01);
  victim.entity.setPosition(4, 0, 0);
  gobbler.update(0.45);
  assert.equal(victim.health, 20);
  assert.equal(gobbler.health, 100);
});

test("direct and secondary bell ringing cannot confuse or anger Gobbler", () => {
  const gobbler = create();
  assert.equal(gobbler.onBellRung({ eventId: "direct" }), false);
  assert.equal(gobbler.onBellRung({
    eventId: "echo",
    secondary: true,
  }), false);
  assert.equal(gobbler.statuses.size, 0);
  assert.equal(gobbler.stateName, "GobblerPursueState");
});

test("carrier receives bites; launch preserves Ammo velocity and landing angers once", () => {
  const gobbler = create();
  let damage = 0;
  const carrier = {
    entity: new Entity("carrier"),
    receiveDamage: (amount) => {
      damage += amount;
    },
  };
  gobbler.entity.rigidbody = {
    enabled: true,
    linearVelocity: new Vec3(),
    teleport: () => {},
  };
  assert.equal(gobbler.beginCarry(carrier), true);
  gobbler.update(0.6);
  assert.equal(damage, 8);
  assert.equal(gobbler.stateName, "GobblerCarriedState");
  assert.equal(gobbler.launch({ velocity: new Vec3(2, 4, 0) }), true);
  gobbler.update(0.2);
  assert.equal(gobbler.stateName, "GobblerAirborneState");
  assert.deepEqual(gobbler.entity.rigidbody.linearVelocity, new Vec3(2, 4, 0));
  assert.equal(gobbler.onLanding(), true);
  assert.equal(gobbler.onLanding(), false);
  assert.equal(gobbler.stateName, "GobblerAngryState");
  assert.ok(gobbler.angryUntil > gobbler.elapsed);
});

test("external stun interrupts a bite before contact; death prevents a meal", () => {
  const victim = food();
  const gobbler = create([victim]);
  gobbler.update(0.01);
  gobbler.applyStatus("stun", { duration: 1 });
  assert.equal(gobbler.stateName, "GobblerStunnedState");
  gobbler.update(0.4);
  assert.equal(victim.alive, true);
  gobbler.receiveDamage(100);
  assert.equal(gobbler.stateName, "GobblerDeadState");
  assert.equal(gobbler.consume(victim), false);
});

test("pursuit resolves a royal person and ignores towers and castle", () => {
  const royal = {
    entity: new Entity("royal"),
    beginGameOver: () => {},
  };
  royal.entity.setPosition(5, 0, 0);
  const tower = { entity: new Entity("tower") };
  const castle = { entity: new Entity("castle") };
  const gobbler = create([tower, castle, royal]);
  let chased = null;
  gobbler.moveToward = (target) => {
    chased = target;
  };
  gobbler.update(0.1);
  assert.equal(chased, royal);
});

test("eating an actual Pitcher Ogre waiting passenger triggers its anger state", () => {
  const actors = [];
  const options = {
    pc: {
      Entity,
      Vec3,
    },
    app: {},
    definition: { id: "waiting-passenger" },
    runtime: { objects: actors },
  };
  const passenger = new Enemy(options);
  passenger.isWillingToBeThrownBy = () => true;
  passenger.entity.rigidbody = {
    enabled: true,
    linearVelocity: new Vec3(),
  };
  const pitcher = new PitcherOgre(options);
  const gobbler = create(actors);
  actors.push(passenger, pitcher, gobbler);
  assert.equal(pitcher.findPassenger(), passenger);
  assert.equal(gobbler.consume(passenger), true);
  assert.equal(pitcher.stateName, "PitcherAngryState");
  assert.equal(passenger.alive, false);
});

test("live collision rays route around an obstructing wall toward the same royal", () => {
  const gobbler = create();
  const wall = new Entity("wall");
  const royal = { entity: new Entity("royal") };
  royal.entity.setPosition(3, 0, 0);
  gobbler.app.systems = {
    rigidbody: {
      raycastAll: (from, to) => {
        if ((from.x < 1 && to.x >= 1) || (to.x < 1 && from.x >= 1)) {
          const t = (1 - from.x) / (to.x - from.x);
          const z = from.z + (to.z - from.z) * t;

          return Math.abs(z) < 1.3 ? [{ entity: wall }] : [];
        }
        return [];
      },
    },
  };
  let waypoint = null;
  gobbler.moveToward = (target) => {
    waypoint = target.position ?? target.entity.getPosition();

    return true;
  };
  assert.equal(gobbler.navigation.canReach(royal), false);
  assert.equal(gobbler.navigation.pursue(royal), true);
  gobbler.entity.setPosition(waypoint);
  assert.equal(gobbler.navigation.pursue(royal), true);
  assert.notEqual(waypoint.z, 0);
  assert.equal(royal.entity.getPosition().x, 3);
});

test("bite contact cannot consume an ally through an intervening collider", () => {
  const victim = food();
  const gobbler = create([victim]);
  gobbler.app.systems = { rigidbody: { raycastAll: () => [{ entity: new Entity("closed door") }] } };
  assert.equal(gobbler.consume(victim), false);
  assert.equal(victim.alive, true);
});
