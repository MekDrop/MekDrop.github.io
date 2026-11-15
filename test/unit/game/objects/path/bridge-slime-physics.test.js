import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { ACTOR_MASS } from "../../../../../src/game/enum/ActorMass.js";
import { BridgeSlimePhysics } from "../../../../../src/game/objects/path/BridgeSlimePhysics.js";
import { GroundCollisionWorld } from "../../../../../src/game/collision/GroundCollisionWorld.js";
import { HeroTerrain } from "../../../../../src/game/objects/characters/hero/HeroTerrain.js";
import { HeroFootSupport } from "../../../../../src/game/objects/characters/hero/HeroFootSupport.js";
import { HeroMovementSurface } from "../../../../../src/game/objects/characters/hero/HeroMovementSurface.js";

class Entity extends pc.Entity {
  addComponent(type, options) {
    this[type] = type === "rigidbody" ? {
      ...options,
      body: {},
      linearVelocity: new pc.Vec3(),
      angularVelocity: new pc.Vec3(),
      applyForce: (force) => {
        this.force = force;
      },
    } : { ...options };
  }
}

/**
 * @param {boolean} horizontal
 */
function fixture(horizontal = true) {
  const joints = new Set();
  const previous = globalThis.Ammo;
  globalThis.Ammo = {
    btVector3: class {
      constructor(x, y, z) {
        Object.assign(this, {
          x,
          y,
          z,
        });
      }
    },
    btPoint2PointConstraint: class {
      constructor(...args) {
        this.args = args;
      }
      setPivotB(value) {
        this.anchor = value;
      }
    },
    destroy: () => {},
  };
  const root = new Entity("test");
  const app = {
    root,
    systems: {
      rigidbody: {
        dynamicsWorld: {
          addConstraint: (joint) => joints.add(joint),
          removeConstraint: (joint) => joints.delete(joint),
        },
      },
    },
  };
  const physics = new BridgeSlimePhysics({
    pc: {
      ...pc,
      Entity,
    },
    app,
    root,
    horizontal,
  });

  return {
    app,
    root,
    joints,
    deckJointCount: () => [...joints].filter((joint) => !joint.slimeTruss).length,
    physics,
    destroy: () => {
      physics.destroy(); globalThis.Ammo = previous;
    },
  };
}

it("publishes current rotated box support to hero queries without creating static terrain", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3(0, 2, 0)]]), () => true, false);
    const world = new GroundCollisionWorld();
    world.add(context.physics, { physicsSurface: false });
    const map = {
      cols: 1,
      rows: 1,
      grid: [[2]],
      heightmap: [[2]],
      tileMeta: [[{
        bridgeSlime: true,
        bridgeSlimeSupported: true,
      }]],
    };
    const terrain = new HeroTerrain(map, world, []);
    assert.ok(Math.abs(terrain.surfaceAt(0, 0, 3) - 2) < 1e-6);
    assert.equal(world.physicsSurfaceHeightAt(0, 0), null);
    const body = context.root.children[0];
    assert.ok(body.tags.has("hero-moving-support"));
    assert.ok(body.tags.has("hero-support-surface"));
    assert.ok(body.tags.has("capsule-support"));
    body.setPosition(0, 0.5, 0);
    body.setEulerAngles(0, 0, 30);
    const center = 0.5 + body.collision.halfExtents.y / Math.cos(Math.PI / 6);
    assert.ok(Math.abs(terrain.surfaceAt(0, 0, 3) - center) < 1e-6);
    assert.ok(Math.abs(world.surfaceHeightAt(0.2, 0) - (center + 0.2 * Math.tan(Math.PI / 6))) < 1e-6);
    assert.equal(world.surfaceHeightAt(0, 0, 0, 0.1), null);
    assert.equal(world.surfaceHeightAt(0, 1.1), null);
    body.setEulerAngles(0, 0, 90);
    assert.equal(world.surfaceHeightAt(0, 0), null);
    world.remove(context.physics);
    assert.equal(world.surfaceHeightAt(0, 0), null);
  } finally {
    context.destroy();
  }
});

it("allows the hero's terrain and foot policies to walk from the bank across live settled boxes", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3(0, 2, 0)], [1, new pc.Vec3(1, 2, 0)],
      [2, new pc.Vec3(2, 2, 0)]]), () => true, true);
    const world = new GroundCollisionWorld();
    world.add(context.physics, { physicsSurface: false });
    const map = {
      cols: 7,
      rows: 3,
      grid: Array.from({ length: 3 }, () => Array(7).fill(2)),
      heightmap: Array.from({ length: 3 }, () => Array(7).fill(2)),
      tileMeta: Array.from({ length: 3 }, () => Array.from({ length: 7 }, () => ({}))),
    };
    for (const row of map.tileMeta) {
      for (const col of [3, 4, 5]) {
        row[col].bridgeSlime = true;
        row[col].bridgeSlimeSupported = true;
      }
    }
    const terrain = new HeroTerrain(map, world, []);
    const movement = new HeroMovementSurface(terrain, new HeroFootSupport(terrain), world);
    for (let x = -1; x < 2.9; x += 0.025) {
      const state = {
        position: new pc.Vec3(x, 2, 0),
        direction: new pc.Vec3(1, 0, 0),
        grounded: true,
        dodging: false,
        repelled: false,
        fallingToDeath: false,
      };
      assert.equal(movement.occupancyAt(x + 0.025, 0, state), "open", `crossing at ${x}`);
    }
  } finally {
    context.destroy();
  }
});

