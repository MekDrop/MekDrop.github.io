import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { HookClimbBehavior } from "../../../../../../src/game/objects/enemies/hook-gremlin/HookClimbBehavior.js";
import { HookGremlin } from "../../../../../../src/game/objects/enemies/hook-gremlin/HookGremlin.js";

/**
 * @returns {ReturnType<typeof fixture>}
 */
function fixture() {
  const wall = {
    enabled: true,
    rigidbody: { type: "static" },
  };
  const physics = {
    gravity: new pc.Vec3(0, -9.81, 0),
    raycastFirst: () => hit,
  };
  const royal = {
    isRoyal: true,
    position: new pc.Vec3(0, 4, -4),
  };
  const enemy = new Enemy({
    pc,
    app: { systems: { rigidbody: physics } },
    definition: { id: "hook-test" },
    runtime: { objects: [royal] },
  });
  const forces = [];
  enemy.entity.rigidbody = {
    enabled: true,
    mass: 1,
    linearFactor: new pc.Vec3(1, 1, 1),
    linearVelocity: new pc.Vec3(),
    applyForce: (force) => forces.push(force),
    teleport: () => {},
  };
  const hit = {
    entity: wall,
    point: new pc.Vec3(0, 0.65, -0.3),
    normal: new pc.Vec3(0, 0, 1),
  };
  const clips = [];
  const control = new HookClimbBehavior(enemy, (clip) => clips.push(clip));

  return {
    enemy,
    control,
    hit,
    wall,
    physics,
    forces,
    clips,
  };
}

test("climb uses native body velocity and gravity-cancelling force", () => {
  const { enemy, control, hit, forces } = fixture();
  assert.equal(control.catchSurface(hit), true);
  enemy.update(0.7);
  assert.equal(enemy.stateName, "HookClimbState");
  assert.equal(enemy.entity.rigidbody.linearVelocity.y, 0.85);
  assert.equal(forces[0].equals(new pc.Vec3(0, 9.81, 0)), true);
  assert.deepEqual(enemy.entity.rigidbody.linearFactor, new pc.Vec3(0, 1, 0));
  control.destroy();
});

test("bell pauses a valid grip then resumes after expiry", () => {
  const { enemy, control, hit } = fixture();
  control.catchSurface(hit);
  enemy.onBellRung({
    eventId: "bell",
    duration: 1,
  });
  enemy.update(0.1);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "HookConfusedState");
  assert.equal(control.grip.attached, true);
  assert.deepEqual(enemy.entity.rigidbody.linearVelocity, new pc.Vec3());
  assert.deepEqual(enemy.entity.rigidbody.linearFactor, new pc.Vec3());
  enemy.update(1);
  assert.equal(enemy.stateName, "HookClimbState");
  control.destroy();
});

test("disappearing contact during confusion restores gravity and cannot resume climb", () => {
  const { enemy, control, hit, physics } = fixture();
  control.catchSurface(hit);
  enemy.onBellRung({ duration: 1 });
  enemy.update(0.1);
  physics.raycastFirst = () => null;
  enemy.update(0.1);
  assert.equal(control.grip.attached, false);
  assert.equal(enemy.airborne, true);
  assert.deepEqual(enemy.entity.rigidbody.linearFactor, new pc.Vec3(1, 1, 1));
  enemy.update(1);
  assert.equal(enemy.stateName, "HookDetachedState");
});

test("bell in flight never cancels throw velocity", () => {
  const { enemy, control } = fixture();
  enemy.onLaunched = () => control.onLaunched();
  enemy.launch({ velocity: new pc.Vec3(2, 4, -3) });
  enemy.onBellRung({ duration: 1 });
  enemy.update(0.1);
  enemy.update(0.1);
  assert.deepEqual(enemy.entity.rigidbody.linearVelocity, new pc.Vec3(2, 4, -3));
  assert.equal(control.grip.attached, false);
});

test("death wins over confusion and releases the surface", () => {
  const { enemy, control, hit } = fixture();
  control.catchSurface(hit);
  enemy.onDeath = () => control.onDeath();
  enemy.onBellRung({ duration: 3 });
  enemy.receiveDamage(100);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "HookDeadState");
  assert.equal(control.grip.attached, false);
  assert.equal(control.catchSurface(hit), false);
  assert.equal(enemy.onBellRung(), false);
});

