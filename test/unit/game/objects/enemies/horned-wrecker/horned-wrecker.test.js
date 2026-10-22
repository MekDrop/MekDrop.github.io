import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as pc from "playcanvas";
import { State } from "yuka";
import { HornedWrecker } from "../../../../../../src/game/objects/enemies/horned-wrecker/HornedWrecker.js";

const create = () => new HornedWrecker({
  pc,
  app: {},
  definition: { id: "wrecker" },
  runtime: { objects: [] },
});

test("bell immunity survives amplification and direct confusion statuses", () => {
  const actor = create();
  assert.equal(actor.onBellRung({ eventId: "primary" }), false);
  assert.equal(actor.stateName, "WreckerSnortState");
  assert.equal(actor.onBellRung({
    eventId: "secondary",
    secondary: true,
  }), false);
  assert.equal(actor.applyStatus("confused"), false);
  assert.equal(actor.applyStatus("confusion"), false);
  assert.equal(actor.applyStatus("stun", { kind: "bell" }), false);
  assert.equal(actor.statuses.size, 0);
  assert.ok(actor.behavior.currentState instanceof State);
});

test("snort and stomp precede rage; repeated noise does not restart warnings", () => {
  const actor = create();
  actor.provoke();
  actor.update(0.4);
  actor.onBellRung({ eventId: 1 });
  actor.update(0.3);
  assert.equal(actor.stateName, "WreckerStompState");
  actor.update(0.8);
  assert.equal(actor.stateName, "WreckerRageState");
  actor.update(2.5);
  assert.equal(actor.stateName, "WreckerRecoverState");
  actor.update(0.75);
  assert.equal(actor.stateName, "WreckerPursueState");
});

test("rage hurts allied contacts once per charge and ignores distant allies", () => {
  const actor = create();
  let health = 100;
  const ally = {
    isEnemy: true,
    receiveDamage: (amount) => {
      health -= amount;
    },
  };
  let distantHealth = 100;
  actor.runtime.objects.push(ally, {
    receiveDamage: (amount) => {
      distantHealth -= amount;
    },
  });
  actor.contactActors.add(ally);
  actor.provoke();
  actor.update(0.65);
  actor.update(0.8);
  actor.update(0.5);
  actor.update(0.5);
  assert.equal(health, 65);
  assert.equal(distantHealth, 100);
});

test("pickup is rejected, contacts receive a single headbutt, launch is impossible", () => {
  const actor = create();
  let damage = 0;
  const grabber = {
    receiveDamage: (amount) => {
      damage += amount;
    },
  };
  actor.contactActors.add(grabber);
  assert.equal(actor.canBeCarriedBy(grabber), false);
  assert.equal(actor.beginCarry(grabber), false);
  assert.equal(actor.stateName, "WreckerHeadbuttState");
  actor.update(0.3);
  actor.update(0.2);
  assert.equal(damage, 25);
  assert.equal(actor.launch({
    velocity: {
      x: 1,
      y: 3,
      z: 1,
    },
  }), false);
  assert.equal(actor.carrier, null);
  assert.equal(actor.airborne, false);
});

test("headbutt uses the hero status capability when health damage is unavailable", () => {
  const actor = create();
  const effects = [];
  const hero = {
    applyStatus: (name, options) => effects.push({
      name,
      options,
    }),
  };
  actor.contactActors.add(hero);
  assert.equal(actor.beginCarry(hero), false);
  actor.update(0.3);
  actor.update(0.2);
  assert.deepEqual(effects, [{
    name: "stun",
    options: { duration: 0.6 },
  }]);
});

test("external stun interrupts rage; death terminates actions and rejects revival", () => {
  const actor = create();
  actor.provoke();
  assert.equal(actor.applyStatus("stun", {
    duration: 0.5,
    kind: "physical",
  }), true);
  assert.equal(actor.stateName, "WreckerStunState");
  actor.update(0.6);
  assert.equal(actor.stateName, "WreckerStunRecoverState");
  actor.update(0.7);
  assert.equal(actor.stateName, "WreckerPursueState");
  actor.receiveDamage(1000);
  assert.equal(actor.stateName, "WreckerDeadState");
  actor.onBellRung({ eventId: "after-death" });
  actor.update(3);
  assert.equal(actor.stateName, "WreckerDeadState");
  assert.equal(actor.receiveHealing(100), 0);
});

test("royal actor is the ultimate target rather than castle or tower", () => {
  const actor = create();
  const castle = { entity: new pc.Entity("castle") };
  const royal = {
    entity: new pc.Entity("royal"),
    beginGameOver: () => {},
  };
  actor.runtime.objects.push(castle, royal);
  assert.equal(actor.resolveRoyalTarget(), royal);
});