it("conserves contributed mass while the anchored bank thickens and free tip thins", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]), (station) => station < 0, false);
    const poses = context.physics.update();
    assert.ok(poses.get(0).thickness > poses.get(1).thickness);
    assert.ok(Math.abs([...poses.values()].reduce((sum, pose) => sum + pose.width * pose.thickness + pose.braces.reduce((volume, brace) => volume + brace.volume, 0), 0) - 2) < 1e-9);
    assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 2) < 1e-9);
    assert.equal(context.physics.settled, false);
  } finally {
    context.destroy();
  }
});

it("drops obsolete bank anchors even when the material station keys stay unchanged", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, () => true, false);
    assert.equal(context.deckJointCount(), 6);
    context.physics.sync(stations, () => false, false);
    assert.equal(context.deckJointCount(), 0);
  } finally {
    context.destroy();
  }
});

it("admits new mass at the evaluated free tip and transforms its local top pose", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3()]]), (station) => station < 0, false);
    const first = context.root.children[0];
    first.setPosition(0, -1, 0);
    first.setEulerAngles(0, 0, 60);
    const tip = first.getWorldTransform().transformPoint(new pc.Vec3(1, 0, 0));
    context.physics.sync(new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]), (station) => station < 0, false);
    assert.ok(context.root.children[1].getPosition().distance(tip) < 1e-9);
    const pose = context.physics.update().get(0);
    const top = first.getWorldTransform().transformPoint(new pc.Vec3(0, 0.13 * pose.thickness, 0));
    assert.ok(pose.position.distance(top) < 1e-9);
  } finally {
    context.destroy();
  }
});

it("withholds navigation admission for a tilted or rotating connected body", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3()]]), () => true, true);
    const entity = context.root.children[0];
    assert.equal(context.physics.connected, true);
    entity.rigidbody.angularVelocity.set(0, 1, 0);
    context.physics.update();
    assert.equal(context.physics.settled, false);
    assert.equal(context.physics.connected, true, "ordinary load motion preserves bank connection");
    entity.rigidbody.angularVelocity.set(0, 0, 0);
    entity.setEulerAngles(0, 0, 25);
    context.physics.update();
    assert.equal(context.physics.settled, false);
    entity.setEulerAngles(0, 0, 0);
    context.physics.update();
    assert.equal(context.physics.settled, true);
    context.physics.sync(new Map([[0, new pc.Vec3()]]), () => false, false);
    assert.equal(context.physics.connected, false, "removed bank revokes physical connection");
  } finally {
    context.destroy();
  }
});

it("forgets links when material is removed before a remote station is reintroduced", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)], [2, new pc.Vec3(2, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    stations.delete(1);
    context.physics.sync(stations, (station) => station < 0, false);
    context.root.children.find((entity) => entity.name.endsWith(" 2")).setPosition(10, 0, 0);
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, (station) => station < 0, false);
    assert.equal(context.deckJointCount(), 6, "remote former neighbor must not regain a stale link");
    stations.delete(0);
    context.physics.sync(stations, (station) => station < 0, true);
    context.physics.update();
    for (const entity of context.root.children) {
      assert.equal(entity.force, undefined, "removed bank cannot enable the reaching motor");
    }
  } finally {
    context.destroy();
  }
});

it("lets gravity act during failed-reach cooldown and retries without new contributors", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const tip = context.root.children[1];
    tip.setPosition(0, -2, 0);
    context.physics.sync(stations, (station) => station < 0 || station > 1, true);
    context.physics.update(31);
    assert.equal(tip.force, undefined);
    assert.match(context.physics.status, /reach blocked/);
    assert.equal(context.physics.settled, false);
    context.physics.update(8);
    assert.ok(tip.force.length() > 0);
    assert.match(context.physics.status, /seeking bank/);
    assert.equal(context.physics.settled, false);
  } finally {
    context.destroy();
  }
});

it("rejects a yawed bank edge whose midpoint meets but paired pivots do not", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, () => false, false);
    const entity = context.root.children[0];
    entity.setEulerAngles(0, 90, 0);
    entity.setPosition(-0.5, -0.13, -0.5);
    context.physics.sync(stations, (station) => station < 0, false);
    assert.equal(context.deckJointCount(), 0);
  } finally {
    context.destroy();
  }
});

it("rejects yawed tissue fronts whose midpoint meets but paired pivots do not", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [2, new pc.Vec3(2, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const entity = context.root.children[1];
    entity.setEulerAngles(0, 90, 0);
    entity.setPosition(1.5, -0.13, -0.5);
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, (station) => station < 0, false);
    assert.equal(context.deckJointCount(), 6);
  } finally {
    context.destroy();
  }
});

it("skips body replacement when a phase change leaves its dimensions unchanged", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, () => true, false);
    const collision = context.root.children[0].collision;
    const half = collision.halfExtents;
    Object.defineProperty(collision, "halfExtents", {
      get: () => half,
      set: () => assert.fail("unchanged collider must keep its native body"),
    });
    context.physics.sync(stations, () => true, true);
    context.physics.update();
  } finally {
    context.destroy();
  }
});

