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
