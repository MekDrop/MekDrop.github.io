import test from "node:test";
import assert from "node:assert/strict";
import { Entity, Vec3 } from "playcanvas";
import { LatchBridgeState } from "../../../../../../src/game/objects/enemies/latch-slug/states/LatchBridgeState.js";

test("a donor settles at its original volume and transfers without the expanding inflation clip", () => {
  const state = new LatchBridgeState();
  const assignment = {
    station: 1,
    position: new Vec3(0.65, 0, 0),
    approach: new Vec3(),
  };
  const clips = [];
  const scales = [];
  state.bridge = {
    reserveRebuildStation: () => assignment,
    restoreSlimeStation: () => true,
    getRebuildAttemptStatus: () => "growing",
    getRebuildMorphProgress: () => ({
      progress: 0.5,
      nativeAdmitted: false,
    }),
  };
  state.assignment = assignment;
  const owner = {
    position: new Vec3(),
    alive: true,
    grounded: true,
    airborne: false,
    deltaTime: 0.6,
    playClip: (clip) => clips.push(clip),
    stop: () => {},
    faceTarget: () => {},
    setBridgeMorphScale: (scale) => scales.push(scale),
  };
  state.execute(owner);
  assert.equal(state.spreading, false);
  assert.deepEqual(scales, [], "settling cannot change donor scale before transfer begins");
  assert.equal(clips.at(-1), "idle_dog");
  state.execute(owner);
  assert.equal(state.spreading, true);
  state.execute(owner);
  assert.equal(clips.every((clip) => clip === "idle_dog"), true);
  assert.ok(Math.abs(scales.at(-1) ** 3 - 0.5) < 1e-10, "neutral source retains exactly its complementary volume");
});

test("a canceled dependent retreats on its real grip and keeps ground recovery active after support removal", () => {
  const state = new LatchBridgeState();
  const point = new Vec3(-1, 1, 7);
  const entry = new Vec3(-1.4, 1.5, 7);
  const velocity = new Vec3(0.1, -0.2, 0);
  let target;
  let released = 0;
  const support = {};
  state.assignment = {
    approach: point,
    supports: [{
      entity: support,
      position: point,
      start: entry,
      end: point,
      entry,
    }],
  };
  state.contactLatch = {
    point,
    other: support,
    crawl: (next) => {
      target = next;
    },
    destroy: () => {},
  };
  const owner = {
    position: new Vec3(-1.2, 0.8, 7),
    entity: { rigidbody: { linearVelocity: velocity } },
    alive: true,
    airborne: false,
    grounded: true,
    deltaTime: 0.1,
    setBridgeMorphScale: () => {},
    releaseRebuildAssignment: () => {
      released++;
    },
  };
  const originalPosition = owner.position.clone();
  state.cancelApproach(owner, new Vec3(-3.5, 2, 7));
  state.execute(owner);
  assert.equal(target, entry, "surviving native grip retreats along actual predecessor entry");
  assert.equal(state.bankReturn, null);
  state.contactLatch.point = null;
  state.execute(owner);
  assert.equal(released, 0, "support removal must not abandon the dependent into ordinary seek");
  assert.equal(state.bankReturn.phase, "walk");
  assert.deepEqual(state.bankReturn.target.toArray(), [-3.5, 2, 7]);
  assert.deepEqual(owner.position.toArray(), originalPosition.toArray());
  assert.equal(owner.entity.rigidbody.linearVelocity, velocity, "native falling momentum remains untouched");
  assert.equal(owner.airborne, true);
});

