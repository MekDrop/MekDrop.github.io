import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
const hooks = registerHooks({
  load: (url, context, nextLoad) => {
    if (url.endsWith("?raw") || url.endsWith("?url")) {
      return {
        format: "module",
        source: `export default ${JSON.stringify(url.endsWith("?raw") ? readFileSync(new URL(url.slice(0, -4)), "utf8") : url)}`,
        shortCircuit: true,
      };
    }

    return nextLoad(url, context);
  },
});
const { LatchSlug } = await import("../../../../../../src/game/objects/enemies/latch-slug/LatchSlug.js");
hooks.deregister();

test("a door-facing slug retains its heading and launch velocity across Ammo steps", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const app = new pc.AppBase({ id: "latch-slug-facing" });
  app.init({
    graphicsDevice: new pc.NullGraphicsDevice({
      width: 1,
      height: 1,
    }),
    componentSystems: [pc.CollisionComponentSystem, pc.RigidBodyComponentSystem],
    resourceHandlers: [],
  });
  const physics = app.systems.rigidbody;
  physics.onLibraryLoaded();
  physics.gravity.set(0, 0, 0);
  const slug = new LatchSlug({
    pc,
    app,
    definition: {
      position: {
        x: 2,
        y: 2,
        z: -3,
      },
    },
    runtime: { objects: [] },
  });
  app.root.addChild(slug.entity);
  slug.entity.addComponent("collision", {
    type: "sphere",
    radius: slug.radius,
  });
  slug.entity.addComponent("rigidbody", {
    type: "dynamic",
    mass: 1,
    angularFactor: new pc.Vec3(),
  });
  try {
    const target = new pc.Vec3(-1, 2, 0);
    const direction = target.clone().sub(slug.position).normalize();
    const velocity = direction.clone().mulScalar(4).add(new pc.Vec3(0, 2, 0));
    slug.entity.rigidbody.linearVelocity = velocity;
    slug.faceTarget({ position: target });
    for (let frame = 0; frame < 12; frame++) {
      physics.onUpdate(1 / 60);
    }
    assert.ok(slug.entity.forward.dot(direction) > 0.999, "the physics body must retain its visual facing");
    assert.ok(slug.entity.rigidbody.linearVelocity.distance(velocity) < 0.001, "facing must preserve launch velocity");
    Object.defineProperty(slug,"stairCrawl",{
      value:{
        active:true,
        speedLimit:0,
      },
    });
    slug.moveToward({position:target},0.8);
    assert.ok(slug.entity.forward.dot(direction)>0.999,"a stationary reach must not turn toward a zero velocity vector");
    physics.onUpdate(1/60);
    assert.ok(slug.entity.forward.dot(direction)>0.999,"the paused heading must survive the next Ammo step");
    assert.equal(slug.entity.rigidbody.linearVelocity.x,0);
    assert.equal(slug.entity.rigidbody.linearVelocity.z,0);
  } finally {
    slug.destroy();
    app.destroy();
    globalThis.Ammo = previousAmmo;
  }
});

test("door leaps pass a real apex and reach the leaf while descending under Ammo gravity", () => {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const app = new pc.AppBase({ id: "latch-slug-jump-arc" });
  app.init({
    graphicsDevice: new pc.NullGraphicsDevice({
      width: 1,
      height: 1,
    }),
    componentSystems: [pc.CollisionComponentSystem, pc.RigidBodyComponentSystem],
    resourceHandlers: [],
  });
  const physics = app.systems.rigidbody;
  physics.onLibraryLoaded();
  physics.gravity.set(0, -9.81, 0);
  const slug = new LatchSlug({
    pc,
    app,
    definition: {
      position: {
        x: 0.5,
        y: 0,
        z: -3.2,
      },
    },
    runtime: { objects: [] },
  });
  app.root.addChild(slug.entity);
  slug.entity.addComponent("collision", {
    type: "sphere",
    radius: slug.radius,
    linearOffset: new pc.Vec3(0, slug.height / 2, 0),
  });
  slug.entity.addComponent("rigidbody", {
    type: "dynamic",
    mass: 1,
    angularFactor: new pc.Vec3(),
    linearDamping: 0,
  });
  const door = {
    entity: new pc.Entity(),
    clearWidth: 2,
    clearHeight: 2.4,
    openAmount: 0,
    getHit: () => ({ distance: 0.5 }),
  };
  app.root.addChild(door.entity);
  try {
    slug.doorTarget = door;
    assert.equal(slug.beginDoorLeap(), true);
    const target = slug.leapTarget;
    const contactZ = target.z - slug.radius - 0.015;
    let peak = slug.position.y;
    let crossed = false;
    for (let frame = 0; frame < 180; frame++) {
      physics.onUpdate(1 / 120);
      peak = Math.max(peak, slug.position.y);
      if (slug.position.z >= contactZ) {
        crossed = true;
        break;
      }
    }
    assert.equal(crossed, true);
    assert.ok(slug.entity.rigidbody.linearVelocity.y < -1, "the wall impact belongs to the falling half of the jump");
    assert.ok(peak - slug.position.y > 0.2, "there must be a distinct apex before contact");
    assert.ok(Math.abs(slug.position.y + slug.height / 2 - target.y) < 0.1, "the falling body still reaches its sampled leaf point");
  } finally {
    slug.destroy();
    app.destroy();
    globalThis.Ammo = previousAmmo;
  }
});