it("evenly redistributes a final contributor that already physically reaches its bank during sync", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, (station) => station < 0, false);
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, (station) => station < 0 || station > 1, true);
    const poses = context.physics.update();
    for (const pose of poses.values()) {
      assert.equal(pose.connected, true);
      assert.equal(pose.thickness, 1);
      assert.equal(pose.width, 1);
    }
    assert.equal(context.root.children[0].rigidbody.mass, ACTOR_MASS.LATCH_SLUG);
    assert.equal(context.root.children[1].rigidbody.mass, ACTOR_MASS.LATCH_SLUG);
  } finally {
    context.destroy();
  }
});

it("samples the actual stepped footprint, ignores overhead and wall hits, and keeps a reachable tip linked", () => {
  const context = fixture();
  try {
    const sampled = [];
    context.app.systems.rigidbody.raycastAll = (start, end, options) => {
      assert.equal(options.filterCollisionMask, pc.BODYGROUP_STATIC);
      sampled.push(start.clone());
      const floor = start.x > 0.65 ? 0.7 : 0.5;

      return [
        {
          point: new pc.Vec3(start.x, 4, start.z),
          normal: new pc.Vec3(0, 1, 0),
        },
        {
          point: new pc.Vec3(start.x, 0.9, start.z),
          normal: new pc.Vec3(1, 0, 0),
        },
        {
          point: new pc.Vec3(start.x, floor, start.z),
          normal: new pc.Vec3(0, 1, 0),
        },
      ];
    };
    const stations = new Map([[0, new pc.Vec3(0, 1.13, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const parent = context.root.children[0];
    parent.setEulerAngles(0, 0, -30);
    const edge = parent.getWorldTransform().transformPoint(new pc.Vec3(0.5, 0, 0));
    stations.set(1, new pc.Vec3(1, 1.13, 0));
    context.physics.sync(stations, (station) => station < 0, false);
    const donated = context.root.children[1];
    const near = donated.getWorldTransform().transformPoint(new pc.Vec3(-0.5, 0, 0));
    assert.ok(near.distance(edge) < 1e-6, "ground rise must not disconnect the donated near edge");
    assert.ok(donated.getPosition().y < 1, "overhead object cannot become a false ground surface");
    assert.ok(donated.up.x < 0, "reachable step uses a physically inclined continuation");
    assert.ok(sampled.some((point) => Math.abs(point.x - donated.getPosition().x) < 0.001), "final spawn position must be sampled");
    assert.equal(context.deckJointCount(), 6, "ground-clamped donation keeps a real near-bank link");
  } finally {
    context.destroy();
  }
});


it("notifies contact latches before replacing or destroying live support bodies", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const first = context.root.children[0];
    const pending = new Set();
    const reasons = new Map();
    context.app.fire = (name, entity, reason) => {
      if (name === "bridge-slime:after-body-change") {
        assert.equal(reasons.get(entity), "replace", "only replacement resumes an existing physical contact");
        if (entity === first) {
          assert.equal(pending.has(first), false, "new body must exist before native donor constraints resume");
        }
        pending.delete(entity);
        reasons.delete(entity);

        return;
      }
      assert.equal(name, "bridge-slime:before-body-change");
      assert.ok(["replace", "destroy"].includes(reason));
      reasons.set(entity, reason);
      pending.add(entity);
    };
    let half = first.collision.halfExtents;
    let mass = first.rigidbody.mass;
    Object.defineProperty(first.collision, "halfExtents", {
      get: () => half,
      set: (value) => {
        assert.ok(pending.delete(first), "collider replacement must follow synchronous latch notification");
        half = value;
      },
    });
    Object.defineProperty(first.rigidbody, "mass", {
      get: () => mass,
      set: (value) => {
        assert.ok(pending.delete(first), "mass changes must release constraints before body removal from the world");
        mass = value;
      },
    });
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, (station) => station < 0, false);
    const second = context.root.children[1];
    for (const entity of [first, second]) {
      const destroy = entity.destroy.bind(entity);
      entity.destroy = () => {
        assert.ok(pending.delete(entity), "support destruction must follow synchronous latch notification");
        assert.equal(reasons.get(entity), "destroy", "permanent body loss must not resume a donor constraint");
        destroy();
      };
    }
    pending.clear();
    stations.delete(1);
    context.physics.sync(stations, (station) => station < 0, false);
    pending.clear();
  } finally {
    context.destroy();
  }
});


it("admits a stationary sagged suspension with safe 22-degree physical slopes", () => {
  const context = fixture();
  try {
    const stations = new Map(Array.from({ length: 6 }, (_, station) => [station, new pc.Vec3(station, 2, 0)]));
    context.physics.sync(stations, (station) => station < 0 || station > 5, true);
    const heights = [1.785, 1.415, 1.166, 1.177, 1.455, 1.802];
    const angles = [-19, -22, -7, 8, 22, 17];
    for (let station = 0; station < 6; station++) {
      const entity = context.root.children[station];
      entity.setPosition(station, heights[station], 0);
      entity.setEulerAngles(0, 0, angles[station]);
    }
    context.physics.update();
    assert.equal(context.physics.connected, true);
    assert.equal(context.physics.settled, true, "stable contact-safe sag must not be compared with flat target elevation");
    context.root.children[2].setEulerAngles(0, 0, 30);
    context.physics.update();
    assert.equal(context.physics.settled, false, "a steep section still withholds walking admission");
  } finally {
    context.destroy();
  }
});


it("uses capsule contacts on the bank approach to a sagged physical face", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3(0, 2, 0)]]), () => true, true);
    const first = context.root.children[0];
    first.setPosition(0.013, 1.788, 0);
    first.setEulerAngles(0, 0, -19);
    const world = new GroundCollisionWorld();
    world.add(context.physics, { physicsSurface: false });
    const movement = new HeroMovementSurface(null, null, world);
    assert.equal(movement.requiresCapsuleSupport(new pc.Vec3(-0.6, 2, 0)), true, "capsule contact starts before the leading boot strikes the slope");
    assert.equal(context.physics.capsuleSupportHeightAt(-0.8, 0), null, "approach policy never invents a physical face");
    assert.ok(context.physics.capsuleSupportHeightAt(0, 0) < 2);
  } finally {
    context.destroy();
  }
});