test("a verified tip attachment settles despite trailing capsule feet and resets when its live reach moves away", () => {
  const entity = new Entity();
  const support = new Entity();
  entity.setPosition(-1.64, 1.94, 7);
  const owner = {
    entity,
    position: entity.getPosition(),
    radius: 0.42,
    alive: true,
    grounded: false,
    airborne: false,
    deltaTime: 0.6,
    playClip: () => {},
    approachBridge: () => {},
  };
  const point = new Vec3(-1.29, 2.12, 7);
  const assignment = {
    station: 7,
    position: new Vec3(-0.64, 2.12, 7),
    approach: new Vec3(-1.22, 2.12, 7),
    placementEdge: new Vec3(-1.14, 2.12, 7),
    supports: [{
      entity: support,
      position: point,
      start: point,
      end: point,
    }],
  };
  let admitted = 0;
  const state = new LatchBridgeState();
  state.bridge = {
    reserveRebuildStation: () => assignment,
    restoreSlimeStation: () => {
      admitted++;

      return true;
    },
  };
  state.assignment = assignment;
  state.contactLatch = {
    point,
    other: support,
    constraint: {},
    extension: point.clone().sub(owner.position),
    crawl: () => {},
  };
  state.execute(owner);
  assert.equal(state.age, 0.6);
  entity.setPosition(-1.5, 1.94, 7);
  owner.position = entity.getPosition();
  owner.grounded = true;
  state.contactLatch.extension.copy(point).sub(owner.position);
  assignment.placementEdge.x = -0.8;
  state.execute(owner);
  assert.equal(state.age, 0, "grounded feet cannot bypass an invalid existing tip attachment");
  const verifiedLatch = state.contactLatch;
  state.contactLatch = null;
  state.execute(owner);
  assert.equal(state.age, 0, "a continuation requires verified tissue contact even with nearby grounded feet");
  state.contactLatch = verifiedLatch;
  assignment.placementEdge.x = -1.14;
  owner.grounded = false;
  assignment.position.x += 1;
  state.execute(owner);
  assert.equal(state.age, 0, "live material moving out of reach restarts settling");
  assert.equal(admitted, 0);
  assignment.position.x -= 1;
  state.execute(owner);
  state.execute(owner);
  assert.equal(admitted, 1, "actual local tip contact can complete without moving the feet into air");
});

test("a reserved slug reaches the live edge before contributing", () => {
  const calls = [];
  const assignment = {
    station: 2,
    position: {
      x: 2,
      y: 0,
      z: 0,
    },
    approach: {
      x: 1.35,
      y: 0,
      z: 0,
    },
  };
  const bridge = {
    reserveRebuildStation: () => assignment,
    restoreSlimeStation: () => {
      calls.push("restore");

      return true;
    },
    releaseRebuildStation: () => calls.push("release"),
  };
  const owner = {
    runtime: { objects: { getWithMethod: () => [bridge] } },
    position: {
      x: -1,
      y: 0,
      z: 0,
    },
    alive: true,
    grounded: true,
    deltaTime: 0.6,
    behavior: { changeTo: () => calls.push("seek") },
    playClip: () => {},
    approachBridge: () => calls.push("approach"),
    stop: () => {},
    faceTarget: () => {},
    setBridgeMorphScale: () => {},
    commitBridgeContribution: () => calls.push("commit"),
  };
  const state = new LatchBridgeState();
  assert.equal(state.claim(owner), true);
  state.execute(owner);
  assert.deepEqual(calls, ["approach"]);
  owner.position = {
    ...assignment.approach,
    x: assignment.approach.x - 0.8,
  };
  state.execute(owner);
  assert.deepEqual(calls, ["approach", "approach"]);
  calls.pop();
  owner.position = {
    ...assignment.approach,
    y: -2,
  };
  state.execute(owner);
  assert.deepEqual(calls, ["approach", "approach"]);
  owner.position = assignment.approach;
  owner.grounded = false;
  state.execute(owner);
  assert.deepEqual(calls, ["approach", "approach", "approach"]);
  owner.grounded = true;
  state.execute(owner);
  assert.deepEqual(calls, ["approach", "approach", "approach"]);
  state.execute(owner);
  assert.deepEqual(calls, ["approach", "approach", "approach", "restore"]);
  state.execute(owner);
  state.execute(owner);
  state.execute(owner);
  assert.deepEqual(calls, ["approach", "approach", "approach", "restore", "commit"]);
  state.exit(owner);
  assert.equal(calls.includes("release"), true);
});

test("an interrupted contributor releases its reservation", () => {
  let released = false;
  const bridge = {
    reserveRebuildStation: () => ({
      station: 1,
      position: {},
      approach: {},
    }),
    releaseRebuildStation: () => {
      released = true;
    },
  };
  const owner = { runtime: { objects: { getWithMethod: () => [bridge] } } };
  const state = new LatchBridgeState();
  state.claim(owner);
  state.exit(owner);
  assert.equal(released, true);
});

