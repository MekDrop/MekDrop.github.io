import test from "node:test";
import assert from "node:assert/strict";
import * as pc from "playcanvas";
import { StateMachine } from "yuka";
import { WireGremlin } from "../../../../../../src/game/objects/enemies/wire-gremlin/WireGremlin.js";
import { WireGremlinSignalTower } from "../../../../../../src/game/objects/enemies/wire-gremlin/WireGremlinSignalTower.js";
import { WireGremlinNavigation } from "../../../../../../src/game/objects/enemies/wire-gremlin/WireGremlinNavigation.js";

/**
 * Test adapter: verifies constraint ownership, not Ammo solver behavior.
 */
class TestConstraint {
  /**
   * @param {pc.Vec3} point
   */
  setPivotB(point) {
    this.anchor = point;
  }
}

/**
 * @param {Array<import("playcanvas").Entity>} actors
 */
function fixture(actors = []) {
  const constraints = new Set();
  const app = {
    root: new pc.Entity("test root"),
    systems: {
      rigidbody: {
        raycastFirst: (start) => ({
          entity: actors.find((actor) => actor.isSabotageTower)?.entity,
          point: start.clone(),
          normal: new pc.Vec3(1, 0, 0),
        }),
        gravity: new pc.Vec3(0, -9.81, 0),
        dynamicsWorld: {
          addConstraint: (constraint) => constraints.add(constraint),
          removeConstraint: (constraint) => constraints.delete(constraint),
        },
      },
    },
  };
  const gremlin = new WireGremlin({
    pc,
    app,
    definition: { id: "wire-test" },
    runtime: { objects: actors },
  });
  gremlin.entity.rigidbody = {
    body: {},
    mass: 1,
    enabled: true,
    linearVelocity: new pc.Vec3(),
    teleport: (point) => gremlin.entity.setPosition(point),
    applyForce: () => {},
  };

  return {
    gremlin,
    constraints,
  };
}

function towerFixture() {
  const tower = {
    entity: new pc.Entity("tower"),
    alive: true,
    isSabotageTower: true,
    sabotageHeight: 0,
    firing: true,
    acquireCount: 0,
    releaseCount: 0,
    beginSabotage: () => {
      tower.firing = false;
      tower.acquireCount++;

      return () => {
        tower.firing = true;
        tower.releaseCount++;
      };
    },
  };

  return tower;
}

/**
 * @param {import("node:test").TestContext} t
 */
function installAmmo(t) {
  const previous = globalThis.Ammo;
  globalThis.Ammo = {
    btVector3: pc.Vec3,
    btPoint2PointConstraint: TestConstraint,
    destroy: () => {},
  };
  t.after(() => {
    globalThis.Ammo = previous;
  });
}

/**
 * @param {WireGremlin} gremlin
 */
function startSabotage(gremlin) {
  gremlin.update(0.1);
  gremlin.update(0.1);
  assert.equal(gremlin.animationName, "climb_top");
  gremlin.update(0.7);
  assert.equal(gremlin.animationName, "attach_tower");
  gremlin.update(0.4);
  assert.equal(gremlin.animationName, "sabotage_start");
  gremlin.update(0.5);
}

test("uses actual Yuka and selects royal actors rather than castles", () => {
  const castle = { entity: new pc.Entity("castle") };
  const royal = {
    entity: new pc.Entity("royal"),
    beginGameOver: () => {},
  };
  royal.entity.setPosition(3, 0, 0);
  const { gremlin } = fixture([castle, royal]);
  assert.ok(gremlin.stateMachine instanceof StateMachine);
  gremlin.update(0.1);
  assert.equal(gremlin.royalTarget, royal);
  assert.ok(gremlin.entity.rigidbody.linearVelocity.x > 0);
  gremlin.destroy();
});

