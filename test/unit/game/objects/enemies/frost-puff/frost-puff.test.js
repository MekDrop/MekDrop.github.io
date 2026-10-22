import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { State } from "yuka";
import fs from "node:fs";
import { MapTestControls } from "../../../../../../src/game/debug/MapTestControls.js";
import { SceneObjectRegistry } from "../../../../../../src/game/rendering/scene/SceneObjectRegistry.js";
import { FROST_PUFF_ANIMATION } from "../../../../../../src/game/objects/enemies/frost-puff/FrostPuffAnimation.js";
import { FrostPuff } from "../../../../../../src/game/objects/enemies/frost-puff/FrostPuff.js";
import { Enemy } from "../../../../../../src/game/objects/enemies/shared/Enemy.js";
import { FrostPuffPursueState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffPursueState.js";
import { FrostPuffCastState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffCastState.js";
import { FrostPuffStartledState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffStartledState.js";
import { FrostPuffBurstState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffBurstState.js";
import { FrostPuffStunnedState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffStunnedState.js";
import { FrostPuffRecoverState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffRecoverState.js";
import { FrostPuffCarriedState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffCarriedState.js";
import { FrostPuffAirborneState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffAirborneState.js";
import { FrostPuffDeathState } from "../../../../../../src/game/objects/enemies/frost-puff/states/FrostPuffDeathState.js";

/**
 * Domain fixture: actual Yuka and PlayCanvas transforms, a velocity sink instead
 * of an Ammo world. These tests do not claim runtime physics or art validation.
 * @returns {{puff: FrostPuff, actors: Enemy[], app: pc.EventHandler}}
 */
function scene() {
  const actors = [];
  const app = new pc.EventHandler();
  app.systems = {
    rigidbody: {
      raycastFirst: () => null,
    },
  };
  const puff = new FrostPuff({
    pc,
    app,
    definition: { id: "puff" },
    runtime: { objects: actors },
  });
  puff.entity.rigidbody = {
    enabled: true,
    linearVelocity: new pc.Vec3(),
    teleport: () => {},
  };
  actors.push(puff);

  return {
    puff,
    actors,
    app,
  };
}

/**
 * @param {ReturnType<typeof scene>} fixture
 * @param {number} x
 * @param {string} type
 * @returns {Enemy}
 */
function actor(fixture, x, type = "Guard") {
  const target = new Enemy({
    pc,
    app: fixture.app,
    definition: { id: type },
    runtime: { objects: fixture.actors },
  });
  target.entity.setPosition(x, 0, 0);
  target.enemyType = type;
  fixture.actors.push(target);

  return target;
}

it("owns real Yuka states and seeks the royal actor, ignoring a nearby tower", () => {
  const fixture = scene();
  const { puff } = fixture;
  const tower = actor(fixture, 0.5, "Tower");
  tower.isTower = true;
  tower.isDefender = true;
  const royal = actor(fixture, 4, "King");
  royal.isRoyal = true;
  let followed = null;
  puff.followOpening = (target) => {
    followed = target;
  };
  puff.update(0.1);
  assert.ok(puff.behavior.currentState instanceof State);
  assert.ok(puff.behavior.currentState instanceof FrostPuffPursueState);
  assert.equal(followed, royal);
  assert.equal(puff.combat.shotTarget, null);
});

it("prefers Cinder Imp over defenders; Crown Crab is not a rivalry target", () => {
  const fixture = scene();
  actor(fixture, 0.5, "CrownCrab");
  const guard = actor(fixture, 1);
  guard.isDefender = true;
  const cinder = actor(fixture, 3, "CinderImp");
  assert.equal(fixture.puff.combat.shotTarget, cinder);
  cinder.health = 0;
  assert.equal(fixture.puff.combat.shotTarget, guard);
  guard.health = 0;
  assert.equal(fixture.puff.combat.shotTarget, null);
});

it("a freeze burst genuinely stops both allies and defenders, then expires", () => {
  const fixture = scene();
  const ally = actor(fixture, 1, "CrownCrab");
  const defender = actor(fixture, 1.5);
  defender.isDefender = true;
  const distant = actor(fixture, 8);
  assert.equal(fixture.puff.combat.burst(), 2);
  for (const target of [ally, defender]) {
    assert.equal(target.statuses.get("slow").factor, 0);
    assert.ok(target.statuses.has("stun"));
    target.entity.rigidbody = { linearVelocity: new pc.Vec3(1, 0, 0) };
    assert.equal(target.moveToward({ position: new pc.Vec3(5, 0, 0) }), false);
    assert.equal(target.entity.rigidbody.linearVelocity.x, 0);
    target.update(1.5);
    assert.equal(target.statuses.size, 0);
    assert.equal(target.moveToward({ position: new pc.Vec3(5, 0, 0) }), true);
    assert.equal(target.entity.rigidbody.linearVelocity.x, 1.2);
  }
  assert.equal(distant.statuses.size, 0);
  assert.equal(fixture.puff.statuses.size, 0);
});

it("chilling slows movement by 55 percent without inventing a freeze", () => {
  const fixture = scene();
  const guard = actor(fixture, 1);
  guard.entity.rigidbody = { linearVelocity: new pc.Vec3() };
  assert.equal(fixture.puff.combat.chill(guard), true);
  guard.moveToward({ position: new pc.Vec3(4, 0, 0) }, 2);
  assert.equal(guard.entity.rigidbody.linearVelocity.x, 0.9);
  assert.equal(guard.statuses.has("stun"), false);
});

it("rejects immune and dead recipients, and does not pass frost through walls", () => {
  const fixture = scene();
  const immune = actor(fixture, 1);
  immune.statusImmunities = new Set(["slow"]);
  const dead = actor(fixture, 1.1);
  dead.health = 0;
  const behindWall = actor(fixture, 1.2);
  const wall = new pc.Entity("wall");
  fixture.app.systems.rigidbody.raycastFirst = () => ({ entity: wall });
  assert.equal(fixture.puff.combat.burst(), 0);
  assert.equal(behindWall.statuses.size, 0);
  assert.equal(fixture.puff.combat.chill(immune, true), false);
  assert.equal(immune.statuses.size, 0);
});

it("fires only once at cast contact, including a large scaled-time step", () => {
  const fixture = scene();
  const guard = actor(fixture, 2);
  guard.isDefender = true;
  let shots = 0;
  fixture.puff.fireFrostShot = () => {
    shots++;
  };
  fixture.puff.update(0.01);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffCastState);
  fixture.puff.update(0.35);
  assert.equal(shots, 0);
  fixture.puff.update(0.8);
  assert.equal(shots, 1);
  fixture.puff.update(0.5);
  assert.equal(shots, 1);
});

it("stun interrupts the windup without a delayed shot and recovers via Yuka", () => {
  const fixture = scene();
  const guard = actor(fixture, 2);
  guard.isDefender = true;
  let shots = 0;
  fixture.puff.fireFrostShot = () => {
    shots++;
  };
  fixture.puff.update(0.01);
  fixture.puff.applyStatus("stun", { duration: 0.5 });
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffStunnedState);
  fixture.puff.update(0.6);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffRecoverState);
  fixture.puff.update(0.5);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffPursueState);
  assert.equal(shots, 0);
});

it("a bell bursts once, drifts away, and ignores duplicate or secondary rings", () => {
  const fixture = scene();
  const source = actor(fixture, 1, "Bell");
  let bursts = 0;
  let driftSource = null;
  fixture.puff.combat.burst = () => {
    bursts++;

    return 0;
  };
  fixture.puff.driftAway = (target) => {
    driftSource = target;
  };
  assert.equal(fixture.puff.onBellRung({
    eventId: "ring",
    source,
    duration: 3,
  }), true);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffBurstState);
  assert.equal(fixture.puff.onBellRung({
    eventId: "ring",
    source,
  }), false);
  assert.equal(fixture.puff.onBellRung({
    eventId: "secondary",
    secondary: true,
  }), false);
  fixture.puff.update(0.9);
  assert.equal(bursts, 1);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffStartledState);
  fixture.puff.update(0.1);
  assert.equal(driftSource, source);
  fixture.puff.update(3);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffPursueState);
});

it("carry and airborne states preserve the launch velocity and burst only on contact", () => {
  const fixture = scene();
  const carrier = actor(fixture, 0.5, "PitcherOgre");
  const { puff } = fixture;
  let bursts = 0;
  puff.combat.burst = () => {
    bursts++;

    return 2;
  };
  assert.equal(puff.beginCarry(carrier), true);
  assert.ok(puff.behavior.currentState instanceof FrostPuffCarriedState);
  assert.equal(puff.entity.rigidbody.enabled, false);
  assert.equal(puff.launch({ velocity: new pc.Vec3(2, 4, 1) }), true);
  assert.ok(puff.behavior.currentState instanceof FrostPuffAirborneState);
  puff.update(0.5);
  assert.deepEqual(puff.entity.rigidbody.linearVelocity, new pc.Vec3(2, 4, 1));
  assert.equal(bursts, 0);
  assert.equal(puff.onLanding(), true);
  assert.equal(bursts, 1);
  assert.equal(puff.onLanding(), false);
  puff.update(0.4);
  assert.equal(bursts, 1);
  puff.update(0.5);
  assert.ok(puff.behavior.currentState instanceof FrostPuffPursueState);
});

it("lethal damage cancels attacks, releases shots and disables the body", () => {
  const fixture = scene();
  let cleaned = 0;
  fixture.puff.shots.add({
    destroy: () => {
      cleaned++;
    },
  });
  fixture.puff.receiveDamage(200);
  assert.equal(fixture.puff.alive, false);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffDeathState);
  assert.equal(fixture.puff.entity.rigidbody.enabled, false);
  assert.equal(cleaned, 1);
  assert.equal(fixture.puff.receiveHealing(10), 0);
  assert.equal(fixture.puff.onBellRung(), false);
  fixture.puff.update(1.2);
  fixture.puff.destroy();
  assert.equal(cleaned, 1);
});