test("an unreachable placement releases through the owner's retry backoff", () => {
  const state = new LatchBridgeState();
  const point = {
    x: 0,
    y: 0,
    z: 0,
  };
  let released = 0;
  let retryDelay = 0;
  const bridge = {
    reserveRebuildStation: () => ({
      station: 1,
      position: point,
      approach: point,
    }),
    releaseRebuildStation: () => {
      released++;
    },
    restoreSlimeStation: () => assert.fail("unreachable workers must not be consumed"),
    failRebuildAttempt: () => assert.fail("unbound bank travel cannot be counted as a precarious physical placement"),
  };
  const owner = {
    runtime: { objects: { getWithMethod: () => [bridge] } },
    position: {
      x: 0,
      y: -2,
      z: 0,
    },
    alive: true,
    grounded: true,
    deltaTime: 1,
    playClip: () => {},
    approachBridge: () => {},
    stop: () => {},
    setBridgeMorphScale: () => {},
    releaseRebuildAssignment: () => {
      retryDelay = 15;
      state.exit(owner);
    },
  };
  state.claim(owner);
  for (let frame = 0; frame < 9; frame++) {
    state.execute(owner);
  }
  assert.equal(released, 1);
  assert.equal(retryDelay, 15);
  assert.equal(state.assignment, null);
  assert.equal(owner.position.y, -2);
});

test("workers visit live intermediate surfaces and cannot inflate from a remote latched contact", () => {
  const state = new LatchBridgeState();
  const assignment = {
    station: 4,
    position: new Vec3(3.65, 0, 0),
    approach: new Vec3(3, 0, 0),
    waypoints: [new Vec3(1, 0, 0), new Vec3(2, 0, 0)],
  };
  const approached = [];
  let detached = false;
  const bridge = {
    reserveRebuildStation: () => assignment,
    restoreSlimeStation: () => assert.fail("remote contact must not contribute"),
  };
  const owner = {
    runtime: { objects: { getWithMethod: () => [bridge] } },
    position: new Vec3(),
    alive: true,
    grounded: true,
    deltaTime: 0.1,
    playClip: () => {},
    stop: () => {},
    approachBridge: (point) => approached.push(point),
  };
  state.claim(owner);
  state.execute(owner);
  assert.equal(approached.at(-1), assignment.waypoints[0]);
  owner.position.set(1, 0, 0);
  state.execute(owner);
  assert.equal(approached.at(-1), assignment.waypoints[1]);
  state.contactLatch = {
    point: assignment.approach,
    destroy: () => {
      detached = true;
    },
  };
  state.execute(owner);
  assert.equal(detached, false);
  assert.ok(state.contactLatch);
  assert.equal(state.returning, true);
  assert.equal(state.spreading, false);
  state.returning = false;
  const entity = {};
  assignment.supports = [{
    station: 2,
    entity,
    position: new Vec3(1, 0, 0),
    start: new Vec3(0.5, 0.8, 0),
    end: new Vec3(1.5, -0.8, 0),
  }, {
    station: 3,
    entity: {},
    position: new Vec3(2, -1, 0),
    start: new Vec3(1.5, -0.8, 0),
    end: new Vec3(2.5, -1.2, 0),
  }];
  let crawlTarget = null;
  state.contactLatch = {
    other: entity,
    point: new Vec3(1, 0, 0),
    crawl: (target) => {
      crawlTarget = target;
    },
  };
  owner.grounded = false;
  state.execute(owner);
  assert.equal(crawlTarget, assignment.supports[0].end);
  assert.equal(state.spreading, false);
});

test("a growing contribution retains its worker and a failed attempt restores it for backoff", () => {
  const state = new LatchBridgeState();
  let status = "growing";
  let released = false;
  let scale = 1;
  state.bridge = { getRebuildAttemptStatus: () => status };
  state.assignment = { station: 2 };
  state.spreading = true;
  const owner = {
    deltaTime: 2,
    stop: () => {},
    setBridgeMorphScale: (value) => {
      scale = value;
    },
    destroy: () => assert.fail("a pending or failed attempt must retain its worker"),
    releaseRebuildAssignment: () => {
      released = true;
    },
  };
  state.execute(owner);
  assert.ok(scale > 0, "the source remains visible until its collider actually transfers to candidate material");
  assert.equal(released, false);
  status = "failed";
  state.execute(owner);
  assert.equal(scale, 1);
  assert.equal(state.spreading, false);
  assert.equal(released, true);
});

