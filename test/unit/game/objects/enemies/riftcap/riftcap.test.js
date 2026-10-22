import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3, EventHandler } from "playcanvas";
import { State } from "yuka";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { Riftcap } from "../../../../../../src/game/objects/enemies/riftcap/Riftcap.js";
import { RiftcapTimeBubble } from "../../../../../../src/game/objects/enemies/riftcap/RiftcapTimeBubble.js";
import { RiftcapTimeLease } from "../../../../../../src/game/objects/enemies/riftcap/RiftcapTimeLease.js";
import { RiftcapStoneWard } from "../../../../../../src/game/objects/enemies/riftcap/RiftcapStoneWard.js";
import { RiftcapCubeBolt } from "../../../../../../src/game/objects/enemies/riftcap/RiftcapCubeBolt.js";
import { FrostPuffShot } from "../../../../../../src/game/objects/enemies/frost-puff/FrostPuffShot.js";

test("Frost Puff private projectile clock survives overlapping bubbles, suspension and release", () => {
  const { owner, royal } = setup();
  let chilled = 0;
  owner.combat = { chill: () => chilled++ };
  const shot = new FrostPuffShot(owner, royal);
  owner.shots.add(shot);
  const fast = {}, slow = {};
  const lease = RiftcapTimeLease.acquire(shot, fast, 0.5);
  RiftcapTimeLease.acquire(shot, slow, 0.25);
  assert.equal(shot.entity.rigidbody.linearVelocity.length(), 1.5);
  owner.app.fire("update", 1);
  assert.equal(shot.remaining, 1.75);
  lease.release(fast);
  assert.equal(shot.localTimeScale, 0.25);
  const pause = {};
  RiftcapTimeLease.acquire(shot, pause, 0);
  owner.app.fire("update", 10);
  assert.equal(shot.remaining, 1.75);
  assert.equal(shot.entity.rigidbody.linearVelocity.length(), 0);
  lease.release(slow);
  lease.release(pause);
  assert.equal(shot.entity.rigidbody.linearVelocity.length(), 6);
  shot.entity.collision.fire("collisionstart", { other: royal.entity });
  assert.equal(chilled, 1);
  assert.equal(owner.shots.size, 0);
});

class PhysicsEntity extends Entity {
  addComponent(type, options) {
    if (type === "render") {
      this.render = { meshInstances: [{}] };
    } else if (type === "collision") {
      this.collision = new EventHandler();
    } else if (type === "rigidbody") {
      this.rigidbody = body(this, options.mass);
      this.rigidbody.type = options.type;
    }
  }
}

class Material {
  diffuse = { set: () => {} };
  emissive = { set: () => {} };
  update() {}
  destroy() {}
}

function body(entity, mass = 1) {
  return {
    enabled: true,
    type: "dynamic",
    mass,
    linearVelocity: new Vec3(),
    teleport: (position) => entity.setPosition(position),
    applyImpulse(impulse) {
      this.lastImpulse = impulse.clone();
    },
    applyForce: () => {},
  };
}

function setup() {
  const objects = [];
  const app = new EventHandler();
  app.root = new Entity("root");
  app.systems = {
    rigidbody: {
      raycastAll: () => [],
      gravity: new Vec3(0, -9.81, 0),
    },
  };
  const pc = {
    Entity: PhysicsEntity,
    Vec3,
    StandardMaterial: Material,
  };
  const owner = new Riftcap({
    pc,
    app,
    definition: { id: "riftcap" },
    runtime: { objects },
  });
  owner.entity.rigidbody = body(owner.entity);
  objects.push(owner);
  const ally = new Enemy({
    pc,
    app,
    definition: { id: "ally" },
    runtime: { objects },
  });
  ally.entity.setPosition(2, 0, 0);
  ally.entity.rigidbody = body(ally.entity);
  objects.push(ally);
  const royal = {
    definition: { id: "royal" },
    entity: new Entity("royal"),
    beginGameOver() {
      this.reached = true;
    },
  };
  royal.entity.setPosition(5, 0, 0);
  objects.push(royal);

  return {
    owner,
    ally,
    royal,
    objects,
    app,
  };
}