it("retains the first real bank attachment under transient donor load and reshaping", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3(0, 2, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    assert.equal(context.deckJointCount(), 3);
    const first = context.root.children[0];
    first.setPosition(0.5, 1.6, 0);
    first.setEulerAngles(0, 0, -40);
    context.physics.update();
    assert.equal(context.deckJointCount(), 3, "solver displacement must not tear off the only physical bank pin");
    stations.set(1, new pc.Vec3(1, 2, 0));
    context.physics.sync(stations, (station) => station < 0, false);
    const poses = context.physics.update();
    assert.ok(poses.get(0).thickness > poses.get(1).thickness, "first donor reserves mass while its new continuation stays thin");
    assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 2) < 1e-9);
    assert.equal(context.deckJointCount(), 6, "the bank pin and new near-edge continuation both remain physically linked");
    context.physics.sync(stations, () => false, false);
    assert.equal(context.deckJointCount(), 3, "actual loss of bank support still releases the world pins");
  } finally {
    context.destroy();
  }
});


it("reports candidate attachment evidence and releases temporary bank torque on completion", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, (station) => station < 0, false);
    assert.equal(context.physics.getEntity(0), context.root.children[0]);
    assert.equal(context.physics.getEntity(1), null);
    assert.equal(context.physics.getPlacementStatus(0), "stable");
    assert.equal(context.deckJointCount(), 3, "incomplete bank face has a real torque-bearing contact patch");
    context.physics.sync(stations, () => true, true);
    assert.equal(context.deckJointCount(), 4, "completion uses only two hinge pins at each of the two banks");
    context.physics.sync(stations, () => false, false);
    assert.equal(context.physics.getPlacementStatus(0), "pending");
    context.physics.update(3.1);
    assert.equal(context.physics.getPlacementStatus(0), "failed");
  } finally {
    context.destroy();
  }
});


it("rejects reversed construction material instead of admitting a backwards frontier", () => {
  const context = fixture();
  try {
    context.physics.sync(new Map([[0, new pc.Vec3()]]), (station) => station < 0, false);
    context.physics.getEntity(0).setEulerAngles(0, 180, 0);
    assert.equal(context.physics.getPlacementStatus(0), "pending");
    context.physics.update(3.1);
    assert.equal(context.physics.getPlacementStatus(0), "failed", "upright but backwards tissue must be retried rather than consumed");
  } finally {
    context.destroy();
  }
});


it("invalidates an admitted predecessor after sustained inversion under a later contributor", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    assert.equal(context.physics.getPlacementStatus(1), "stable");
    context.physics.getEntity(1).setEulerAngles(0, 0, -105);
    context.physics.update(0.5);
    assert.deepEqual(context.physics.getFailedStations(), [], "brief load motion is recoverable");
    context.physics.update(1.6);
    assert.equal(context.physics.getPlacementStatus(1), "failed");
    assert.deepEqual(context.physics.getFailedStations(), [1], "committed predecessor failure must be visible to the construction owner");
    stations.delete(1);
    context.physics.sync(stations, (station) => station < 0, false);
    assert.deepEqual(context.physics.getFailedStations(), [], "rollback clears only removed material failure");
  } finally {
    context.destroy();
  }
});


it("changes failed construction into a deeper narrower support rib without inventing mass", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    const supported = (station) => station < 0;
    context.physics.sync(stations, supported, false);
    const before = context.physics.getPose(1);
    context.physics.sync(stations, supported, false, new Map([[1, 3]]));
    const after = context.physics.getPose(1);
    assert.ok(after.thickness > before.thickness * 1.5);
    assert.ok(after.width < before.width);
    assert.ok(Math.abs([...context.physics.update().values()].reduce((sum, pose) => sum + pose.width * pose.thickness + pose.braces.reduce((volume, brace) => volume + brace.volume, 0), 0) - 2) < 1e-9);
    assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 2) < 1e-9);
    assert.ok(context.root.children[1].collision.halfExtents.y > 0.13 * before.thickness);
    context.physics.sync(stations, () => true, true, new Map([[1, 3]]));
    assert.equal(context.physics.getPose(1).thickness, 1);
    assert.equal(context.physics.getPose(1).width, 1);
  } finally {
    context.destroy();
  }
});


it("prepares every existing predecessor progressively before an incoming donor joins", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false, new Map(), new Map([[1, 1]]));
    const before = context.physics.getPose(0).thickness;
    context.physics.update(0.3);
    const during = context.physics.getPose(0).thickness;
    context.physics.update(1.7);
    const prepared = context.physics.getPose(0).thickness;
    assert.ok(during > before && prepared > during, "the shape changes before donor mass is admitted");
    assert.ok(context.physics.getPose(1).thickness > 1);
    const poses = context.physics.update(0);
    assert.ok(Math.abs([...poses.values()].reduce((sum, pose) => sum + pose.width * pose.thickness + pose.braces.reduce((volume, brace) => volume + brace.volume, 0), 0) - 2) < 1e-9);
    assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 2) < 1e-9);
  } finally {
    context.destroy();
  }
});