test("bell restores tower firing while paused, then resumes sabotage", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin, constraints } = fixture([tower]);
  startSabotage(gremlin);
  assert.equal(gremlin.stateName, "GremlinSabotageState");
  assert.equal(tower.firing, false);
  assert.equal(constraints.size, 1);
  const progress = gremlin.sabotageProgress;
  gremlin.onBellRung({
    eventId: "bell-1",
    duration: 1,
  });
  assert.equal(tower.firing, true);
  gremlin.update(0.5);
  assert.equal(gremlin.sabotageProgress, progress);
  assert.equal(gremlin.stateName, "GremlinConfusedState");
  assert.equal(gremlin.onBellRung({ eventId: "bell-1" }), false);
  gremlin.update(0.6);
  gremlin.update(0.5);
  gremlin.update(0.5);
  assert.equal(tower.firing, false);
  assert.equal(tower.acquireCount, 2);
  gremlin.destroy();
  assert.equal(tower.firing, true);
  assert.equal(constraints.size, 0);
});

test("death releases tower mechanism and constraint once", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin, constraints } = fixture([tower]);
  startSabotage(gremlin);
  gremlin.receiveDamage(1000);
  assert.equal(gremlin.stateName, "GremlinDeadState");
  assert.equal(tower.firing, true);
  assert.equal(constraints.size, 0);
  gremlin.update(2);
  gremlin.destroy();
  assert.equal(tower.releaseCount, 1);
  assert.equal(gremlin.alive, false);
});

test("territorial challenge damages once and releases pursuit toward royal", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin: owner } = fixture([tower]);
  const { gremlin: challenger } = fixture([tower]);
  owner.update(0.1);
  challenger.update(0.1);
  assert.equal(challenger.stateName, "GremlinTerritorialState");
  challenger.update(0.8);
  assert.equal(owner.health, 100);
  challenger.update(0.3);
  assert.equal(owner.health, 100);
  challenger.update(0.1);
  assert.equal(owner.health, 92);
  challenger.update(0.3);
  assert.equal(owner.health, 92, "contact is applied once");
  challenger.update(0.3);
  assert.equal(challenger.target, null);
  challenger.update(0.1);
  assert.equal(challenger.target, null);
  owner.destroy();
  challenger.destroy();
});

test("bad throws have a finite stunned landing followed by anger", () => {
  const { gremlin } = fixture();
  const carrier = { entity: new pc.Entity("carrier") };
  assert.equal(gremlin.beginCarry(carrier), true);
  assert.equal(gremlin.stateName, "GremlinCarriedState");
  gremlin.launch({
    velocity: {
      x: 2,
      y: 4,
      z: 0,
    },
  });
  assert.equal(gremlin.stateName, "GremlinAirborneState");
  assert.equal(gremlin.entity.rigidbody.linearVelocity.y, 4);
  gremlin.onLanding();
  assert.equal(gremlin.stateName, "GremlinMissedLandingState");
  gremlin.update(0.9);
  assert.equal(gremlin.stateName, "GremlinAngryState");
  gremlin.update(0.7);
  assert.equal(gremlin.stateName, "GremlinPursueState");
  gremlin.destroy();
});

test("throw against a tower's child collider attaches and disables the mechanism", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const child = new pc.Entity("tower wall collider");
  tower.entity.addChild(child);
  const { gremlin, constraints } = fixture([tower]);
  gremlin.launch({
    velocity: {
      x: 1,
      y: 3,
      z: 0,
    },
  });
  gremlin.onLanding({ other: child });
  assert.equal(gremlin.animationName, "cling_land");
  assert.equal(tower.firing, true);
  gremlin.update(1 / 3);
  assert.equal(gremlin.animationName, "attach_tower");
  gremlin.update(0.4);
  assert.equal(gremlin.animationName, "sabotage_start");
  gremlin.update(0.5);
  assert.equal(gremlin.stateName, "GremlinSabotageState");
  assert.equal(constraints.size, 1);
  assert.equal(tower.firing, false);
  gremlin.destroy();
});

