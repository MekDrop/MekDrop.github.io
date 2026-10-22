import test from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";
import { State, StateMachine } from "yuka";
import { CrownCrab } from "../../../../../../src/game/objects/enemies/crown-crab/CrownCrab.js";

const actorAt = (x, z, extra = {}) => {
  const entity = new pc.Entity();
  entity.setPosition(x, 0, z);

  return {
    entity,
    alive: true,
    ...extra,
  };
};

const create = () => {
  const objects = [];
  const crab = new CrownCrab({
    pc,
    app: {},
    definition: { id: "crab" },
    runtime: { objects },
  });
  objects.push(crab);
  crab.entity.rigidbody = {
    enabled: true,
    linearVelocity: new pc.Vec3(),
    teleport: () => {},
  };

  return {
    crab,
    objects,
  };
};

test("uses actual Yuka states on the shared machine", () => {
  const { crab } = create();
  assert.ok(crab.behavior instanceof StateMachine);
  assert.ok(crab.behavior.currentState instanceof State);
  assert.equal(crab.stateName, "CrownCrabPursueState");
});

test("frontal armor and rear vulnerability use the root facing", () => {
  const { crab } = create();
  assert.equal(crab.receiveDamage(10, actorAt(0, -2)), 2);
  assert.equal(crab.receiveDamage(10, actorAt(0, 2)), 16);
  assert.equal(crab.receiveDamage(10, actorAt(2, 0)), 10);
  crab.entity.setEulerAngles(0, 180, 0);
  assert.equal(crab.receiveDamage(10, actorAt(0, 2)), 2);
  assert.equal(crab.receiveDamage(10, actorAt(0, -2)), 16);
});

test("unknown and nonphysical sources do not get armor discounts", () => {
  const { crab } = create();
  assert.equal(crab.receiveDamage(10), 10);
  assert.equal(crab.receiveDamage(10, actorAt(0, -2), "fire"), 10);
});

test("projectile damage never creates thrower revenge", () => {
  const { crab } = create();
  crab.receiveDamage(10, actorAt(0, -2), "projectile");
  assert.equal(crab.revengeTarget, null);
});

test("bell source provokes anger without confusion or secondary feedback", () => {
  const { crab } = create();
  const bell = actorAt(2, 0);
  crab.onBellRung({
    eventId: "bell-1",
    source: bell,
  });
  assert.equal(crab.angerTarget, bell);
  assert.equal(crab.stateName, "CrownCrabAngryState");
  assert.equal(crab.statuses.has("confused"), false);
  crab.onBellRung({
    eventId: "bell-2",
    source: actorAt(3, 0),
    secondary: true,
  });
  assert.equal(crab.angerTarget, bell);
  crab.update(0.7);
  assert.equal(crab.stateName, "CrownCrabPursueState");
  crab.onBellRung({
    eventId: "bell-1",
    source: actorAt(4, 0),
  });
  assert.equal(crab.stateName, "CrownCrabPursueState");
});

test("carrying, engine launch and landing retain the actual thrower", () => {
  const { crab } = create();
  const thrower = actorAt(2, 0);
  assert.equal(crab.beginCarry(thrower), true);
  assert.equal(crab.stateName, "CrownCrabCarriedState");
  assert.equal(crab.entity.rigidbody.enabled, false);
  assert.equal(crab.launch({ velocity: new pc.Vec3(1, 4, 0) }), true);
  assert.equal(crab.revengeTarget, thrower);
  assert.equal(crab.stateName, "CrownCrabAirborneState");
  crab.update(0.1);
  assert.deepEqual(crab.entity.rigidbody.linearVelocity, new pc.Vec3(1, 4, 0));
  crab.onLanding();
  assert.equal(crab.stateName, "CrownCrabLandingState");
  crab.update(0.7);
  assert.equal(crab.pursuitTarget, thrower);
  crab.update(0.1);
  assert.equal(crab.requestedAnimation, "revenge_run");
});