it("keeps physical redistribution progressive when the forecast moves across a pending native link", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    const supported = (station) => station < 0;
    context.physics.sync(stations, supported, false);
    const before = context.physics.getPose(0);
    const beforeProfile = before.thickness / before.width;
    // The new forecast body has not yet joined the predecessor's native chain.
    stations.set(3, new pc.Vec3(3, 0, 0));
    context.physics.sync(stations, supported, false, new Map(), new Map([[3, 1]]));
    const admitted = context.physics.getPose(0);
    assert.ok(Math.abs(admitted.thickness / admitted.width - beforeProfile) < 1e-9, "moving the forecast cannot snap predecessor geometry");
    context.physics.update(0.9);
    const during = context.physics.getPose(0);
    assert.ok(during.thickness / during.width > beforeProfile * 1.1, "real predecessor geometry must flow during the new interval");
    assert.ok(Math.abs(context.physics.getEntity(0).collision.halfExtents.y - during.thickness * 0.13) < 1e-9);
    context.physics.update(1);
    const after = context.physics.getPose(0);
    assert.ok(after.thickness / after.width > during.thickness / during.width);
    const poses = [...context.physics.update(0).values()];
    const total = poses.reduce((sum, pose) => sum + pose.volume + pose.braces.reduce((volume, brace) => volume + brace.volume, 0), 0);
    assert.ok(Math.abs(total - 3) < 1e-9, "detached forecast material remains in its own conserved component");
  } finally {
    context.destroy();
  }
});


it("does not reduce proactive bending depth when third material increases the frontier moment", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    const supported = (station) => station < 0;
    context.physics.sync(stations, supported, false, new Map(), new Map([[1, 1]]));
    context.physics.update(2);
    const before = context.physics.getPose(1);
    const ratio = before.thickness / before.width;
    stations.set(2, new pc.Vec3(2, 0, 0));
    context.physics.sync(stations, supported, false, new Map(), new Map([[2, 1]]));
    context.physics.update(2);
    const after = context.physics.getPose(1);
    assert.ok(after.thickness / after.width >= ratio - 1e-9, "a longer reach must not silently return the predecessor to a shallower bending profile");
    assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 3) < 1e-9);
  } finally {
    context.destroy();
  }
});


it("visibly concentrates actual material at the bank and into underside triangles before the third arrives", () => {
  const context = fixture();
  try {
    const supported = (station) => station < 0;
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, supported, false, new Map(), new Map([[0, 1]]));
    context.physics.update(2);
    const firstBefore = context.physics.getPose(0);
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, supported, false, new Map(), new Map([[1, 1]]));
    const secondBefore = context.physics.getPose(1);
    assert.equal(context.physics.getPose(0).preparation, 0, "new bearing must start a visible transition even though the first pad was already prepared");
    context.physics.update(0.9);
    const firstDuring = context.physics.getPose(0);
    const secondDuring = context.physics.getPose(1);
    assert.ok(firstDuring.volume > secondDuring.volume, "cantilever material must concentrate toward its actual bank");
    assert.ok(Math.abs(firstDuring.volume + secondDuring.volume + firstDuring.braces.reduce((volume, brace) => volume + brace.volume, 0) - 2) < 1e-9);
    assert.equal(firstDuring.redistribution.index, 0);
    assert.equal(firstDuring.redistribution.startVolume, firstBefore.volume);
    assert.equal(firstDuring.redistribution.volumeDelta, firstDuring.volume - firstBefore.volume);
    assert.equal(secondDuring.redistribution.index, 1);
    assert.equal(secondDuring.redistribution.count, 2);
    context.physics.update(1);
    const firstAfter = context.physics.getPose(0);
    const secondAfter = context.physics.getPose(1);
    assert.ok(firstAfter.width > secondAfter.width, "bank reservoir must remain broader than the narrowed outgoing span");
    assert.ok(firstAfter.thickness > firstBefore.thickness, "bank reservoir also deepens instead of disappearing");
    assert.ok(secondAfter.thickness > secondBefore.thickness * 1.2, "outgoing tissue must deepen while donating material into the real underside truss");
    assert.equal(secondAfter.redistribution, null);
    assert.equal(context.physics.getEntity(2), null);
    assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 2) < 1e-9);
  } finally {
    context.destroy();
  }
});


it("withholds the next binding until its exact forecast frontier has finished reshaping", () => {
  const context = fixture();
  try {
    const supported = (station) => station < 0;
    const stations = new Map([[0, new pc.Vec3()]]);
    context.physics.sync(stations, supported, false, new Map(), new Map([[0, 1]]));
    assert.equal(context.physics.isPreparationComplete(0, 1), false);
    context.physics.update(1.79);
    assert.equal(context.physics.isPreparationComplete(0, 1), false);
    context.physics.update(0.02);
    assert.equal(context.physics.isPreparationComplete(0, 1), true);
    assert.equal(context.physics.isPreparationComplete(0, -1), false, "the opposite bank direction is not the prepared frontier");
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, supported, false, new Map(), new Map([[1, 1]]));
    assert.equal(context.physics.isPreparationComplete(0, 1), false, "old frontier readiness cannot be reused");
    assert.equal(context.physics.isPreparationComplete(1, 1), false, "a new bearing starts its own visible redistribution interval");
    context.physics.update(1.81);
    assert.equal(context.physics.isPreparationComplete(1, 1), true);
  } finally {
    context.destroy();
  }
});


