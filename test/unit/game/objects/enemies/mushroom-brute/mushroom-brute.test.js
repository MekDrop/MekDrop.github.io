import assert from "node:assert/strict";
import { test } from "node:test";
import * as pc from "playcanvas";
import Ammo from "sync-ammo/dist/ammo.module.js";
import { StateMachine, State } from "yuka";
import { readFileSync } from "node:fs";
import { MapTestControls } from "../../../../../../src/game/debug/MapTestControls.js";
import { MushroomBrute } from "../../../../../../src/game/objects/enemies/mushroom-brute/MushroomBrute.js";
import { Door } from "../../../../../../src/game/objects/architecture/door/Door.js";
import { BrutePursueState } from "../../../../../../src/game/objects/enemies/mushroom-brute/states/BrutePursueState.js";
import { BruteWindupState } from "../../../../../../src/game/objects/enemies/mushroom-brute/states/BruteWindupState.js";
import { BruteSwingState } from "../../../../../../src/game/objects/enemies/mushroom-brute/states/BruteSwingState.js";
import { BruteStunState } from "../../../../../../src/game/objects/enemies/mushroom-brute/states/BruteStunState.js";
import { BruteStunRecoverState } from "../../../../../../src/game/objects/enemies/mushroom-brute/states/BruteStunRecoverState.js";
import { BruteDeathState } from "../../../../../../src/game/objects/enemies/mushroom-brute/states/BruteDeathState.js";

/**
 * Real PlayCanvas + Ammo contacts, with deliberately empty animation tracks.
 * These tests isolate behavior; the runtime report proves real asset playback.
 * @param {import("node:test").TestContext} t
 */
function scene(t) {
  const previousAmmo = globalThis.Ammo;
  globalThis.Ammo = Ammo;
  const device = new pc.NullGraphicsDevice({
    width: 1,
    height: 1,
  });
  const app = new pc.AppBase({ id: "mushroom-brute-unit" });
  app.init({
    graphicsDevice: device,
    componentSystems: [pc.AnimComponentSystem, pc.CollisionComponentSystem, pc.RigidBodyComponentSystem],
    resourceHandlers: [],
  });
  app.systems.rigidbody.onLibraryLoaded();
  app.systems.rigidbody.gravity.set(0, 0, 0);
  const actors = [];
  const modelLibrary = {
    instantiate: () => new pc.Entity("animation behavior stub"),
    getAnimationTracks: (url, names) => new Map(names.map((name) => [name, new pc.AnimTrack(name, 2, [], [], [])])),
  };
  const brute = new MushroomBrute({
    pc,
    app,
    modelLibrary,
    definition: { id: "brute" },
    runtime: { objects: actors },
  });
  actors.push(brute);
  app.root.addChild(brute.entity);
  brute.onSceneReady();
  t.after(() => {
    brute.destroy();
    app.destroy();
    globalThis.Ammo = previousAmmo;
  });

  return {
    app,
    actors,
    brute,
  };
}

/**
 * @param {ReturnType<typeof scene>} world @param {string} name @param {number} x @param {number} z
 */
function ally(world, name, x, z) {
  const entity = new pc.Entity(name);
  world.app.root.addChild(entity);
  entity.setPosition(x, 0.7, z);
  entity.addComponent("collision", {
    type: "sphere",
    radius: 0.25,
  });
  entity.addComponent("rigidbody", {
    type: "dynamic",
    mass: 1,
  });
  const actor = {
    entity,
    alive: true,
    isEnemy: true,
    health: 100,
    receiveDamage(amount) {
      this.health -= amount;
    },
  };
  entity.enemy = actor;
  world.actors.push(actor);

  return actor;
}

/**
 * @param {ReturnType<typeof scene>} world @param {number} z
 */
function royal(world, z = 5) {
  const entity = new pc.Entity("actual royal capability");
  world.app.root.addChild(entity);
  entity.setPosition(0, 0, z);
  const actor = {
    entity,
    health: 100,
    isRoyal: true,
    receiveDamage(amount) {
      this.health -= amount;
    },
  };
  world.actors.push(actor);

  return actor;
}