test("all six spells apply real outcomes through Yuka contact phases", () => {
  const { owner, ally, royal } = setup();
  ally.receiveDamage(40);
  owner.testCast("heal", "ally");
  assert.ok(owner.behavior.currentState instanceof State);
  owner.update(0.44);
  assert.equal(ally.health, 60);
  owner.update(0.02);
  assert.equal(owner.clip, "heal_loop");
  owner.update(0.5);
  assert.equal(ally.health, 67);

  owner.testCast("ward", "ally");
  owner.update(0.5);
  assert.equal(ally.receiveDamage(45), 5);
  assert.equal(ally.health, 62);

  const previous = owner.position.clone();
  owner.testCast("swap", "ally");
  owner.update(0.5);
  assert.equal(owner.position.x, 2);
  assert.deepEqual(ally.position.toArray(), previous.toArray());
  assert.equal(ally.statuses.has("annoyed"), true);

  owner.testCast("shatter");
  owner.update(0.5);
  assert.ok(ally.entity.rigidbody.lastImpulse.x < 0);
  assert.equal(ally.statuses.has("knockback"), true);

  owner.testCast("time_bubble");
  owner.update(0.5);
  assert.ok(owner.spells.bubble);
  const before = ally.elapsed;
  ally.update(1);
  assert.ok(Math.abs(ally.elapsed - before - 0.3) < 1e-10);
  owner.onBellRung({ eventId: "bell" });
  assert.equal(owner.spells.bubble, null);

  owner.update(3);
  owner.update(0.5);
  owner.testCast("bolt", "royal");
  owner.update(0.5);
  assert.equal(owner.shots.size, 1);
  const shot = [...owner.shots][0];
  shot.entity.collision.fire("collisionstart", { other: royal.entity });
  assert.equal(royal.reached, true);
  assert.equal(owner.shots.size, 0);
  owner.destroy();
});

test("swap fails closed for closed gate, missing actor, occupied landing and elevation", () => {
  const { owner, ally, app, objects } = setup();
  const gate = new Entity("closed gate");
  app.systems.rigidbody.raycastAll = () => [{
    entity: gate,
    hitFraction: 0.5,
  }];
  assert.equal(owner.spells.swap(ally), false);
  assert.equal(owner.position.x, 0);
  assert.equal(ally.position.x, 2);
  assert.equal(owner.spells.swap(null), false);
  app.systems.rigidbody.raycastAll = () => [];
  ally.entity.setPosition(2, 1, 0);
  assert.equal(owner.spells.swap(ally), false);
  ally.entity.setPosition(2, 0, 0);
  const occupant = {
    isCreature: true,
    entity: new Entity("occupant"),
  };
  occupant.entity.setPosition(2.1, 0, 0);
  objects.push(occupant);
  assert.equal(owner.spells.swap(ally), false);
  objects.pop();
  assert.equal(owner.spells.swap(ally), true);
});

test("mending affects only living visible allies and clamps at maximum health", () => {
  const { owner, ally, app, objects } = setup();
  ally.receiveDamage(5);
  const defender = new Enemy({
    pc: owner.pc,
    app,
    definition: { id: "defender" },
  });
  defender.isEnemy = false;
  defender.receiveDamage(30);
  objects.push(defender);
  assert.equal(owner.spells.heal(1), 5);
  assert.equal(ally.health, 100);
  assert.equal(defender.health, 70);
  ally.receiveDamage(10);
  app.systems.rigidbody.raycastAll = () => [{
    entity: new Entity("wall"),
    hitFraction: 0.5,
  }];
  assert.equal(owner.spells.heal(1), 0);
  ally.receiveDamage(1000);
  app.systems.rigidbody.raycastAll = () => [];
  assert.equal(owner.spells.heal(1), 0);
});

test("ward expires, absorbs finite damage, refreshes without stacking and restores method", () => {
  const { ally } = setup();
  const original = ally.receiveDamage;
  const first = new RiftcapStoneWard(ally, 1, 20);
  assert.equal(ally.receiveDamage(8), 0);
  assert.equal(first.capacity, 12);
  const replacement = new RiftcapStoneWard(ally, 1, 10);
  assert.equal(first.expired, true);
  assert.equal(ally.receiveDamage(15), 5);
  assert.equal(replacement.expired, true);
  assert.equal(ally.receiveDamage, original);
  const expiring = new RiftcapStoneWard(ally, 0.5, 20);
  expiring.update(0.5);
  assert.equal(ally.receiveDamage(8), 8);
  assert.equal(ally.receiveDamage(NaN), 0);
});

test("shatter pushes both factions using impulses, respects walls and ignores static scenery", () => {
  const { owner, ally, objects, app } = setup();
  const defender = {
    isDefender: true,
    entity: new Entity("defender"),
  };
  defender.entity.setPosition(-1, 0, 0);
  defender.entity.rigidbody = body(defender.entity, 2);
  objects.push(defender);
  const wall = { entity: new Entity("wall") };
  wall.entity.setPosition(1, 0, 1);
  wall.entity.rigidbody = body(wall.entity);
  wall.entity.rigidbody.type = "static";
  objects.push(wall);
  ally.onStatusApplied = () => {
    ally.entity.rigidbody.lastImpulse = null;
    ally.stop();
  };
  assert.equal(owner.spells.shatter(), 2);
  assert.ok(ally.entity.rigidbody.lastImpulse.x > 0);
  assert.ok(defender.entity.rigidbody.lastImpulse.x < 0);
  assert.equal(wall.entity.rigidbody.lastImpulse, undefined);
  app.systems.rigidbody.raycastAll = () => [{
    entity: wall.entity,
    hitFraction: 0.5,
  }];
  assert.equal(owner.spells.shatter(), 0);
});