it("exposes only real native previous-link admission for connected redistribution artwork", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [2, new pc.Vec3(2, 0, 0)]]);
    const supported = (station) => station < 0;
    context.physics.sync(stations, supported, false);
    assert.equal(context.physics.getPose(0).linkedPrevious, false);
    assert.equal(context.physics.getPose(2).linkedPrevious, false, "adjacent-looking artwork cannot bridge a missing native link");
    stations.set(1, new pc.Vec3(1, 0, 0));
    context.physics.sync(stations, supported, false);
    assert.equal(context.physics.getPose(1).linkedPrevious, true);
    assert.equal(context.physics.getPose(2).linkedPrevious, true);
    stations.delete(1);
    context.physics.sync(stations, supported, false);
    assert.equal(context.physics.getPose(2).linkedPrevious, false, "removed material must remove stream connectivity evidence");
  } finally {
    context.destroy();
  }
});


it("allows verified bound traversal during modest load motion while rejecting unsafe native support", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const body = context.physics.getEntity(1);
    body.rigidbody.linearVelocity.set(0.4, 0.1, 0);
    body.rigidbody.angularVelocity.set(0, 0, 0.4);
    assert.equal(context.physics.getPlacementStatus(1), "pending");
    assert.equal(context.physics.isTraversalSafe(1), true, "a real bank-linked support can carry its bound worker while gently settling");
    body.rigidbody.linearVelocity.set(2.5, 0, 0);
    assert.equal(context.physics.isTraversalSafe(1), false);
    body.rigidbody.linearVelocity.set(0, 0, 0);
    body.rigidbody.angularVelocity.set(0, 0, 3.5);
    assert.equal(context.physics.isTraversalSafe(1), false);
    body.rigidbody.angularVelocity.set(0, 0, 0);
    body.setEulerAngles(0, 0, 60);
    assert.equal(context.physics.isTraversalSafe(1), false);
    body.setEulerAngles(0, 180, 0);
    assert.equal(context.physics.isTraversalSafe(1), false);
    body.setEulerAngles(0, 0, 0);
    context.physics.sync(stations, () => false, false);
    assert.equal(context.physics.isTraversalSafe(1), false, "upright but bankless material cannot grant a bound traversal exception");
    assert.equal(context.physics.isTraversalSafe(2), false);
  } finally {
    context.destroy();
  }
});


it("fails a persistently untraversable loaded predecessor instead of leaving a threshold deadzone", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const body = context.physics.getEntity(1);
    body.setEulerAngles(0, 0, -59.3);
    assert.ok(body.up.y > 0.5 && body.up.y < 0.65);
    assert.equal(context.physics.isTraversalSafe(1), false);
    context.physics.update(0.5);
    assert.equal(context.physics.getPlacementStatus(1), "pending", "short load response can still recover");
    context.physics.update(1.6);
    assert.equal(context.physics.getPlacementStatus(1), "failed", "an indefinitely frozen59-degree predecessor must be retried");
    assert.deepEqual(context.physics.getFailedStations(), [1]);
  } finally {
    context.destroy();
  }
});


for (const horizontal of [true, false]) {
  for (const fromEnd of [false, true]) {
    it("conserves anchor-heavy gel in real underside triangles over empty space " + horizontal + ":" + fromEnd, () => {
      const context = fixture(horizontal);
      try {
        const stations = new Map(Array.from({ length: 4 }, (_, station) => [station, new pc.Vec3(horizontal ? station : 0, 2, horizontal ? 0 : station)]));
        const supported = (station) => fromEnd ? station >= 4 : station < 0;
        const front = fromEnd ? 0 : 3;
        const direction = fromEnd ? -1 : 1;
        context.physics.sync(stations, supported, false, new Map(), new Map([[front, direction]]));
        for (const delta of [0.2, 0.4, 0.6, 0.7]) {
          context.physics.update(delta);
          const poses = [...context.physics.update(0).values()];
          const total = poses.reduce((sum, pose) => sum + pose.volume + pose.braces.reduce((volume, brace) => volume + brace.volume, 0), 0);
          assert.ok(Math.abs(total - 4) < 1e-9, "all deck and rod material must remain in the same finite pool");
          assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 4) < 1e-9);
        }
        const order = fromEnd ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const deckVolume = order.reduce((sum, station) => sum + context.physics.getPose(station).volume, 0);
        const reservoir = context.physics.getPose(order[0]);
        assert.ok(reservoir.volume > deckVolume * 0.5, "most actual deck material must form the adhesive bank reservoir");
        assert.ok(reservoir.width > context.physics.getPose(order[3]).width * 2, "the anchor collar must be unmistakably wider than the free tissue");
        assert.ok(context.physics.getEntity(order[0]).rigidbody.mass > ACTOR_MASS.LATCH_SLUG * deckVolume * 0.5, "anchor-heavy artwork must correspond to actual native mass");
        for (let index = 0; index < order.length - 1; index++) {
          const root = context.physics.getPose(order[index]);
          const tip = context.physics.getPose(order[index + 1]);
          assert.ok(root.volume > tip.volume, "actual bank side must contain monotonically more deck mass");
          assert.ok(root.width > tip.width, "gap tissue narrows away from the bank");
          assert.equal(root.anchorDirection, direction);
        }
        for (const station of order) {
          const pose = context.physics.getPose(station);
          const sections = fromEnd ? [...pose.sections].reverse() : pose.sections;
          assert.equal(sections.length, 3);
          assert.ok(sections[0].halfExtents.y > sections[2].halfExtents.y * 1.25, "every contributor including the second must deepen toward its own bearing side");
          const physicalVolume = sections.reduce((sum, section) => sum + 8 * section.halfExtents.x * section.halfExtents.y * section.halfExtents.z, 0);
          assert.ok(Math.abs(physicalVolume - pose.volume * 8 * 0.5 * 0.13 * 0.94) < 1e-9);
          for (const section of sections) {
            const height = context.physics.surfaceHeightAt(section.position.x, section.position.z);
            assert.ok(Math.abs(height - section.position.y - section.halfExtents.y) < 1e-6, "support queries must use real tapered faces rather than a uniform proxy");
          }
        }
        const braces = [...context.physics.update(0).values()].flatMap((pose) => pose.braces);
        assert.equal(braces.length, 9);
        assert.ok(braces.every((brace) => brace.start.distance(brace.end) > 0.3 && brace.mass > 0));
        const nativeJoints = [...context.joints].filter((joint) => joint.slimeTruss);
        assert.equal(nativeJoints.length, 30);
        assert.ok(nativeJoints.every((joint) => joint.args.length === 4), "every temporary member connects two real native bodies, never the world");
        context.physics.sync(stations, (station) => station < 0 || station >= 4, true);
        assert.equal(context.physics.connected, true);
        assert.ok([...context.physics.update(0).values()].every((pose) => pose.braces.length === 0));
        assert.equal(context.root.children.length, 4, "real rods are reclaimed when both physical banks connect");
        assert.ok(Math.abs(context.root.children.reduce((sum, entity) => sum + entity.rigidbody.mass, 0) - ACTOR_MASS.LATCH_SLUG * 4) < 1e-9);
      } finally {
        context.destroy();
      }
    });
  }
}