test("uses real Yuka states and chooses a royal instead of a castle or tower", (t) => {
  const world = scene(t);
  const king = royal(world);
  world.actors.push({ entity: new pc.Entity("castle") }, { entity: new pc.Entity("tower") });
  assert.ok(world.brute.behavior instanceof StateMachine);
  assert.ok(world.brute.behavior.currentState instanceof State);
  assert.equal(world.brute.pursuitTarget, king);
  world.brute.update(0.1);
  assert.equal(world.brute.stateName, BrutePursueState.name);
  assert.ok(world.brute.entity.rigidbody.linearVelocity.z > 0);
  assert.equal(world.brute.entity.rigidbody.mass, 85);
});

test("physical club arc damages multiple allies once and excludes rear targets", (t) => {
  const world = scene(t);
  const left = ally(world, "left ally", -0.65, 1);
  const right = ally(world, "right ally", 0.65, 1);
  const rear = ally(world, "rear ally", 0, -1);
  world.app.systems.rigidbody.onUpdate(1 / 60);
  world.brute.sweepClub(0.12, 0.36);
  world.brute.sweepClub(0.12, 0.36);
  assert.equal(left.health, 68);
  assert.equal(right.health, 68);
  assert.equal(rear.health, 100);
  assert.ok(left.entity.rigidbody.linearVelocity.length() > 0, "Ammo receives a real impact impulse");
});

test("a real static wall shields allies from the club", (t) => {
  const world = scene(t);
  const shielded = ally(world, "shielded ally", 0, 1.2);
  const wall = new pc.Entity("wall");
  world.app.root.addChild(wall);
  wall.setPosition(0, 0.7, 0.6);
  wall.addComponent("collision", {
    type: "box",
    halfExtents: new pc.Vec3(2, 1, 0.1),
  });
  wall.addComponent("rigidbody", { type: "static" });
  world.app.systems.rigidbody.onUpdate(1 / 60);
  world.brute.sweepClub(0.12, 0.36);
  assert.equal(shielded.health, 100);
});

test("contact follows the authored right-to-left swing rather than the reverse arc", (t) => {
  const world = scene(t);
  const left = ally(world, "left ally", -0.65, 1);
  const right = ally(world, "right ally", 0.65, 1);
  world.brute.sweepClub(0.12, 0.20);
  assert.equal(right.health, 68);
  assert.equal(left.health, 100);
  world.brute.sweepClub(0.28, 0.36);
  assert.equal(left.health, 68);
});

test("a long swing update still performs contact then enters harmless recovery", (t) => {
  const world = scene(t);
  const victim = ally(world, "ally", 0, 1);
  world.brute.behavior.changeTo(BruteSwingState.name);
  world.brute.update(0.9);
  assert.equal(victim.health, 68);
  world.brute.update(0.3);
  assert.equal(victim.health, 68);
});

test("primary bell events require repetition and secondary/deduplicated events do not build anger", (t) => {
  const world = scene(t);
  const king = royal(world);
  const source = ally(world, "bell bug", 2, 1);
  for (let i = 0; i < 5; i++) {
    world.brute.onBellRung({
      eventId: "secondary",
      secondary: true,
      source,
    });
  }
  world.brute.onBellRung({
    eventId: "one",
    source,
  });
  world.brute.onBellRung({
    eventId: "one",
    source,
  });
  world.brute.onBellRung({
    eventId: "two",
    source,
  });
  assert.equal(world.brute.enraged, false);
  assert.equal(world.brute.pursuitTarget, king);
  world.brute.onBellRung({
    eventId: "three",
    source,
  });
  assert.equal(world.brute.enraged, true);
  assert.equal(world.brute.pursuitTarget, source);
  assert.equal(world.brute.statuses.has("confused"), false);
  world.brute.update(7.1);
  assert.equal(world.brute.pursuitTarget, king);
});