test("dead revenge targets release pursuit back to a royal, ignoring towers", () => {
  const { crab, objects } = create();
  const royal = actorAt(0, -6, { beginGameOver: () => {} });
  objects.push(actorAt(0, -1, { isTower: true }), royal);
  crab.revengeTarget = actorAt(2, 0, { alive: false });
  assert.equal(crab.pursuitTarget, royal);
});

test("snap inflicts damage once, after windup, then recovers", () => {
  const { crab } = create();
  let damage = 0;
  const victim = actorAt(0, -1, {
    receiveDamage: (amount) => {
      damage += amount;
    },
  });
  crab.startClaw(victim);
  crab.update(0.4);
  assert.equal(damage, 0);
  crab.update(0.1);
  assert.equal(damage, 18);
  crab.update(0.3);
  assert.equal(damage, 18);
  crab.update(0.4);
  assert.equal(crab.stateName, "CrownCrabPursueState");
});

test("escaping windup avoids the snap", () => {
  const { crab } = create();
  let damage = 0;
  const victim = actorAt(0, -1, {
    receiveDamage: (amount) => {
      damage += amount;
    },
  });
  crab.startClaw(victim);
  victim.entity.setPosition(0, 0, -4);
  crab.update(0.5);
  assert.equal(damage, 0);
});

test("stun interrupts before contact and does not resume a stale attack", () => {
  const { crab } = create();
  let damage = 0;
  crab.startClaw(actorAt(0, -1, {
    receiveDamage: (amount) => {
      damage += amount;
    },
  }));
  crab.applyStatus("stun", { duration: 1 });
  crab.update(0.5);
  assert.equal(crab.stateName, "CrownCrabStunnedState");
  assert.equal(damage, 0);
  crab.update(0.6);
  assert.equal(crab.stateName, "CrownCrabPursueState");
  assert.equal(crab.attackTarget, null);
});

test("a reachable entrance opens through its existing collision-aware API", () => {
  const { crab, objects } = create();
  let opened = 0;
  const door = actorAt(0, -1, {
    exteriorEntrance: true,
    openAmount: 0,
    openTemporarily: (duration) => {
      opened += duration;
    },
  });
  const royal = actorAt(0, -6, { isRoyal: true });
  objects.push(royal, {
    getPointerHit: () => ({
      distance: 0.6,
      door,
    }),
  });
  crab.update(0.1);
  assert.equal(crab.attackTarget, door);
  crab.update(0.5);
  assert.equal(opened, 2);
  assert.equal(crab.resolveRoyalTarget(), royal);
});

test("rivals duel with actual damage and cooldown, then resume the royal approach", () => {
  const { crab, objects } = create();
  const rival = new CrownCrab({
    pc,
    app: {},
    definition: { id: "rival" },
    runtime: { objects },
  });
  rival.entity.setPosition(0, 0, -1);
  objects.push(rival, actorAt(0, -6, { isRoyal: true }));
  crab.update(0.1);
  assert.equal(crab.attackTarget, rival);
  assert.equal(crab.requestedAnimation, "duel");
  crab.update(0.5);
  assert.equal(rival.health, 71.2);
  assert.ok(rival.duelCooldownUntil > rival.elapsed);
  crab.update(0.7);
  assert.equal(crab.findRival(), null);
});

test("death stops attacks and releases the entity after its death interval", () => {
  const { crab } = create();
  let destroyed = 0;
  crab.entity.on("destroy", () => {
    destroyed++;
  });
  crab.receiveDamage(1000);
  assert.equal(crab.alive, false);
  assert.equal(crab.stateName, "CrownCrabDeathState");
  assert.equal(crab.receiveHealing(100), 0);
  crab.update(2);
  assert.equal(destroyed, 1);
  crab.update(2);
  assert.equal(destroyed, 1);
});