test("time bubble restores crossing actors, excludes caster, scales timers and animation", () => {
  const { owner, ally } = setup();
  const animation = { speed: 2 };
  ally.entity.findComponents = () => [animation];
  ally.entity.rigidbody.linearVelocity = new Vec3(4, 0, 0);
  const original = ally.update;
  const bubble = new RiftcapTimeBubble(owner, { factor: 0.25 });
  bubble.update(0);
  assert.equal(animation.speed, 0.5);
  assert.equal(ally.entity.rigidbody.linearVelocity.x, 1);
  ally.applyStatus("stun", { duration: 1 });
  ally.update(1);
  assert.equal(ally.statuses.get("stun").remaining, 0.75);
  assert.equal(owner.update, Riftcap.prototype.update);
  ally.entity.setPosition(10, 0, 0);
  bubble.update(0.1);
  assert.equal(ally.update, original);
  assert.equal(animation.speed, 2);
  assert.equal(ally.entity.rigidbody.linearVelocity.x, 4);
  ally.entity.setPosition(2, 0, 0);
  bubble.update(0.1);
  bubble.destroy();
  bubble.destroy();
  assert.equal(ally.entity.rigidbody.linearVelocity.x, 4);
});

test("overlapping time bubbles choose minimum and restore in either release order", () => {
  for (const reverse of [false, true]) {
    const { owner, ally } = setup();
    ally.entity.rigidbody.linearVelocity = new Vec3(8, 0, 0);
    const a = new RiftcapTimeBubble(owner, { factor: 0.5 });
    const b = new RiftcapTimeBubble(owner, { factor: 0.25 });
    a.update(0);
    b.update(0);
    for (let i = 0; i < 10; i++) {
      ally.update(0.1);
    }
    assert.equal(ally.entity.rigidbody.linearVelocity.x, 2);
    (reverse ? a : b).destroy();
    assert.equal(ally.entity.rigidbody.linearVelocity.x, reverse ? 2 : 4);
    (reverse ? b : a).destroy();
    assert.equal(ally.entity.rigidbody.linearVelocity.x, 8);
  }
});

test("suspended Cube Bolt keeps damage and lifetime, resumes speed and then damages on collision", () => {
  const { owner, ally, royal } = setup();
  const shot = new RiftcapCubeBolt(owner, royal);
  owner.shots.add(shot);
  const speed = shot.entity.rigidbody.linearVelocity.length();
  const source = {};
  const lease = RiftcapTimeLease.acquire(shot, source, 0);
  const remaining = shot.remaining;
  shot.update(10);
  assert.equal(shot.remaining, remaining);
  assert.equal(shot.damage, 18);
  assert.equal(shot.entity.rigidbody.linearVelocity.length(), 0);
  lease.release(source);
  assert.ok(Math.abs(shot.entity.rigidbody.linearVelocity.length() - speed) < 1e-6);
  ally.isEnemy = false;
  shot.entity.collision.fire("collisionstart", { other: ally.entity });
  assert.equal(ally.health, 82);
  assert.equal(shot.alive, false);
});

test("bell during windup cancels effect; bell/death/teardown collapse bubble and restore others", () => {
  const { owner, ally } = setup();
  ally.receiveDamage(40);
  owner.testCast("heal", "ally");
  owner.onBellRung({ eventId: "ring" });
  owner.update(0.5);
  assert.equal(ally.health, 60);
  assert.equal(owner.stateName, "RiftcapReactionState");
  assert.equal(owner.testCast("ward", "ally"), false);
  owner.spells.timeBubble();
  owner.spells.bubble.update(0);
  assert.equal(owner.spells.bubble.expired, true);
  owner.statuses.clear();
  owner.spells.timeBubble();
  owner.receiveDamage(1000);
  assert.equal(owner.stateName, "RiftcapDeathState");
  assert.equal(owner.spells.bubble, null);
  assert.equal(ally.update, Enemy.prototype.update);
  owner.update(2);
  assert.equal(owner.entity.parent, null);
});