test("three door contacts damage the production leaf-health capability", () => {
  const actor = create();
  actor.app.systems = { rigidbody: { raycastAll: () => [] } };
  let health = 48;
  const door = {
    entity: new pc.Entity("door"),
    openAmount: 0,
    receiveDamage: (amount) => {
      health -= amount;
    },
  };
  door.entity.setPosition(0, 0, 1);
  const royal = {
    entity: new pc.Entity("royal"),
    isRoyal: true,
  };
  royal.entity.setPosition(0, 0, 5);
  actor.runtime.objects.push(royal, { entranceDoors: [door] });
  assert.equal(actor.entranceRoute(royal).door, door);
  actor.batterDoor = door;
  for (let i = 0; i < 3; i++) {
    actor.beginBattering();
    actor.update(1.2);
  }
  assert.equal(health, 0);
  actor.entity.setPosition(0, 0, 3);
  assert.deepEqual(actor.entranceRoute(royal), {});
});

test("royal reach uses Ammo occlusion and starts the production performance once", () => {
  const actor = create();
  let started = 0;
  let accepted = 0;
  const royal = {
    entity: new pc.Entity("real royal"),
    beginGameOver: () => {
      accepted++;

      return {};
    },
    startGameOverPerformance: () => {
      started++;
    },
  };
  royal.entity.setPosition(0, 0, 1);
  actor.runtime.objects.push(royal);
  const wall = new pc.Entity("closed wall");
  actor.app.systems = { rigidbody: { raycastAll: () => [{ entity: wall }] } };
  actor.strikeContacts();
  assert.equal(accepted, 0);
  actor.app.systems.rigidbody.raycastAll = () => [];
  actor.strikeContacts();
  actor.strikeContacts();
  assert.equal(accepted, 1);
  assert.equal(started, 1);
});

test("pursuit uses the collision-aware doorway route before a direct entrance waypoint", () => {
  const actor = create();
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
  };
  royal.entity.setPosition(0, 0, 10);
  actor.runtime.objects.push(royal);
  const planned = { position: new pc.Vec3(0, 0, 3) };
  actor.navigation.next = () => planned;
  actor.entranceRoute = () => ({ waypoint: { position: new pc.Vec3(2, 0, 3) } });
  let received;
  actor.moveToward = (target) => {
    received = target;
  };
  actor.update(0.1);
  assert.equal(received, planned);
});

test("fist damage waits for windup and contact then recovers", () => {
  const actor = create();
  let damage = 0;
  actor.contactActors.add({
    receiveDamage: (amount) => {
      damage += amount;
    },
  });
  actor.behavior.changeTo("WreckerFistWindupState");
  actor.update(0.55);
  assert.equal(damage, 0);
  actor.update(0.18);
  assert.equal(damage, 25);
  actor.update(0.13);
  assert.equal(actor.stateName, "WreckerFistRecoverState");
  assert.equal(damage, 25);
});

test("open interior leaves are battered when the wrecker cannot fit past them", () => {
  const actor = create();
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
  };
  royal.entity.setPosition(0, 0, 5);
  const door = {
    entity: new pc.Entity("open interior leaf"),
    openAmount: 1,
    broken: false,
    blocksCameraAt: (x, y, z, radius) => radius === 0.7 && z > 0.6,
  };
  door.entity.setPosition(0, 0, 1);
  actor.runtime.objects.push(royal, { destructibleDoors: [door] });
  actor.app.systems = { rigidbody: { raycastAll: () => [] } };
  actor.update(0.1);
  assert.equal(actor.stateName, "WreckerBatterState");
  assert.equal(actor.batterDoor, door);
  door.broken = true;
  assert.equal(actor.blockingDoor(royal), null);
  door.broken = false;
  door.blocksCameraAt = () => false;
  assert.equal(actor.blockingDoor(royal), null);
});

test("entry stays straight until the complete capsule clears the masonry jamb", () => {
  const actor = create();
  actor.entity.setPosition(0, 0, 1.2);
  actor.app.systems = {};
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
  };
  royal.entity.setPosition(3, 0, 5);
  const door = { entity: new pc.Entity("entrance") };
  const layout = {
    origin: {
      x: 0,
      y: 0,
      z: 0,
    },
    walkableAreas: [{
      minX: -10,
      maxX: 10,
      minZ: -10,
      maxZ: 10,
      floorY: 0,
    }],
    toLocal: (x, z) => ({
      x,
      z,
    }),
    toWorld: (x, z, y) => ({
      x,
      y,
      z,
    }),
  };
  actor.runtime.objects.push(royal, {
    residence: {
      layout,
      blocksMovementAt: () => false,
    },
    entranceDoors: [door],
  });
  const waypoint = actor.navigation.next(royal);
  assert.equal(waypoint.position.x, 0);
  assert.ok(waypoint.position.z > actor.position.z + 0.6);
  assert.ok(Math.abs(actor.position.z - 1.2) < 0.000001);
  actor.entity.setPosition(0, 0, 1.8);
  actor.navigation.next(royal);
  // The inner doorway sits slightly nearer the facade than the entry waypoint.
  // Clearing the entrance must remain latched while approaching that doorway.
  actor.entity.setPosition(1.2, 0, 1.775);
  assert.ok(actor.navigation.next(royal).position.x > 1.2);
  actor.entity.setPosition(0, 0, -1.2);
  assert.equal(actor.navigation.next(royal).position.x, 0);
  actor.navigation.destroy();
});

