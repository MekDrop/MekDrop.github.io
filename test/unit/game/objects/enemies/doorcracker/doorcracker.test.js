import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Entity, Vec3, StandardMaterial, BLEND_ADDITIVE } from "playcanvas";
import { StateMachine } from "yuka";
import { Doorcracker } from "../../../../../../src/game/objects/enemies/doorcracker/Doorcracker.js";
import { DOORCRACKER_ANIMATION } from "../../../../../../src/game/objects/enemies/doorcracker/DoorcrackerAnimation.js";

class TestEntity extends Entity {
  addComponent(name) {
    if (name === "anim") {
      this.anim = {
        addAnimationState: () => {},
        baseLayer: { transition: () => {} },
      };
    } else if (name === "render") {
      this.render = { meshInstances: [{}] };
    }
  }
}

function actor(z, extra = {}) {
  const entity = new TestEntity();
  entity.setPosition(0, 0, z);

  return {
    entity,
    ...extra,
  };
}

function create(actors = []) {
  const enemy = new Doorcracker({
    pc: {
      Entity: TestEntity,
      Vec3,
      StandardMaterial,
      BLEND_ADDITIVE,
    },
    app: {},
    definition: { id: "doorcracker" },
    runtime: { objects: actors },
    modelLibrary: {
      instantiate: () => new TestEntity(),
      getAnimationTracks: () => new Map(Object.values(DOORCRACKER_ANIMATION).map(name => [name, { duration: 0.5 }])),
    },
  });
  enemy.entity.rigidbody = {
    enabled: true,
    linearVelocity: new Vec3(),
    teleport: () => {},
  };
  enemy.entity.collision = { enabled: true };

  return enemy;
}

test("real Yuka pursues royal person instead of nearby tower", () => {
  const royal = actor(8, { isRoyal: true });
  const enemy = create([actor(0.5), royal]);
  assert.ok(enemy.stateMachine instanceof StateMachine);
  assert.equal(enemy.resolveRoyalTarget(), royal);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DoorcrackerPursueState");
  assert.ok(enemy.entity.rigidbody.linearVelocity.z > 0);
});

test("closed door braces; opening interrupts fuse and proceeds inward", () => {
  const door = actor(0.8, { openAmount: 0 });
  const royal = actor(5, { isRoyal: true });
  const enemy = create([{ entranceDoors: [door] }, royal]);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DoorcrackerBraceState");
  enemy.update(0.5);
  assert.equal(enemy.stateName, "DoorcrackerFuseState");
  door.openAmount = 1;
  enemy.update(0.2);
  assert.equal(enemy.activeClip, "fuse_interrupt");
  enemy.update(0.5);
  assert.equal(enemy.stateName, "DoorcrackerPursueState");
  assert.equal(enemy.findObstructingDoor(royal), null);
  assert.equal(enemy.committed, false);
});

test("hit discards elapsed fuse rather than resuming stale countdown", () => {
  const enemy = create([actor(0.5, { isRoyal: true })]);
  enemy.update(0.1); enemy.update(0.5); enemy.update(1.8);
  enemy.receiveDamage(5);
  assert.equal(enemy.activeClip, "fuse_interrupt");
  enemy.update(0.5); enemy.update(0.1); enemy.update(0.5);
  assert.equal(enemy.committed, false);
  assert.equal(enemy.stateTime, 0);
});

test("blast contact commits once, hits both sides and disables living actor", () => {
  const hits = [];
  const enemy = create([actor(1, { receiveDamage: amount => hits.push(amount) }),
    actor(-1, { receiveDamage: amount => hits.push(amount) }),
    actor(5, { receiveDamage: amount => hits.push(amount) })]);
  enemy.changeState("DoorcrackerDetonateState");
  enemy.update(0.19); assert.equal(hits.length, 0);
  enemy.update(0.02); assert.deepEqual(hits, [80, 80]);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.entity.rigidbody.enabled, false);
  assert.equal(enemy.entity.collision.enabled, false);
  assert.equal(enemy.model.enabled, false);
  assert.equal(enemy.commitBlast(), false);
  assert.equal(enemy.receiveHealing(100), 0);
});

test("reentrant explosion callbacks see terminal state", () => {
  let enemy;
  const target = actor(1, {
    receiveDamage: () => {
      assert.equal(enemy.alive, false); assert.equal(enemy.commitBlast(), false);
    },
  });
  enemy = create([target]); enemy.commitBlast();
  assert.equal(enemy.committed, true);
});

test("fire starts early ignition and repeated fire cannot postpone it", () => {
  const enemy = create();
  enemy.receiveDamage(1, null, "fire"); enemy.update(0.3);
  enemy.applyStatus("burning", { duration: 2 }); enemy.update(0.16);
  assert.equal(enemy.stateName, "DoorcrackerDetonateState");
  enemy.update(0.2); assert.equal(enemy.committed, true);
});