for (const status of ["growing", "complete"]) {
  test(`exiting a ${status} contribution rolls back only unfinished material`, () => {
    const state = new LatchBridgeState();
    let failures = 0;
    let restored = false;
    let detached = false;
    state.spreading = true;
    state.assignment = { station: 2 };
    state.bridge = {
      getRebuildAttemptStatus: () => status,
      failRebuildAttempt: () => {
        failures++;
      },
      releaseRebuildStation: () => {},
    };
    state.contactLatch = {
      destroy: () => {
        detached = true;
      },
    };
    state.exit({
      setBridgeMorphScale: () => {
        restored = true;
      },
    });
    assert.equal(failures, status === "growing" ? 1 : 0);
    assert.equal(restored, status === "growing");
    assert.equal(detached, true);
  });
}

test("a failed precarious approach keeps its verified grip through backoff and revised reservation", () => {
  const state = new LatchBridgeState();
  const entity = {};
  const support = {
    station: 1,
    entity,
    position: new Vec3(1, 0, 0),
    start: new Vec3(0.5, 0, 0),
    end: new Vec3(1.5, 0, 0),
  };
  let failed = 0;
  let released = false;
  let detached = false;
  const assignment = {
    station: 2,
    position: new Vec3(3, -1, 0),
    approach: new Vec3(2.5, -0.5, 0),
    supports: [support],
  };
  state.bridge = {
    reserveRebuildStation: () => ({
      ...assignment,
      attempt: failed,
    }),
    failRebuildAttempt: () => {
      failed++;
    },
  };
  state.assignment = assignment;
  state.stalledAge = 8;
  state.closestDistance = 0;
  const latch = {
    other: entity,
    point: new Vec3(1, 0, 0),
    crawl: () => {},
    destroy: () => {
      detached = true;
    },
  };
  state.contactLatch = latch;
  const owner = {
    position: new Vec3(1, 0, 0),
    alive: true,
    grounded: false,
    deltaTime: 0.1,
    stop: () => {},
    setBridgeMorphScale: () => {},
    playClip: () => {},
    releaseRebuildAssignment: () => {
      released = true;
    },
  };
  state.execute(owner);
  assert.equal(failed, 1);
  assert.equal(state.boundRetryDelay, 15);
  assert.equal(state.contactLatch, latch);
  assert.equal(detached, false);
  assert.equal(released, false);
  owner.deltaTime = 15;
  state.execute(owner);
  assert.equal(state.assignment.attempt, 1);
  assert.equal(state.contactLatch, latch);
  assert.equal(detached, false);
});

for (const scenario of ["ground", "lost", "holding", "gel"]) {
  test(`a bound retry with ${scenario} support ends null-reservation looping without an unsafe drop`, () => {
    const state = new LatchBridgeState();
    const entity = {};
    const support = {
      entity,
      position: new Vec3(1, 2, 0),
      start: new Vec3(0.5, 2, 0),
      end: new Vec3(1.5, 2, 0),
    };
    let reservations = 0;
    let releases = 0;
    let detached = false;
    let safe = scenario === "ground" || scenario === "gel";
    let surfaceType = scenario === "gel" ? "dynamic" : "static";
    state.bridge = {
      reserveRebuildStation: () => {
        reservations++;

        return null;
      },
    };
    state.assignment = {
      station: 2,
      approach: new Vec3(2, 2, 0),
      supports: [support],
    };
    state.returnSupports = [support];
    state.boundRetryDelay = 0.1;
    state.contactLatch = {
      other: entity,
      point: scenario === "lost" ? null : new Vec3(1, 2, 0),
      crawl: () => {},
      destroy: () => {
        detached = true;
      },
    };
    const owner = {
      alive: true,
      grounded: false,
      position: new Vec3(1, 2, 0),
      deltaTime: 0.1,
      stop: () => {},
      releaseRebuildAssignment: () => {
        releases++;
      },
      app: {
        systems: {
          rigidbody: {
            raycastFirst: () => safe ? {
              entity: { rigidbody: { type: surfaceType } },
              point: new Vec3(1, 2, 0),
              normal: new Vec3(0, 1, 0),
            } : null,
          },
        },
      },
    };
    state.execute(owner);
    if (scenario === "holding" || scenario === "gel") {
      for (let frame = 0; frame < 20; frame++) {
        state.execute(owner);
      }
      assert.equal(reservations, 1);
      assert.equal(detached, false);
      assert.equal(releases, 0);
      safe = true;
      surfaceType = "static";
      state.execute(owner);
    }
    assert.equal(detached, true);
    assert.equal(releases, 1);
    assert.equal(owner.grounded, false, "only the subsequent real collision may declare landing");
    assert.equal(owner.airborne, true);
    assert.equal(reservations, scenario === "lost" ? 0 : 1);
  });
}