it("allows a committed upright truss to accept load during small real solver vibration", () => {
  const context = fixture();
  try {
    const stations = new Map([[0, new pc.Vec3()], [1, new pc.Vec3(1, 0, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false);
    const body = context.physics.getEntity(1);
    body.setEulerAngles(0, 0, -16);
    body.rigidbody.linearVelocity.set(-0.089, -0.141, 0.076);
    body.rigidbody.angularVelocity.set(-0.158, 0.064, -0.240);
    assert.equal(context.physics.getPlacementStatus(1), "pending", "candidate admission stays strictly stationary");
    assert.equal(context.physics.isLoadReady(1), true, "the recorded small upright truss jitter must not deadlock its next load");
    body.rigidbody.angularVelocity.set(0, 0, 0.6);
    assert.equal(context.physics.isLoadReady(1), false);
    body.rigidbody.angularVelocity.set(0, 0, 0);
    body.rigidbody.linearVelocity.set(0.4, 0, 0);
    assert.equal(context.physics.isLoadReady(1), false);
    body.rigidbody.linearVelocity.set(0, 0, 0);
    body.setEulerAngles(0, 0, 40);
    assert.equal(context.physics.isLoadReady(1), false);
    body.setEulerAngles(0, 0, 0);
    context.physics.sync(stations, () => false, false);
    assert.equal(context.physics.isLoadReady(1), false);
    assert.equal(context.physics.isLoadReady(2), false);
  } finally {
    context.destroy();
  }
});

it("adds only admitted bank donor units to native mass and returns exactly to the final even span", () => {
  const context = fixture();
  context.app.systems.rigidbody.raycastAll = (from) => from.x < 0 ? [{
    point: new pc.Vec3(from.x, 2, from.z),
    normal: pc.Vec3.UP,
  }] : [];
  try {
    const stations = new Map([[0, new pc.Vec3(0, 2, 0)], [1, new pc.Vec3(1, 2, 0)]]);
    const anchors = (station) => station < 0 || station > 1;
    context.physics.sync(stations, anchors, false);
    const permanentMass = 2 * ACTOR_MASS.LATCH_SLUG;
    assert.ok(Math.abs(context.root.children.reduce((sum, body) => sum + body.rigidbody.mass, 0) - permanentMass) < 1e-9);
    stations.set(-1, new pc.Vec3(-1, 2, 0));
    const pools = new Map([[-1, 3]]);
    context.physics.sync(stations, anchors, false, new Map(), new Map([[1, 1]]), pools);
    context.physics.update(2);
    const totalMass = context.root.children.reduce((sum, body) => sum + body.rigidbody.mass, 0);
    assert.ok(Math.abs(totalMass - 5 * ACTOR_MASS.LATCH_SLUG) < 1e-9, "native reservoir plus deck and truss conserve every admitted donor");
    assert.ok(context.physics.getEntity(-1).rigidbody.mass > 0);
    assert.equal(context.physics.getEntity(-1).rigidbody.mask, pc.BODYMASK_NOT_STATIC);
    assert.ok(context.physics.getPose(-1).volume > context.physics.getPose(1).volume,
      `the actual native root contains the thick pool: ${context.physics.getPose(-1).volume}/${context.physics.getPose(1).volume}, pins ${context.joints.size}`);
    assert.ok([...context.joints].some((joint) => joint.args[0] === context.physics.getEntity(-1).rigidbody.body), "reservoir is a constrained native participant");
    stations.delete(-1);
    context.physics.sync(stations, anchors, true);
    assert.equal(context.physics.getEntity(-1), null);
    assert.ok(Math.abs(context.root.children.reduce((sum, body) => sum + body.rigidbody.mass, 0) - permanentMass) < 1e-9);
    assert.equal(context.physics.getPose(0).volume, 1);
    assert.equal(context.physics.getPose(1).volume, 1);
    assert.equal(context.physics.getPose(0).thickness, context.physics.getPose(1).thickness);
    assert.equal(context.physics.getPose(0).width, context.physics.getPose(1).width);
  } finally {
    context.destroy();
  }
});

it("temporary bank material reinforces full permanent sections instead of scaling a starved free tip", () => {
  const context = fixture();
  try {
    const stations = new Map();
    for (let station = -1; station <= 3; station++) {
      stations.set(station, new pc.Vec3(station, 2, 0));
    }
    context.physics.sync(stations, (station) => station < 0, false,
      new Map(), new Map([[3, 1]]), new Map([[-1, 3]]));
    context.physics.update(2);
    for (let station = 0; station <= 3; station++) {
      assert.ok(context.physics.getPose(station).volume >= 1, "each permanent tile keeps a full donated section while extra gel supports the growing branch");
    }
    const total = context.root.children.reduce((sum, body) => sum + body.rigidbody.mass, 0);
    assert.ok(Math.abs(total - 7 * ACTOR_MASS.LATCH_SLUG) < 1e-9, "the stronger sections and native bracing still use exactly seven actual donors");
  } finally {
    context.destroy();
  }
});

it("bank funding grace is bounded and immediately loses protection without actual native anchoring", () => {
  for (const detached of [false, true]) {
    const context = fixture();
    context.app.systems.rigidbody.raycastAll = (from) => [{
      point: new pc.Vec3(from.x, 2, from.z),
      normal: pc.Vec3.UP,
    }];
    try {
      const stations = new Map([[-1, new pc.Vec3(-1, 2, 0)], [0, new pc.Vec3(0, 2, 0)], [1, new pc.Vec3(1, 2, 0)]]);
      let anchored = true;
      const support = (station) => anchored && station < 0;
      const pool = new Map([[-1, 1]]);
      context.physics.sync(stations, support, false, new Map(), new Map([[1, 1]]), pool, true);
      context.physics.getEntity(1).setEulerAngles(0, 0, -90);
      context.physics.update(2.1);
      assert.deepEqual(context.physics.getFailedStations(), [], "temporarily folding attached gel waits for its requested real mass");
      assert.equal(context.physics.isLoadReady(1), false, "grace never fabricates a traversable surface");
      if (detached) {
        anchored = false;
        context.physics.sync(stations, support, false, new Map(), new Map([[1, 1]]), pool, true);
        context.physics.update(2.1);
      } else {
        context.physics.update(30);
      }
      assert.ok(context.physics.getFailedStations().includes(1), detached ? "losing real bank contact revokes grace immediately" : "pending funding cannot suppress failure indefinitely");
    } finally {
      context.destroy();
    }
  }
});

it("funded but perpetually load-unsafe native tissue times out even without inversion", () => {
  const context = fixture();
  context.app.systems.rigidbody.raycastAll = (from) => from.x < 0 ? [{
    point: new pc.Vec3(from.x, 2, from.z),
    normal: pc.Vec3.UP,
  }] : [];
  try {
    const stations = new Map([[-1, new pc.Vec3(-1, 2, 0)], [0, new pc.Vec3(0, 2, 0)], [1, new pc.Vec3(1, 2, 0)]]);
    context.physics.sync(stations, (station) => station < 0, false,
      new Map(), new Map([[1, 1]]), new Map([[-1, 3]]));
    context.physics.getEntity(1).setEulerAngles(0, 0, -45);
    context.physics.update(2.1);
    assert.equal(context.physics.isTraversalSafe(1), true);
    assert.equal(context.physics.isLoadReady(1), false);
    assert.deepEqual(context.physics.getFailedStations(), []);
    for (let second = 0; second < 30; second++) {
      context.physics.update(1);
    }
    assert.ok(context.physics.getFailedStations().includes(1), "native capacity evidence cannot leave the next worker waiting forever between readiness thresholds");
  } finally {
    context.destroy();
  }
});

it("the first pool is one grounded native unit with no deck body and loses its pins when its own footprint vanishes", () => {
  const context = fixture();
  let ground = true;
  context.app.systems.rigidbody.raycastAll = (from) => ground && from.x >= -1.45 && from.x <= -0.55 ?
    [{
      point: new pc.Vec3(from.x, 2, from.z),
      normal: pc.Vec3.UP,
    }] : [];
  try {
    context.physics.sync(new Map([[-1, new pc.Vec3(-1, 2, 0)]]), (station) => station === -1, false,
      new Map(), new Map(), new Map([[-1, 1]]));
    const body = context.physics.getEntity(-1);
    assert.equal(body.rigidbody.mass, ACTOR_MASS.LATCH_SLUG);
    assert.equal(context.physics.getEntity(0), null);
    assert.equal(body.tags.has("hero-support-surface"), false);
    assert.ok(context.joints.size > 0, "real pins use the verified footprint, although another inland station is unsupported");
    assert.equal(context.physics.connected, false);
    ground = false;
    context.physics.update(2.1);
    assert.equal(context.joints.size, 0);
    assert.ok(context.physics.getFailedStations().includes(-1));
  } finally {
    context.destroy();
  }
});