test("actual missed landing stuns; bell cannot bypass the landing stun", () => {
  const { enemy, control } = fixture();
  enemy.onLanded = () => control.onLanded();
  enemy.launch({ velocity: new pc.Vec3(0, 1, 0) });
  enemy.onLanding();
  assert.equal(enemy.stateName, "HookStunnedState");
  enemy.onBellRung({ duration: 0.2 });
  enemy.update(0.1);
  assert.equal(enemy.stateName, "HookStunnedState");
  enemy.update(2);
  assert.equal(enemy.stateName, "HookRecoverState");
  enemy.update(0.9);
  assert.equal(enemy.stateName, "HookDetachedState");
});

test("nearby gremlins compete for a collider patch; release frees it", () => {
  const a = fixture();
  const b = fixture();
  assert.equal(a.control.catchSurface(a.hit), true);
  assert.equal(b.control.catchSurface(a.hit), false);
  a.control.destroy();
  assert.equal(b.control.catchSurface(a.hit), true);
  b.control.destroy();
});

test("pickup releases a grip; launched actor keeps its authored velocity", () => {
  const { enemy, control, hit } = fixture();
  control.catchSurface(hit);
  enemy.onCarried = () => control.onCarried();
  const carrier = { entity: new pc.Entity("carrier") };
  assert.equal(enemy.beginCarry(carrier), true);
  assert.equal(control.grip.attached, false);
  enemy.onBellRung();
  enemy.update(0.1);
  assert.equal(enemy.stateName, "HookCarriedState");
  control.beforeLaunch();
  enemy.onLaunched = () => control.onLaunched();
  enemy.launch({ velocity: new pc.Vec3(1, 5, -2) });
  assert.deepEqual(enemy.entity.rigidbody.linearVelocity, new pc.Vec3(1, 5, -2));
});

test("ground and dynamic actors cannot be claimed as a climbing wall", () => {
  const { control, hit } = fixture();
  assert.equal(control.catchSurface({
    ...hit,
    normal: new pc.Vec3(0, 1, 0),
  }), false);
  hit.entity.rigidbody.type = "dynamic";
  assert.equal(control.catchSurface(hit), false);
});

test("royal hook strike has a windup, one contact and recovery; towers are never selected", () => {
  const royalEntity = new pc.Entity("royal");
  royalEntity.setPosition(0, 0, -0.7);
  let hits = 0;
  const royal = {
    isRoyal: true,
    entity: royalEntity,
    receiveDamage: () => {
      hits++;
    },
  };
  const tower = {
    entity: new pc.Entity("tower"),
    receiveDamage: () => assert.fail("tower cannot be the ultimate target"),
  };
  const enemy = new HookGremlin({
    pc,
    app: {
      systems: {
        rigidbody: {
          raycastAll: () => [],
          raycastFirst: () => null,
        },
      },
    },
    definition: { id: "hook-attack" },
    runtime: { objects: [tower, royal] },
  });
  enemy.entity.rigidbody = {
    linearVelocity: new pc.Vec3(),
  };
  enemy.update(0.1);
  assert.equal(enemy.stateName, "HookAttackState");
  enemy.update(0.2);
  assert.equal(hits, 0);
  enemy.update(0.25);
  assert.equal(hits, 1);
  enemy.update(0.1);
  assert.equal(hits, 1);
  enemy.update(0.6);
  assert.equal(enemy.stateName, "HookDetachedState");
});

test("a wall blocks a royal hook attack rather than receiving damage itself", () => {
  const actor = fixture();
  actor.control.grip.release();
  const royalEntity = new pc.Entity("royal");
  royalEntity.setPosition(0, 0, -0.7);
  const wall = new pc.Entity("wall");
  const enemy = new HookGremlin({
    pc,
    app: { systems: { rigidbody: { raycastAll: () => [{ entity: wall }] } } },
    definition: { id: "hook-blocked" },
    runtime: { objects: [] },
  });
  assert.equal(enemy.canReachRoyal({
    isRoyal: true,
    entity: royalEntity,
  }), false);
});