test("pliers attack has windup, one contact, recovery, and range validation", () => {
  let health = 30;
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
    receiveDamage: (amount) => {
      health -= amount;
    },
  };
  const { gremlin } = fixture([royal]);
  gremlin.update(0.1);
  gremlin.update(0.2);
  assert.equal(health, 30);
  gremlin.update(0.2);
  assert.equal(health, 18);
  gremlin.update(0.2);
  assert.equal(health, 18);
  gremlin.update(0.4);
  gremlin.update(0.1);
  royal.entity.setPosition(5, 0, 0);
  gremlin.update(0.5);
  assert.equal(health, 18);
  gremlin.destroy();
});

test("reaching an existing royal fires its actual game-over contract once", () => {
  let calls = 0;
  const royal = {
    entity: new pc.Entity("royal"),
    beginGameOver: () => {
      calls++;
    },
  };
  const { gremlin } = fixture([royal]);
  for (let i = 0; i < 20; i++) {
    gremlin.update(0.2);
  }
  assert.equal(calls, 1);
  gremlin.destroy();
});

test("sabotage eventually restores the tower and does not immediately reacquire it", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin, constraints } = fixture([tower]);
  startSabotage(gremlin);
  gremlin.update(6.1);
  assert.equal(tower.firing, true);
  assert.equal(gremlin.animationName, "sabotage_end");
  assert.equal(constraints.size, 1);
  gremlin.update(0.4);
  assert.equal(gremlin.animationName, "detach");
  gremlin.update(0.5);
  assert.equal(constraints.size, 0);
  assert.equal(gremlin.target, null);
  gremlin.update(0.1);
  assert.equal(gremlin.target, null);
  gremlin.update(31);
  assert.equal(gremlin.target, null, "completed sabotage commits to the royal route");
  gremlin.destroy();
});

test("confusion during detachment cannot restart a completed sabotage job", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin, constraints } = fixture([tower]);
  startSabotage(gremlin);
  gremlin.update(6.1);
  assert.equal(tower.firing, true);
  gremlin.onBellRung({
    eventId: "completed-job",
    duration: 1,
  });
  gremlin.update(1.1);
  gremlin.update(0.5);
  assert.equal(gremlin.stateName, "GremlinDetachState");
  gremlin.update(0.4);
  gremlin.update(0.5);
  assert.equal(tower.firing, true);
  assert.equal(tower.acquireCount, 1);
  assert.equal(constraints.size, 0);
  assert.equal(gremlin.target, null);
  gremlin.destroy();
});

test("launching an attached gremlin releases its constraint before flight", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin, constraints } = fixture([tower]);
  gremlin.update(0.1);
  gremlin.update(0.1);
  gremlin.update(0.5);
  gremlin.launch({
    velocity: {
      x: 1,
      y: 3,
      z: 0,
    },
  });
  assert.equal(constraints.size, 0);
  assert.equal(tower.firing, true);
  assert.equal(gremlin.airborne, true);
  gremlin.destroy();
});

test("confusion during flight prevents immediate sabotage on tower impact", (t) => {
  installAmmo(t);
  const tower = towerFixture();
  const { gremlin, constraints } = fixture([tower]);
  gremlin.launch({
    velocity: {
      x: 1,
      y: 3,
      z: 0,
    },
  });
  gremlin.onBellRung({
    eventId: "flight-bell",
    duration: 2,
  });
  gremlin.onLanding({ other: tower.entity });
  gremlin.update(0.5);
  assert.equal(gremlin.stateName, "GremlinConfusedState");
  assert.equal(tower.firing, true);
  assert.equal(constraints.size, 0);
  gremlin.destroy();
});