test("widely spaced bells do not count as repeated ringing", (t) => {
  const { brute } = scene(t);
  brute.onBellRung({ eventId: "one" });
  brute.update(6.1);
  brute.onBellRung({ eventId: "two" });
  brute.onBellRung({ eventId: "three" });
  assert.equal(brute.enraged, false);
});

test("external stun interrupts attack; anger and pickup attempts cannot cancel it", (t) => {
  const { brute } = scene(t);
  brute.behavior.changeTo(BruteWindupState.name);
  brute.applyStatus("stun", { duration: 2 });
  brute.beginCarry({ entity: new pc.Entity("carrier") });
  brute.onBellRung({ eventId: "one" });
  brute.onBellRung({ eventId: "two" });
  brute.onBellRung({ eventId: "three" });
  assert.equal(brute.stateName, BruteStunState.name);
  brute.update(1);
  assert.equal(brute.stateName, BruteStunState.name);
  brute.update(1.1);
  assert.equal(brute.stateName, BruteStunRecoverState.name);
  brute.update(0.7);
  assert.equal(brute.stateName, BrutePursueState.name);
  assert.equal(brute.enraged, true);
});

test("pickup is rejected angrily and launch cannot bypass the weight restriction", (t) => {
  const { brute } = scene(t);
  const carrier = { entity: new pc.Entity("hero") };
  assert.equal(brute.canBeCarriedBy(carrier), false);
  assert.equal(brute.beginCarry(carrier), false);
  assert.equal(brute.enraged, true);
  assert.equal(brute.carrier, null);
  assert.equal(brute.launch({
    velocity: {
      x: 1,
      y: 4,
      z: 0,
    },
  }), false);
  assert.equal(brute.airborne, false);
});

test("three genuine contacts break the production door leaves and preserve the frame", (t) => {
  const world = scene(t);
  royal(world);
  const entity = new pc.Entity("door frame");
  world.app.root.addChild(entity);
  let leavesBroken = 0;
  let frameSynced = 0;
  const door = new Door({
    pc,
    entity,
    modelUrl: "unit-door",
    animationName: "open",
    modelLibrary: {
      getAnimationTracks: () => new Map([["open", new pc.AnimTrack("open", 1, [], [], [])]]),
    },
    collision: {
      syncFrameBodies: () => {
        frameSynced++;
      },
      breakLeaves: () => {
        leavesBroken++;
      },
    },
  });
  world.actors.push({
    getPointerHit: () => ({
      door,
      distance: 1,
    }),
  });
  world.brute.attackDoor = door;
  world.brute.bashDoor();
  world.brute.bashDoor();
  assert.equal(door.health, 16);
  assert.equal(door.broken, false);
  world.brute.bashDoor();
  assert.equal(door.health, 0);
  assert.equal(door.broken, true);
  assert.equal(leavesBroken, 1);
  assert.equal(frameSynced, 1);
  assert.equal(entity.parent, world.app.root);
  world.brute.bashDoor();
  assert.equal(leavesBroken, 1, "a broken leaf is no longer an attack target");
});

test("stale or out-of-reach doors cannot be bashed remotely", (t) => {
  const world = scene(t);
  royal(world);
  let opened = 0;
  const door = {
    openAmount: 0,
    handlePointerDown: () => {
      opened++;
    },
  };
  world.actors.push({
    getPointerHit: () => ({
      door,
      distance: 4,
    }),
  });
  world.brute.attackDoor = door;
  for (let i = 0; i < 5; i++) {
    world.brute.bashDoor();
  }
  assert.equal(opened, 0);
});

test("a royal contact does actual damage once per swing and allows subsequent swings", (t) => {
  const world = scene(t);
  const king = royal(world, 1);
  world.brute.sweepClub(0.12, 0.36);
  world.brute.sweepClub(0.12, 0.36);
  assert.equal(king.health, 68);
  world.brute.swingRecipients.clear();
  world.brute.sweepClub(0.12, 0.36);
  assert.equal(king.health, 36);
});