test("bound return samples the current rotated and resized support instead of its old world endpoints", () => {
  const entity = new Entity();
  entity.setPosition(1, 2, 0);
  entity.rigidbody = { body: {} };
  entity.collision = { halfExtents: new Vec3(0.5, 0.1, 1) };
  const support = {
    entity,
    position: new Vec3(1, 2.1, 0),
    start: new Vec3(0.5, 2.1, 0),
    end: new Vec3(1.5, 2.1, 0),
  };
  const state = new LatchBridgeState();
  const assignment = {
    station: 2,
    position: new Vec3(2.65, 2.1, 0),
    approach: new Vec3(2, 2.1, 0),
    supports: [support],
  };
  let target = null;
  state.assignment = assignment;
  state.bridge = {
    reserveRebuildStation: () => assignment,
    failRebuildAttempt: () => {},
  };
  state.stalledAge = 8;
  state.closestDistance = 0;
  state.contactLatch = {
    other: entity,
    point: new Vec3(1, 2.1, 0),
    crawl: (point) => {
      target = point;
    },
  };
  const owner = {
    alive: true,
    grounded: false,
    position: new Vec3(1, 2.1, 0),
    deltaTime: 0.1,
    stop: () => {},
    setBridgeMorphScale: () => {},
  };
  state.execute(owner);
  entity.setPosition(2, 3, 0);
  entity.setEulerAngles(0, 0, 90);
  entity.collision.halfExtents.y = 0.2;
  state.returning = true;
  state.execute(owner);
  assert.ok(target.distance(new Vec3(1.8, 2.5, 0)) < 0.00001);
});

test("a temporarily withheld living placement retains its real grip instead of returning across gel", () => {
  const state = new LatchBridgeState();
  const entity = {};
  const assignment = {
    station: 2,
    position: new Vec3(2.65, 2, 0),
    approach: new Vec3(2, 2, 0),
    supports: [{
      entity,
      position: new Vec3(1, 2, 0),
      start: new Vec3(0.5, 2, 0),
      end: new Vec3(1.5, 2, 0),
    }],
  };
  let ready = false;
  let crawled = false;
  state.assignment = assignment;
  state.bridge = {
    rebuildDemand: { count: 1 },
    reserveRebuildStation: () => ready ? assignment : null,
  };
  state.contactLatch = {
    other: entity,
    point: new Vec3(1, 2, 0),
    crawl: () => {
      crawled = true;
    },
    destroy: () => assert.fail("temporary instability must preserve adhesion"),
  };
  const owner = {
    alive: true,
    grounded: false,
    position: new Vec3(1, 2, 0),
    deltaTime: 0.1,
    stop: () => {},
    playClip: () => {},
    releaseRebuildAssignment: () => assert.fail("temporary instability must preserve the reservation"),
  };
  for (let frame = 0; frame < 5; frame++) {
    state.execute(owner);
  }
  assert.equal(state.returning, false);
  assert.equal(crawled, false);
  ready = true;
  state.execute(owner);
  assert.equal(crawled, true);
  assert.equal(state.returning, false);
});