test("bell encourages without confusion and deduplicates echoes", () => {
  const enemy = create(); enemy.onBellRung({ eventId: "bell" });
  assert.equal(enemy.encouraged, true); assert.equal(enemy.activeClip, "volunteer_hop");
  enemy.onBellRung({ eventId: "bell" }); enemy.onBellRung({
    eventId: "echo",
    secondary: true,
  });
  assert.equal(enemy.statuses.has("confused"), false);
  assert.equal(enemy.applyStatus("confused", { duration: 2 }), false);
});

test("pickup interrupts fuse and throw preserves engine velocity until landing", () => {
  const enemy = create([actor(0.5, { isRoyal: true })]);
  enemy.update(0.1); enemy.update(0.5);
  assert.equal(enemy.beginCarry(actor(-1)), true);
  assert.equal(enemy.stateName, "DoorcrackerCarriedState");
  assert.equal(enemy.launch({
    velocity: {
      x: 1,
      y: 5,
      z: 4,
    },
  }), true);
  enemy.update(0.3);
  assert.deepEqual(enemy.entity.rigidbody.linearVelocity.toArray(), [1, 5, 4]);
  assert.equal(enemy.onLanding(), true); assert.equal(enemy.activeClip, "land");
  assert.equal(enemy.onLanding(), false); assert.equal(enemy.committed, false);
});

test("fire countdown survives pickup and flight", () => {
  const enemy = create(); enemy.ignite(); enemy.beginCarry(actor(0));
  enemy.launch({
    velocity: {
      x: 0,
      y: 5,
      z: 3,
    },
  });
  enemy.update(0.46); enemy.update(0.2); assert.equal(enemy.committed, true);
});

test("stun holds AI and expires on simulation time", () => {
  const enemy = create([actor(8, { isRoyal: true })]);
  enemy.applyStatus("stun", { duration: 1 }); enemy.update(0.5);
  assert.equal(enemy.stateName, "DoorcrackerReactionState"); assert.equal(enemy.activeClip, "stun");
  enemy.update(0.5); assert.equal(enemy.activeClip, "stun_recover");
  enemy.update(0.5); assert.equal(enemy.stateName, "DoorcrackerPursueState");
});

test("ordinary death removes contact without explosion", () => {
  const enemy = create(); enemy.receiveDamage(1000);
  assert.equal(enemy.stateName, "DoorcrackerDeathState"); assert.equal(enemy.activeClip, "death");
  assert.equal(enemy.entity.rigidbody.enabled, false); assert.equal(enemy.committed, false);
  assert.equal(enemy.canBeCarriedBy(actor(0)), false);
});

test("runtime blast contact agrees with exported animation manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../../../../../src/game/objects/enemies/doorcracker/animations.json", import.meta.url)));
  const enemy = create();
  const clip = manifest.clips.find(entry => entry.name === "detonate");
  assert.equal(clip.events.find(event => event.name === "blast").time, enemy.detonationTime);
  assert.equal(new Set(manifest.clips.map(entry => entry.name)).size, Object.values(DOORCRACKER_ANIMATION).length);
});

test("an enabled production fire emitter ignites by spatial overlap", () => {
  const fire = actor(0);
  fire.entity._enabledInHierarchy = true;
  const emitter = new TestEntity("Rising fire particles");
  fire.entity.addChild(emitter);
  fire.definition = {
    volume: {
      x: 1,
      y: 1.5,
      z: 1,
    },
  };
  const enemy = create([fire]);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DoorcrackerFireState");
  assert.equal(enemy.activeClip, "panic_fire");
});

test("paused simulation cannot advance blast, and one large step crosses contact once", () => {
  let hits = 0;
  const enemy = create([actor(1, { receiveDamage: () => hits++ })]);
  enemy.changeState("DoorcrackerDetonateState");
  enemy.update(0);
  assert.equal(enemy.stateTime, 0);
  assert.equal(hits, 0);
  enemy.update(0.4);
  enemy.update(0);
  assert.equal(hits, 1);
});

test("open entrance remains an inward waypoint even when royal is off the direct approach line", () => {
  const door = actor(2, { openAmount: 1 });
  const royal = actor(8, { isRoyal: true });
  royal.entity.setPosition(5, 0, 8);
  const enemy = create([{ entranceDoors: [door] }, royal]);
  assert.equal(enemy.findObstructingDoor(royal), null);
  assert.ok(enemy.entranceWaypoint.position.z > 2);
  assert.ok(enemy.entranceWaypoint.position.z < royal.entity.getPosition().z);
});