test("entrance sabotage opens the real door contract only after windup", () => {
  let jammed = true;
  let heldOpen = 0;
  const door = {
    entity: new pc.Entity("entrance"),
    clearGlue: () => {
      jammed = false;
    },
    openTemporarily: (duration) => {
      heldOpen = duration;
    },
  };
  const royal = {
    entity: new pc.Entity("royal"),
    isRoyal: true,
  };
  royal.entity.setPosition(4, 0, 0);
  const { gremlin } = fixture([{ entranceDoors: [door] }, royal]);
  gremlin.update(0.1);
  assert.equal(gremlin.stateName, "GremlinEntranceState");
  gremlin.update(0.2);
  assert.equal(heldOpen, 0);
  assert.equal(jammed, true);
  gremlin.update(0.3);
  assert.equal(jammed, false);
  assert.equal(heldOpen, 6);
  assert.equal(gremlin.royalTarget, royal);
  assert.equal(gremlin.stateName, "GremlinEntranceEndState");
  gremlin.update(0.3);
  assert.equal(gremlin.animationName, "sabotage_end");
  gremlin.update(0.1);
  assert.equal(gremlin.stateName, "GremlinPursueState");
  gremlin.destroy();
});

test("external stun uses its own state and completes recovery before pursuit", () => {
  const { gremlin } = fixture();
  gremlin.applyStatus("stun", { duration: 1 });
  assert.equal(gremlin.stateName, "GremlinStunnedState");
  assert.equal(gremlin.animationName, "stun");
  gremlin.update(1.1);
  assert.equal(gremlin.stateName, "GremlinRecoveryState");
  gremlin.update(0.2);
  assert.equal(gremlin.stateName, "GremlinRecoveryState");
  gremlin.update(0.4);
  assert.equal(gremlin.stateName, "GremlinPursueState");
  gremlin.destroy();
});

test("castle picking exposes interior door mechanisms to sabotage", () => {
  let opened = 0;
  const door = {
    entity: new pc.Entity("interior room door"),
    openAmount: 0,
    clearGlue: () => {},
    openTemporarily: () => {
      opened++;
    },
  };
  door.entity.setPosition(1, 0, 0);
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
  };
  royal.entity.setPosition(3, 0, 0);
  const castle = {
    entranceDoors: [],
    getPointerHit: () => ({
      door,
      distance: 1,
    }),
  };
  const { gremlin } = fixture([castle, royal]);
  gremlin.update(0.1);
  assert.equal(gremlin.stateName, "GremlinEntranceState");
  gremlin.update(0.2);
  assert.equal(opened, 0);
  gremlin.update(0.3);
  assert.equal(opened, 1);
  door.openAmount = 1;
  assert.equal(gremlin.findDoorObstruction(royal), null);
  gremlin.destroy();
  door.entity.destroy();
  royal.entity.destroy();
});

test("signal tower sabotage suppresses actual strikes until all leases release", () => {
  let strikes = 0;
  const bell = {
    visualRoots: [new pc.Entity("signal tower")],
    strike: () => {
      strikes++;
    },
    beginRinging: () => {},
  };
  const original = bell.strike;
  const target = WireGremlinSignalTower.forActor(bell);
  const first = target.beginSabotage({});
  const second = target.beginSabotage({});
  bell.strike();
  assert.equal(strikes, 0);
  first();
  first();
  bell.strike();
  assert.equal(strikes, 0);
  second();
  assert.equal(bell.strike, original);
  bell.strike();
  assert.equal(strikes, 1);
});

test("tower approach follows the timber post through model rotation and scale", () => {
  const root = new pc.Entity("signal tower");
  const model = new pc.Entity("authored model");
  root.addChild(model);
  root.setPosition(4, 2, -3);
  root.setEulerAngles(0, 90, 0);
  model.setLocalScale(2, 2, 2);
  const target = WireGremlinSignalTower.forActor({
    visualRoots: [root],
    strike: () => {},
    beginRinging: () => {},
  });
  const expected = model.getWorldTransform().transformPoint(new pc.Vec3(-0.55, 0, 0));
  assert.ok(target.sabotageApproachPosition.distance(expected) < 0.00001);
  assert.ok(target.sabotageApproachPosition.distance(root.getPosition()) > 1);
  root.destroy();
});