test("carry escape swaps only with reachable ally, annoyance and launch/landing use Yuka", () => {
  const { owner, ally, app } = setup();
  const carrier = { entity: new Entity("carrier") };
  assert.equal(owner.beginCarry(carrier), true);
  assert.equal(owner.stateName, "RiftcapCarriedState");
  owner.update(0.4);
  assert.equal(owner.carrier, null);
  assert.equal(owner.position.x, 2);
  assert.equal(ally.statuses.has("annoyed"), true);
  assert.equal(owner.entity.rigidbody.enabled, true);
  assert.equal(ally.carrier, carrier);
  assert.ok(ally.position.distance(new Vec3(0, 1.1, 0)) < 1e-6);
  assert.equal(ally.entity.rigidbody.enabled, false);
  owner.spells.cooldowns.clear();
  owner.entity.setPosition(0, 0, 0);
  assert.equal(owner.beginCarry(carrier), true);
  app.systems.rigidbody.raycastAll = () => [{
    entity: new Entity("gate"),
    hitFraction: 0.5,
  }];
  owner.update(0.5);
  assert.equal(owner.carrier, carrier);
  owner.launch({
    velocity: {
      x: 2,
      y: 4,
      z: 0,
    },
  });
  assert.equal(owner.stateName, "RiftcapAirborneState");
  assert.equal(owner.entity.rigidbody.linearVelocity.x, 2);
  assert.equal(owner.onLanding(), false);
  assert.equal(owner.stateName, "RiftcapAirborneState");
  owner.entity.rigidbody.linearVelocity.y = -1;
  owner.onLanding();
  assert.equal(owner.stateName, "RiftcapLandState");
  owner.update(0.5);
  assert.equal(owner.stateName, "RiftcapPursueState");
});

test("royal remains ultimate target and distant towers never attract combat", () => {
  const { owner, royal, objects } = setup();
  const tower = {
    isTower: true,
    entity: new Entity("tower"),
    receiveDamage: () => 0,
  };
  tower.entity.setPosition(20, 0, 0);
  objects.push(tower);
  assert.equal(owner.resolveRoyalTarget(), royal);
  assert.equal(owner.chooseSpell().target, royal);
  royal.entity.setPosition(10, 0, 0);
  assert.equal(owner.chooseSpell(), null);
});

test("capability-managed clocks receive a single combined scale and final restoration", () => {
  const actor = {
    scale: 1,
    setLocalTimeScale(source, scale) {
      this.scale = scale;
    },
  };
  const a = {};
  const b = {};
  const first = RiftcapTimeLease.acquire(actor, a, 0.5);
  const second = RiftcapTimeLease.acquire(actor, b, 0.3);
  assert.equal(actor.scale, 0.3);
  first.release(a);
  assert.equal(actor.scale, 0.3);
  second.release(b);
  assert.equal(actor.scale, 1);
});

test("unsupported private-clock actors are reported, not partially or globally slowed", () => {
  const { owner, objects } = setup();
  const actor = { entity: new Entity("private clock actor") };
  actor.entity.rigidbody = body(actor.entity);
  actor.entity.rigidbody.linearVelocity = new Vec3(4, 0, 0);
  objects.push(actor);
  const bubble = new RiftcapTimeBubble(owner);
  bubble.update(0);
  assert.equal(bubble.unsupportedActors.has(actor), true);
  assert.equal(actor.entity.rigidbody.linearVelocity.x, 4);
  bubble.destroy();
  assert.equal(bubble.unsupportedActors.size, 0);
});

test("bubble expires and map teardown restores wards, clocks, animations and projectile resources", () => {
  const { owner, ally, royal } = setup();
  const originalUpdate = ally.update;
  const originalDamage = ally.receiveDamage;
  owner.spells.ward(ally);
  owner.spells.timeBubble();
  assert.notEqual(ally.update, originalUpdate);
  owner.spells.update(5);
  assert.equal(ally.update, originalUpdate);
  owner.spells.timeBubble();
  owner.spells.bolt(royal);
  const shot = [...owner.shots][0];
  owner.destroy();
  assert.equal(ally.update, originalUpdate);
  assert.equal(ally.receiveDamage, originalDamage);
  assert.equal(shot.alive, false);
  assert.equal(owner.shots.size, 0);
});

test("animation rate changes inside a bubble are scaled once and restored at the new rate", () => {
  const { owner, ally } = setup();
  const animation = { speed: 1 };
  ally.entity.findComponents = () => [animation];
  const update = ally.update;
  ally.update = function(dt) {
    update.call(this, dt);
    animation.speed = 2;
  };
  const bubble = new RiftcapTimeBubble(owner, { factor: 0.25 });
  bubble.update(0);
  assert.equal(animation.speed, 0.25);
  ally.update(0.1);
  assert.equal(animation.speed, 0.5);
  ally.update(0.1);
  assert.equal(animation.speed, 0.5);
  bubble.destroy();
  assert.equal(animation.speed, 2);
});
