import assert from "node:assert/strict";
import test from "node:test";
import { Entity, Vec3 } from "playcanvas";
import { State } from "yuka";
import { Divecap } from "../../../../../../src/game/objects/enemies/divecap/Divecap.js";

function setup() {
  const actors = [];
  const app = { systems: { rigidbody: { raycastAll: () => [] } } };
  const enemy = new Divecap({ pc: { Entity, Vec3 }, app, definition: { id: "divecap-a" }, runtime: { objects: actors } });
  enemy.entity.rigidbody = { enabled: true, linearVelocity: new Vec3(), teleport: () => {} };
  actors.push(enemy);
  const royal = { entity: new Entity("royal"), isRoyal: true, health: 100, receiveDamage(amount) { this.health -= amount; return amount; } };
  royal.entity.setPosition(5, 0, 0);
  actors.push(royal);
  const pitcher = { entity: new Entity("ogre"), definition: { id: "ogre" }, alive: true, pickUp: () => {}, isWillingPassenger: () => true };
  Object.defineProperty(pitcher, "position", { get: () => pitcher.entity.getPosition() });
  pitcher.entity.setPosition(2, 0, 0);
  return { enemy, actors, royal, pitcher, app };
}

test("real Yuka pursuit chooses the person, never a nearby tower", () => {
  const { enemy, actors, royal } = setup();
  const tower = { entity: new Entity("tower"), receiveDamage: () => assert.fail("tower attacked") };
  actors.push(tower);
  assert.ok(enemy.behavior.currentState instanceof State);
  assert.equal(enemy.resolveRoyalTarget(), royal);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DivecapPursueState");
  assert.ok(enemy.entity.rigidbody.linearVelocity.x > 0);
});

test("queues stably for an ogre; open entrance selects royal pursuit", () => {
  const { enemy, actors, pitcher } = setup();
  actors.push(pitcher);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DivecapQueueState");
  assert.equal(enemy.isWillingToBeThrownBy(pitcher), true);
  assert.equal(enemy.isWillingToBeThrownBy({ entity: new Entity("catapult"), alive: true }), false);
  const later = new Divecap({ pc: { Entity, Vec3 }, app: {}, definition: { id: "divecap-b" }, runtime: { objects: actors } });
  actors.push(later);
  assert.ok(enemy.queuePosition(pitcher).distance(later.queuePosition(pitcher)) > 0.6);
  actors.push({ entranceDoors: [{ openAmount: 1 }] });
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DivecapPursueState");
});

test("bell encourages an ogre approach once without confusion or echo feedback", () => {
  const { enemy, actors, pitcher } = setup();
  actors.push(pitcher);
  enemy.onBellRung({ eventId: "bell-1" });
  assert.equal(enemy.stateName, "DivecapQueueState");
  assert.equal(enemy.statuses.has("confused"), false);
  assert.equal(enemy.requestedAnimation, "eager_hop");
  const until = enemy.encouragedUntil;
  enemy.update(0.2);
  enemy.onBellRung({ eventId: "bell-1" });
  enemy.onBellRung({ eventId: "bell-2", secondary: true });
  assert.equal(enemy.encouragedUntil, until);
});

test("carry and headfirst flight use body velocity, impact damages once and recovers", () => {
  const { enemy, royal, pitcher } = setup();
  assert.equal(enemy.beginCarry(pitcher), true);
  assert.equal(enemy.stateName, "DivecapCarriedState");
  assert.equal(enemy.entity.rigidbody.enabled, false);
  assert.equal(enemy.launch({ velocity: { x: 2, y: 4, z: 1 } }), true);
  assert.equal(enemy.stateName, "DivecapFlightState");
  enemy.update(0.4);
  assert.equal(enemy.requestedAnimation, "airborne_fly");
  enemy.entity.rigidbody.linearVelocity.y = -1;
  enemy.update(0.1);
  assert.equal(enemy.requestedAnimation, "dive_pose");
  enemy.update(0.4);
  assert.equal(enemy.requestedAnimation, "dive_loop");
  assert.equal(enemy.entity.rigidbody.linearVelocity.x, 2);
  royal.entity.setPosition(0.5, 0, 0);
  assert.equal(enemy.onLanding(), true);
  assert.equal(enemy.stateName, "DivecapLandingState");
  assert.equal(royal.health, 76);
  assert.equal(enemy.onLanding(), false);
  assert.equal(royal.health, 76);
  enemy.update(0.4);
  assert.equal(enemy.requestedAnimation, "land_recover");
  enemy.update(0.7);
  assert.equal(enemy.stateName, "DivecapPursueState");
});

test("splash cannot damage through a wall or damage a tower", () => {
  const { enemy, royal, app, actors } = setup();
  royal.entity.setPosition(0.5, 0, 0);
  actors.push({ entity: new Entity("tower"), receiveDamage: () => assert.fail("tower attacked") });
  app.systems.rigidbody.raycastAll = () => [{ entity: new Entity("wall") }];
  enemy.splashImpact();
  assert.equal(enemy.lastImpactHits, 0);
  assert.equal(royal.health, 100);
});