test("walking step assistance is bounded, checks upper clearance, and never teleports", () => {
  const { gremlin } = fixture();
  let height = 0.16;
  let overhead = false;
  gremlin.app.systems.rigidbody.raycastFirst = /**
   * @param {pc.Vec3} start
   * @param {pc.Vec3} end
   */ (start, end) => start.y > end.y ? {
      point: new pc.Vec3(end.x, height, end.z),
      normal: pc.Vec3.UP,
    } : overhead ? {} : null;
  const navigation = new WireGremlinNavigation(gremlin);
  const target = { position: new pc.Vec3(1, 0, 0) };
  const position = gremlin.position.clone();
  navigation.next(target);
  assert.ok(gremlin.entity.rigidbody.linearVelocity.y > 0);
  assert.ok(gremlin.position.equals(position));
  height = 0.3;
  gremlin.entity.rigidbody.linearVelocity.set(0, 0, 0);
  navigation.next(target);
  assert.equal(gremlin.entity.rigidbody.linearVelocity.y, 0);
  height = 0.16;
  overhead = true;
  navigation.next(target);
  assert.equal(gremlin.entity.rigidbody.linearVelocity.y, 0);
  navigation.destroy();
  gremlin.destroy();
});

test("castle navigation preserves short steps and clears open leaves before turning", () => {
  const royal = {
    isRoyal: true,
    entity: new pc.Entity("royal"),
  };
  royal.entity.setPosition(1, 2.014, 0);
  const castle = {
    entranceDoors: [],
    residence: {
      blocksMovementAt: () => false,
      layout: {
        origin: new pc.Vec3(0, 2.014, 0),
        walkableAreas: [{
          minX: -1,
          maxX: 2,
          minZ: -1,
          maxZ: 1,
          floorY: 2.014,
        }],
        authoredStairs: [],
        stairs: null,
        /**
         * @param {number} x @param {number} z
         */
        toLocal: (x, z) => ({
          x,
          z,
        }),
        /**
         * @param {number} x @param {number} z @param {number} y
         */
        toWorld: (x, z, y) => new pc.Vec3(x, 2.014 + y, z),
      },
    },
  };
  const { gremlin } = fixture([castle, royal]);
  gremlin.entity.setPosition(0, 2, 0);
  gremlin.app.systems.rigidbody.raycastFirst = () => null;
  gremlin.update(1 / 240);
  const navigation = new WireGremlinNavigation(gremlin);
  const next = navigation.next(royal);
  assert.ok(next.position.x > 0.001, "planner must not spend every frame climbing the same clearance");
  assert.ok(next.position.x < 0.015, "fixture exercises a short high-frame-rate look-ahead");
  gremlin.moveToward(next, 0.65, 0.001);
  assert.ok(gremlin.entity.rigidbody.linearVelocity.x > 0);
  assert.equal(gremlin.position.y, 2, "planning projection must not teleport the physical root");
  const doorEntity = new pc.Entity("door root");
  doorEntity.setPosition(0, 2, -1.5);
  // A fully open leaf extends into the room beside the passage centerline.
  castle.entranceDoors.push({
    entity: doorEntity,
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} radius
     */
    blocksCameraAt: (x, y, z, radius) => Math.abs(x - 1.484) < radius + 0.05 && z >= -1 - radius && z <= 2 + radius,
  });
  gremlin.entity.setPosition(0.9, 2, 0);
  const passage = navigation.next(royal);
  assert.ok(passage.position.x < 0.9, "steer away from the open leaf toward passage center");
  assert.ok(passage.position.z > 0.1, "continue past the leaf tip before turning toward the seated royal");
  navigation.destroy();
  doorEntity.destroy();
  gremlin.destroy();
});
