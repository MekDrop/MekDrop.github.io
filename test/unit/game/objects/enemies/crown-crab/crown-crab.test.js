import test from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";
import { State, StateMachine } from "yuka";
import { CrownCrab } from "../../../../../../src/game/objects/enemies/crown-crab/CrownCrab.js";
import { CrownCrabNavigation } from "../../../../../../src/game/objects/enemies/crown-crab/CrownCrabNavigation.js";
import { CrownCrabObstacleProbe } from "../../../../../../src/game/objects/enemies/crown-crab/CrownCrabObstacleProbe.js";

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

test("royal approach planning preserves live transforms and leaves movement to Ammo", () => {
  const { crab, objects } = create();
  crab.app.systems = { rigidbody: {} };
  crab.deltaTime = 0.1;
  const royal = actorAt(1.6, 0, { isRoyal: true });
  royal.entity.setPosition(1.6, 0.167, 0);
  objects.push({
    entranceDoors: [],
    residence: {
      layout: {
        origin: new pc.Vec3(),
        walkableAreas: [{
          minX:-2,
          maxX:2,
          minZ:-1,
          maxZ:1,
          floorY:0,
        }],
        authoredStairs: [],
        toLocal: (x, z) => ({
          x,
          z,
        }),
        toWorld: (x, z, y) => ({
          x,
          y,
          z,
        }),
      },
      blocksMovementAt: () => false,
    },
  });
  const before = royal.entity.getPosition().clone();
  const navigation = new CrownCrabNavigation(crab);
  const waypoint = navigation.next(royal);
  assert.ok(waypoint.position.x > 0);
  assert.equal(waypoint.position.y, 0);
  assert.deepEqual(navigation.next(royal).position, waypoint.position);
  assert.deepEqual(royal.entity.getPosition(), before);
  assert.equal(crab.position.length(), 0);
  crab.entity.setPosition(-1, 0, 0);
  const afterDisplacement = navigation.next(royal).position;
  assert.ok(afterDisplacement.x > -1 && afterDisplacement.x < -0.8);
  navigation.destroy();
});