test("bonk checks contact time and range; stun interrupts and cannot heal death", () => {
  const { enemy, royal } = setup();
  royal.entity.setPosition(0.5, 0, 0);
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DivecapBonkState");
  enemy.update(0.1);
  assert.equal(royal.health, 100);
  royal.entity.setPosition(5, 0, 0);
  enemy.update(0.2);
  assert.equal(royal.health, 100);
  enemy.applyStatus("stun", { duration: 0.4 });
  assert.equal(enemy.stateName, "DivecapStunState");
  enemy.update(0.5);
  assert.equal(enemy.stateName, "DivecapRecoverState");
  enemy.update(0.6);
  assert.equal(enemy.stateName, "DivecapPursueState");
  enemy.receiveDamage(1000);
  assert.equal(enemy.stateName, "DivecapDeathState");
  assert.equal(enemy.receiveHealing(100), 0);
  enemy.update(1.1);
  assert.equal(enemy.alive, false);
});

test("existing royal game-over capability is invoked once per person", () => {
  const { enemy, actors } = setup();
  let calls = 0;
  const king = { entity: new Entity("King"), beginGameOver: () => calls++ };
  actors.push(king);
  enemy.splashImpact();
  enemy.splashImpact();
  assert.equal(calls, 1);
});

test("ground route goes around a solid wall and uses its opening when available", () => {
  const { enemy } = setup();
  let open = false;
  const blocked = (x, z) => x >= 1.8 && x <= 2.2 && (!open || Math.abs(z) > 0.3) && Math.abs(z) < 2;
  enemy.runtime.collisionWorld = {
    isMovementBlocked: (_x, _z, x, z) => blocked(x, z),
    physicsSurfaceHeightAt: () => 0,
  };
  enemy.route.next(new Vec3(4, 0, 0));
  assert.ok(enemy.route.path.some(point => Math.abs(point.z) >= 2));
  for (const point of enemy.route.path) assert.equal(blocked(point.x, point.z), false);
  open = true;
  enemy.elapsed = 1;
  enemy.route.next(new Vec3(4, 0, 0));
  assert.ok(enemy.route.path.every(point => Math.abs(point.z) < 0.3));
});

test("external stun in flight waits for safe impact before entering stun", () => {
  const { enemy } = setup();
  enemy.launch({ velocity: { x: 1, y: 4, z: 0 } });
  enemy.applyStatus("stun", { duration: 5 });
  assert.equal(enemy.stateName, "DivecapFlightState");
  enemy.onLanding();
  assert.equal(enemy.stateName, "DivecapLandingState");
  enemy.update(1.6);
  assert.equal(enemy.stateName, "DivecapStunState");
});

test("locomotion resumes after a hit and bell hop without leaving a finished action pose", () => {
  const { enemy } = setup();
  enemy.receiveDamage(1);
  assert.equal(enemy.requestedAnimation, "hit");
  enemy.update(0.5);
  assert.equal(enemy.requestedAnimation, "walk");
  enemy.onBellRung({ eventId: "walk-bell" });
  assert.equal(enemy.requestedAnimation, "eager_hop");
  enemy.update(0.8);
  assert.equal(enemy.requestedAnimation, "run");
});

test("physical landing requires foot support and rejects ascending or ceiling contact", () => {
  const { enemy, app } = setup();
  const floor = new Entity("floor");
  app.systems.rigidbody.raycastAll = () => [{ entity: floor, normal: new Vec3(0, 1, 0) }];
  enemy.launch({ velocity: { x: 0, y: 2, z: 0 } });
  assert.equal(enemy.onLanding({ other: floor }), false);
  enemy.entity.rigidbody.linearVelocity.y = -1;
  app.systems.rigidbody.raycastAll = () => [{ entity: new Entity("ceiling"), normal: new Vec3(0, -1, 0) }];
  assert.equal(enemy.onLanding({ other: floor }), false);
  assert.equal(enemy.airborne, true);
  app.systems.rigidbody.raycastAll = () => [{ entity: floor, normal: new Vec3(0, 1, 0) }];
  assert.equal(enemy.onLanding({ other: floor }), true);
  assert.equal(enemy.airborne, false);
});

test("an open entrance on an unrelated castle cannot divert the target's queue", () => {
  const { enemy, actors, royal } = setup();
  actors.push({ entranceDoors: [{ openAmount: 0 }] }, { entranceDoors: [{ openAmount: 1 }] });
  royal.definition = { castleIndex: 0 };
  assert.equal(enemy.hasOpenRoyalEntrance, false);
  royal.definition.castleIndex = 1;
  assert.equal(enemy.hasOpenRoyalEntrance, true);
});

test("outdoor routing uses real physics support when the authored collision world has no surface", () => {
  const { enemy, app } = setup();
  const floor = new Entity("terrain physics");
  floor.rigidbody = { type: "static" };
  let queries = 0;
  enemy.runtime.collisionWorld = { isMovementBlocked: () => false, physicsSurfaceHeightAt: () => null };
  app.systems.rigidbody.raycastAll = from => { queries++; return [{ entity: floor, normal: new Vec3(0, 1, 0), point: new Vec3(from.x, 0, from.z) }]; };
  assert.ok(enemy.route.next(new Vec3(3, 0, 0)));
  assert.ok(queries > 0);
});

test("helmet bonks cannot target or damage a nearby royal through a wall", () => {
  const { enemy, royal, app } = setup();
  royal.entity.setPosition(0.5, 0, 0);
  app.systems.rigidbody.raycastAll = () => [{ entity: new Entity("wall") }];
  enemy.update(0.1);
  assert.equal(enemy.stateName, "DivecapPursueState");
  assert.equal(enemy.strikeRoyal(royal, 8), false);
  assert.equal(royal.health, 100);
});