test("the breaking fist contact requests a body-sized masonry breach from the door owner", () => {
  const actor = create();
  actor.app.systems = { rigidbody: { raycastAll: () => [] } };
  const door = {
    entity: new pc.Entity("narrow door"),
    clearWidth: 1,
    broken: false,
    receiveDamage: () => {
      door.broken = true;
    },
  };
  door.entity.setPosition(0, 0, 1);
  let breach;
  let invalidated = 0;
  actor.navigation.invalidate = () => {
    invalidated++;
  };
  actor.runtime.objects.push({
    breachDoorway: (target, width, height) => {
      breach = {
        target,
        width,
        height,
      };

      return true;
    },
  });
  actor.batterDoor = door;
  actor.beginBattering();
  actor.update(0.59);
  assert.equal(breach, undefined);
  actor.update(0.02);
  assert.equal(breach.target, door);
  assert.equal(breach.width, 3);
  assert.equal(breach.height, 2.2);
  assert.equal(invalidated, 1);
});

test("a smashed interior portal is crossed squarely before turning toward the royal", () => {
  const actor = create();
  actor.entity.setPosition(0, 0, 1.5);
  actor.app.systems = {};
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
  };
  royal.entity.setPosition(3, 0, 3);
  const door = {
    entity: new pc.Entity("smashed portal"),
    broken: true,
  };
  door.entity.setPosition(1.5, 0, 1.5);
  door.entity.setEulerAngles(0, -90, 0);
  const layout = {
    origin: {
      x: 0,
      y: 0,
      z: 0,
    },
    walkableAreas: [{
      minX: -10,
      maxX: 10,
      minZ: -10,
      maxZ: 10,
      floorY: 0,
    }],
    toLocal: (x, z) => ({
      x,
      z,
    }),
    toWorld: (x, z, y) => ({
      x,
      y,
      z,
    }),
  };
  actor.runtime.objects.push(royal, {
    residence: {
      layout,
      blocksMovementAt: () => false,
    },
    entranceDoors: [],
    destructibleDoors: [door],
  });
  const waypoint = actor.navigation.next(royal);
  assert.ok(waypoint.position.x > 2.6);
  assert.ok(Math.abs(waypoint.position.z - 1.5) < 0.000001);
  actor.navigation.destroy();
});

test("all exported clips contain finite changing tracks on the weighted rig", () => {
  const asset = readFileSync(new URL("../../../../../../src/game/models/enemies/horned-wrecker/horned-wrecker.glb", import.meta.url));
  assert.equal(asset.toString("ascii", 0, 4), "glTF");
  const jsonLength = asset.readUInt32LE(12);
  const gltf = JSON.parse(asset.subarray(20, 20 + jsonLength).toString());
  const manifest = JSON.parse(readFileSync(new URL("../../../../../../src/game/objects/enemies/horned-wrecker/animation-manifest.json", import.meta.url)));
  assert.equal(gltf.animations.length, manifest.clips.length);
  assert.ok(gltf.skins[0].joints.length > 10);
  for (const clip of manifest.clips) {
    const animation = gltf.animations.find((entry) => entry.name === clip.name);
    assert.ok(animation, clip.name);
    assert.ok(!clip.name.includes("confus"));
    let changes = false;
    for (const sampler of animation.samplers) {
      const accessor = gltf.accessors[sampler.output];
      assert.equal(accessor.componentType, 5126);
      const view = gltf.bufferViews[accessor.bufferView];
      const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const components = accessor.type === "VEC4" ? 4 : 3;
      const first = Array.from({ length: components }, (_, i) => asset.readFloatLE(offset + i * 4));
      for (let key = 0; key < accessor.count; key++) {
        for (let component = 0; component < components; component++) {
          const value = asset.readFloatLE(offset + (key * components + component) * 4);
          assert.ok(Number.isFinite(value), `${clip.name} finite track`);
          changes ||= Math.abs(value - first[component]) > 0.00001;
        }
      }
    }
    assert.ok(changes, `${clip.name} changes the actual exported rig`);
  }
});