test("death cancels attacks, rejects healing/status/carry, then removes the body", (t) => {
  const world = scene(t);
  const victim = ally(world, "ally", 0, 1);
  world.brute.behavior.changeTo(BruteSwingState.name);
  world.brute.receiveDamage(999);
  assert.equal(world.brute.stateName, BruteDeathState.name);
  assert.equal(world.brute.receiveHealing(100), 0);
  assert.equal(world.brute.applyStatus("stun"), false);
  assert.equal(world.brute.beginCarry({ entity: new pc.Entity("hero") }), false);
  world.brute.update(0.9);
  assert.equal(victim.health, 100);
  world.brute.update(0.8);
  assert.equal(world.brute.entity.parent, null);
  assert.equal(world.brute.entity.rigidbody, undefined);
});

test("a wall also prevents bashing a door on the far side", (t) => {
  const world = scene(t);
  royal(world);
  let opened = 0;
  const door = {
    openAmount: 0,
    entity: new pc.Entity("door"),
    handlePointerDown: () => {
      opened++;
    },
  };
  world.actors.push({
    getPointerHit: () => ({
      door,
      distance: 1.2,
    }),
  });
  const wall = new pc.Entity("wall before door");
  world.app.root.addChild(wall);
  wall.setPosition(0, 0.7, 0.6);
  wall.addComponent("collision", {
    type: "box",
    halfExtents: new pc.Vec3(2, 1, 0.1),
  });
  wall.addComponent("rigidbody", { type: "static" });
  world.brute.attackDoor = door;
  for (let i = 0; i < 5; i++) {
    world.brute.bashDoor();
  }
  assert.equal(opened, 0);
});

test("a production-style royal game-over capability is called only once", (t) => {
  const world = scene(t);
  let reached = 0;
  let performed = 0;
  const entity = new pc.Entity("royal with production capability");
  world.app.root.addChild(entity);
  entity.setPosition(0, 0, 1);
  world.actors.push({
    entity,
    beginGameOver: (getCameraPosition) => {
      assert.ok(getCameraPosition() instanceof pc.Vec3);
      reached++;

      return { route: [] };
    },
    startGameOverPerformance: () => {
      performed++;
    },
  });
  world.brute.sweepClub(0.12, 0.36);
  world.brute.swingRecipients.clear();
  world.brute.sweepClub(0.12, 0.36);
  assert.equal(reached, 1);
  assert.equal(performed, 1);
});

test("saved HUD scripts operate the real stun/pickup and clip-test states", (t) => {
  const world = scene(t);
  world.brute.definition.id = "mushroom-brute";
  const hero = { entity: new pc.Entity("hero") };
  const map = JSON.parse(readFileSync(new URL("../../../../../../src/game/maps/tests/enemy-mushroom-brute.json", import.meta.url)));
  const objects = {
    [Symbol.iterator]: () => world.actors.values(),
    getOne: () => hero,
    getAll: () => [],
  };
  const controls = new MapTestControls({
    getObjects: () => objects,
    getMap: () => map,
    setViewport: () => {},
    onRuntimeError: (error) => {
      throw error;
    },
  });
  const buttons = map.testControls.panels[0].buttons;
  assert.equal(controls.execute(buttons.find((button) => button.label === "Attempt pickup")), true);
  assert.equal(world.brute.enraged, true);
  assert.equal(world.brute.carrier, null);
  assert.equal(controls.execute(buttons.find((button) => button.label === "External stun")), true);
  assert.equal(world.brute.stateName, BruteStunState.name);
  assert.equal(world.brute.testPlayClip("missing"), false);
  const clipButton = map.testControls.panels[1].buttons[0];
  assert.equal(controls.execute(clipButton), true);
  assert.equal(world.brute.stateName, "BruteClipTestState");
  world.brute.resumeBehavior();
  assert.equal(world.brute.stateName, BruteStunState.name);
});