test("a folded successor cannot reverse the worker's exact linked entry and exit", () => {
  const state = new LatchBridgeState();
  const entity = {};
  const support = {
    entity,
    position: new Vec3(),
    start: new Vec3(-0.5, 0, 0),
    end: new Vec3(0.5, 0, 0),
    entry: new Vec3(-0.5, 0, 0),
    exit: new Vec3(0.5, 0, 0),
  };
  const following = {
    entity: {},
    position: new Vec3(-0.25, -0.4, 0),
    start: new Vec3(0.5, 0, 0),
    end: new Vec3(-1, -0.8, 0),
    entry: new Vec3(0.5, 0, 0),
    exit: new Vec3(-1, -0.8, 0),
  };
  const assignment = {
    station: 3,
    approach: new Vec3(2, 0, 0),
    position: new Vec3(2.65, 0, 0),
    supports: [support, following],
  };
  let crawled = null;
  let extended = null;
  state.bridge = { reserveRebuildStation: () => assignment };
  state.assignment = assignment;
  state.contactLatch = {
    other: entity,
    point: support.exit,
    crawl: (target) => {
      crawled = target;
    },
    extend: (target) => {
      extended = target;
    },
  };
  state.execute({
    alive: true,
    position: new Vec3(),
    deltaTime: 0.1,
    grounded: false,
    stop: () => {},
    playClip: () => {},
  });
  assert.equal(crawled, support.exit);
  assert.equal(extended, following.entry);
});

test("a completed living contribution retains identity and inversely morphs locally after actual structural failure", () => {
  const state = new LatchBridgeState();
  let status = "complete";
  let dormant = false;
  let release = false;
  let scale = 1;
  const recovery = {
    position: new Vec3(-1.3, 0.6, 7),
    velocity: new Vec3(0.1, -0.4, 0),
  };
  let restoredAt = null;
  const owner = {
    deltaTime: 2,
    stop: () => {},
    setBridgeMorphScale: (value) => {
      scale = value;
    },
    commitBridgeContribution: () => {
      dormant = true;
    },
    recoverBridgeContribution: (position, velocity) => {
      dormant = false;
      restoredAt = position;
      assert.equal(velocity, recovery.velocity);
    },
    releaseRebuildAssignment: () => {
      release = true;
    },
    destroy: () => assert.fail("a living contribution must retain the same actor identity"),
  };
  state.spreading = true;
  state.assignment = { station: 2 };
  state.bridge = {
    getRebuildAttemptStatus: () => status,
    getRebuildRecovery: (station, actor) => {
      assert.equal(station, 2);
      assert.equal(actor, owner);

      return recovery;
    },
  };
  state.execute(owner);
  assert.equal(dormant, true);
  assert.equal(state.committed, true);
  assert.ok(state.bridge);
  status = "failed";
  state.execute(owner);
  assert.equal(dormant, false);
  assert.equal(restoredAt, recovery.position);
  assert.equal(release, false);
  owner.deltaTime = 0.35;
  state.execute(owner);
  assert.ok(Math.abs(scale - 0.5) < 0.00001);
  state.execute(owner);
  assert.equal(scale, 1);
  assert.equal(state.spreading, false);
  assert.equal(release, true);
});

test("a recovered lower-floor actor returns to its real bank before requesting another overhead placement", () => {
  const state = new LatchBridgeState();
  const recovery = {
    position: new Vec3(1, 0.5, 7),
    bankTarget: new Vec3(-3.5, 2, 7),
  };
  state.spreading = true;
  state.committed = true;
  state.assignment = { station: 2 };
  state.bridge = {
    getRebuildAttemptStatus: () => "failed",
    getRebuildRecovery: () => recovery,
    reserveRebuildStation: () => assert.fail("lower-floor recovery must finish its physical return before claiming"),
  };
  const owner = {
    pc: { Vec3 },
    position: new Vec3(-4, 2, 7),
    deltaTime: 0.35,
    alive: true,
    airborne: true,
    app: { systems: { rigidbody: { raycastFirst: () => null } } },
    stop: () => {},
    playClip: () => {},
    setBridgeMorphScale: () => {},
    recoverBridgeContribution: (position) => owner.position.copy(position),
    releaseRebuildAssignment: () => assert.fail("return controller must retain recovery until actual safe bank support"),
  };
  state.execute(owner);
  state.execute(owner);
  state.execute(owner);
  assert.ok(state.bankReturn);
  assert.equal(state.spreading, false);
  assert.ok(state.bankReturn.target.distance(recovery.bankTarget) < 0.00001);
  state.execute(owner);
  assert.ok(owner.position.distance(recovery.position) < 0.00001);
  assert.equal(state.bankReturn.phase, "walk");
});