test("clearance retains low obstacles and opened kinematic door leaves", () => {
  const savedAmmo = globalThis.Ammo;
  const { crab } = create();
  const probe = new CrownCrabObstacleProbe(crab);
  const root = new pc.Entity();
  root.tags.add("map-object", "Castle");
  const leaf = new pc.Entity();
  leaf.rigidbody = { type: "kinematic" };
  const animation = new pc.Entity();
  animation.anim = { baseLayer: { activeStateProgress: 1 } };
  root.addChild(animation);
  animation.addChild(leaf);
  const contact = {
    getDistance: () => -0.02,
    getPositionWorldOnB: () => ({ y: () => 0.12 }),
    get_m_normalWorldOnB: () => ({
      x: () => 1,
      y: () => 0.7,
      z: () => 0,
    }),
  };
  globalThis.Ammo = {
    wrapPointer: (value) => value,
    castObject: (value) => value,
    getPointer: (value) => value,
  };
  const wrapper = { getCollisionObject: () => ({ entity: leaf }) };
  try {
    probe.floorY = 0;
    probe.contact(contact, wrapper, 0, 0, wrapper);
    assert.equal(probe.blocked, true);
    assert.equal(probe.escape.x, -1);
    probe.blocked = false;
    animation.anim.baseLayer.activeStateProgress = 0;
    probe.contact(contact, wrapper, 0, 0, wrapper);
    assert.equal(probe.blocked, false);
    leaf.rigidbody.type = "static";
    animation.anim = null;
    probe.contact(contact, wrapper, 0, 0, wrapper);
    assert.equal(probe.blocked, true);
    probe.blocked = false;
    contact.getPositionWorldOnB = () => ({ y: () => 0 });
    contact.get_m_normalWorldOnB = () => ({ y: () => 0.984 });
    probe.contact(contact, wrapper, 0, 0, wrapper);
    assert.equal(probe.blocked, false);
  } finally {
    globalThis.Ammo = savedAmmo;
  }
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

test("a throne-occluded royal in range does not stop the approach", () => {
  const { crab, objects } = create();
  const royal = actorAt(0, -0.9, {
    isRoyal: true,
    beginGameOver: () => ({}),
  });
  const wall = new pc.Entity("throne side");
  crab.app.systems = { rigidbody: { raycastAll: () => [{ entity: wall }] } };
  crab.navigation = { next: () => ({ position: new pc.Vec3(-0.3, 0, -1.1) }) };
  objects.push(royal);
  crab.update(0.1);
  assert.equal(crab.stateName, "CrownCrabPursueState");
  assert.ok(crab.entity.rigidbody.linearVelocity.x < 0);
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
  assert.equal(crab.stateName, "CrownCrabRecoverState");
  crab.update(0.4);
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
  crab.navigation = { next: () => ({ position: new pc.Vec3(0, 0, -0.015) }) };
  objects.push(royal, {
    entranceDoors: [{
      getPointerHit: () => ({
        distance: 0.6,
        door,
      }),
    }],
  });
  crab.update(0.1);
  assert.equal(crab.attackTarget, door);
  crab.update(0.65);
  assert.equal(opened, 4);
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
  crab.update(0.65);
  assert.equal(rival.health, 71.2);
  assert.ok(rival.duelCooldownUntil > rival.elapsed);
  crab.update(0.7);
  assert.equal(crab.findRival(), null);
});

test("interior doors on the royal route open without taking damage", () => {
  const { crab, objects } = create();
  let opened = 0;
  const door = actorAt(0, -1, {
    openAmount: 0,
    openTemporarily: () => {
      opened++;
    },
    receiveDamage: () => {
      assert.fail("Door should open through its capability");
    },
  });
  objects.push(actorAt(0, -6, { isRoyal: true }), {
    getPointerHit: () => ({
      distance: 0.5,
      door,
    }),
  });
  crab.update(0.1);
  assert.equal(crab.requestedAnimation, "door_claw");
  crab.update(0.65);
  assert.equal(opened, 1);
});

test("Ammo leaf contacts discover doors when pointer picking misses", () => {
  const { crab, objects } = create();
  let opened = 0;
  const door = actorAt(0, -1, {
    openAmount: 0,
    openTemporarily: () => {
      opened++;
    },
  });
  const leaf = new pc.Entity("leaf");
  door.entity.addChild(leaf);
  crab.app.systems = {
    rigidbody: {
      raycastAll: () => [{
        entity: leaf,
        point: new pc.Vec3(0, 0.5, -1),
      }],
    },
  };
  objects.push(actorAt(0, -6, { isRoyal: true }), { entranceDoors: [door] });
  crab.update(0.1);
  assert.equal(crab.attackTarget, door);
  crab.update(0.65);
  assert.equal(opened, 1);
});

test("royal contact starts its accepted performance once", () => {
  const { crab, objects } = create();
  let accepted = 0;
  let started = 0;
  const royal = actorAt(0, -1, {
    beginGameOver: () => {
      accepted++;

      return {};
    },
    startGameOverPerformance: () => {
      started++;
    },
  });
  assert.equal(crab.applyClawContact(royal), true);
  assert.equal(crab.applyClawContact(royal), false);
  assert.equal(accepted, 1);
  assert.equal(started, 1);
  objects.push(royal);
  crab.entity.rigidbody.linearVelocity.set(1, 0, 1);
  crab.update(0.1);
  assert.equal(crab.requestedAnimation, "idle");
  assert.equal(crab.entity.rigidbody.linearVelocity.length(), 0);
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

test("queue demand bypasses a living enemy ahead without attacking it", () => {
  const { crab, objects } = create();
  const royal = actorAt(0, -6, { isRoyal: true });
  const queued = actorAt(0, -1.5, {
    isEnemy: true,
    enemyType: "Visitor",
    radius: 0.3,
  });
  objects.push(royal, queued);
  crab.update(0.1);
  assert.equal(crab.stateName, "CrownCrabQueueState");
  assert.equal(crab.queueBlocker, queued);
  assert.equal(crab.attackTarget, null);
  crab.update(0.7);
  assert.equal(crab.requestedAnimation, "scuttle_sideways");
  assert.ok(Math.abs(crab.entity.rigidbody.linearVelocity.x) > 0);
  crab.update(8);
  assert.equal(crab.stateName, "CrownCrabPursueState");
});

test("walls occlude claw contact and own colliders do not", () => {
  const { crab } = create();
  let damage = 0;
  const target = actorAt(0, -1, {
    receiveDamage: (n) => {
      damage += n;
    },
  });
  const wall = new pc.Entity();
  crab.app.systems = { rigidbody: { raycastAll: () => [{ entity: crab.entity }, { entity: wall }] } };
  assert.equal(crab.applyClawContact(target), false);
  assert.equal(damage, 0);
  crab.app.systems.rigidbody.raycastAll = () => [{ entity: crab.entity }, { entity: target.entity }];
  assert.equal(crab.applyClawContact(target), true);
  assert.equal(damage, 18);
});

test("knockback uses a body impulse and never assigns a revenge target", () => {
  const { crab } = create();
  const impulses = [];
  crab.entity.rigidbody.applyImpulse = (...values) => impulses.push(values);
  crab.applyStatus("knockback", {
    duration: 0.45,
    impulse: {
      x: 2,
      y: 1,
      z: 0,
    },
  });
  assert.equal(crab.stateName, "CrownCrabKnockbackState");
  assert.deepEqual(impulses, [[2, 1, 0]]);
  assert.equal(crab.revengeTarget, null);
});

test("test clips stay inside the Yuka machine and reject unknown names", () => {
  const { crab } = create();
  assert.equal(crab.testPlayClip("not-a-clip"), false);
  assert.equal(crab.testPlayClip("door_claw"), true);
  crab.update(1);
  assert.equal(crab.stateName, "CrownCrabPlaybackState");
  assert.equal(crab.requestedAnimation, "door_claw");
  crab.resumePursuit();
  assert.equal(crab.stateName, "CrownCrabPursueState");
});