it("royal arrival acts on the actual royal once, never on a castle", () => {
  const fixture = scene();
  const castle = actor(fixture, 0.1, "Castle");
  const royal = actor(fixture, 0.3, "King");
  royal.isRoyal = true;
  fixture.puff.update(0.1);
  fixture.puff.update(0.1);
  assert.equal(royal.health, 75);
  assert.equal(castle.health, 100);
});

it("missing physics fails closed for shot/burst visibility", () => {
  const fixture = scene();
  const guard = actor(fixture, 1);
  guard.isDefender = true;
  fixture.app.systems = {};
  assert.equal(fixture.puff.combat.shotTarget, null);
  assert.equal(fixture.puff.combat.burst(), 0);
});

it("saved-map controls dispatch all planned clips through the production dispatcher", () => {
  const fixture = scene();
  fixture.puff.definition.id = "frost-puff-primary";
  const registry = new SceneObjectRegistry();
  registry.add("mapObject", fixture.puff);
  const castle = { definition: { id: "entrance-castle" } };
  registry.add("castle", castle);
  const map = JSON.parse(fs.readFileSync(new URL("../../../../../../src/game/maps/tests/enemy-frost-puff.json", import.meta.url)));
  const manifest = JSON.parse(fs.readFileSync(new URL("../../../../../../src/game/objects/enemies/frost-puff/animation-manifest.json", import.meta.url)));
  const controls = new MapTestControls({
    getObjects: () => registry,
    getMap: () => map,
    setViewport: () => {},
  });
  assert.deepEqual(manifest.clips.map((clip) => clip.name), Object.values(FROST_PUFF_ANIMATION));
  assert.equal(map.tileMeta.length, map.rows);
  assert.equal(map.tileMeta.every((row) => row.length === map.cols), true);
  for (const panel of map.testControls.panels.slice(1, 3)) {
    for (const button of panel.buttons) {
      assert.equal(controls.execute(button), true);
      assert.ok(controls.status("frost-puff-primary").includes(button.label));
    }
  }
  assert.equal(controls.execute(map.testControls.panels[0].buttons[0]), true);
  assert.equal(castle.testEntranceOpenAmount, 1);
  assert.equal(controls.execute(map.testControls.panels[0].buttons[1]), true);
  assert.equal(castle.testEntranceOpenAmount, 0);
  assert.equal(controls.execute(map.testControls.panels[0].buttons[2]), true);
  assert.ok(fixture.puff.behavior.currentState instanceof FrostPuffPursueState);
});

it("direct royal-arrival calls cannot attack scenery", () => {
  const fixture = scene();
  const castle = actor(fixture, 0.2, "Castle");
  fixture.puff.reachRoyal(castle);
  assert.equal(castle.health, 100);
});