test("the next contributor stages during formation and starts its actual approach in the same ready frame", () => {
  const state = new LatchBridgeState();
  let ready = false;
  const stage = {
    station: 2,
    staging: true,
    position: new Vec3(-3.8, 2, 0),
    approach: new Vec3(-3.8, 2, 0),
  };
  const actual = {
    station: 2,
    position: new Vec3(-1.35, 2, 0),
    approach: new Vec3(-2, 2, 0),
  };
  const bridge = {
    reserveRebuildStation: () => ready ? actual : null,
    reserveRebuildStaging: () => stage,
    restoreSlimeStation: () => assert.fail("staging never admits material before a real close placement"),
  };
  let approached = null;
  let clip = null;
  const owner = {
    runtime: { objects: { getWithMethod: () => [bridge] } },
    alive: true,
    grounded: true,
    deltaTime: 0.1,
    position: new Vec3(-5, 2, 0),
    playClip: (value) => {
      clip = value;
    },
    approachBridge: (point) => {
      approached = point;
    },
    stop: () => {},
  };
  assert.equal(state.claim(owner), true);
  assert.equal(state.assignment.staging, true);
  state.execute(owner);
  assert.equal(approached, stage.approach);
  owner.position.copy(stage.approach);
  state.execute(owner);
  assert.equal(clip, "sit_loop");
  state.contact(owner, {
    other: { tags: { has: () => true } },
    contacts: [],
  });
  assert.equal(state.contactLatch, null);
  ready = true;
  approached = null;
  state.execute(owner);
  assert.equal(state.assignment, actual);
  assert.equal(approached, actual.approach);
  assert.equal(clip, "waddle_walk");
});

test("an unreachable staging approach releases its bank slot without counting a failed placement", () => {
  const state = new LatchBridgeState();
  const stage = {
    station: 2,
    staging: true,
    position: new Vec3(-3.8, 2, 0),
    approach: new Vec3(-3.8, 2, 0),
  };
  let released = 0;
  const bridge = {
    reserveRebuildStation: () => null,
    reserveRebuildStaging: () => stage,
    releaseRebuildStation: () => {
      released++;
    },
    failRebuildAttempt: () => assert.fail("unreachable staging is not a failed native placement"),
  };
  const owner = {
    runtime: { objects: { getWithMethod: () => [bridge] } },
    position: new Vec3(-5, 2, 0),
    deltaTime: 1,
    alive: true,
    grounded: true,
    stop: () => {},
    playClip: () => {},
    approachBridge: () => {},
    releaseRebuildAssignment: () => state.exit(owner),
  };
  state.claim(owner);
  for (let frame = 0; frame < 9; frame++) {
    state.execute(owner);
  }
  assert.equal(released, 1);
  assert.equal(state.bridge, null);
});

test("the donor uses authoritative complementary volume and never shrinks a second time after native handoff", () => {
  const state = new LatchBridgeState();
  let progress = 0;
  let scale = 1;
  state.assignment = { station: 2 };
  state.spreading = true;
  state.bridge = {
    getRebuildAttemptStatus: () => "growing",
    getRebuildMorphProgress: () => ({
      progress,
      nativeAdmitted: progress === 1,
    }),
  };
  const owner = {
    deltaTime: 0.1,
    stop: () => {},
    setBridgeMorphScale: (value) => {
      scale = value;
    },
  };
  for (progress of [0, 0.15625, 0.5, 0.84375, 0.999, 1]) {
    state.execute(owner);
    assert.ok(Math.abs(scale ** 3 + progress - 1) < 0.00001);
    if (progress < 1) {
      assert.ok(scale > 0);
    }
  }
  state.execute(owner);
  assert.equal(scale, 0);
});
