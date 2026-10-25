import assert from "node:assert/strict";
import { it } from "node:test";
import * as pc from "playcanvas";
import { CastleResidentMotion } from "../../../../../../src/game/objects/castle/residents/CastleResidentMotion.js";
import { CastleAuthoredBuildPlan } from "../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { CastleResidentialLayout } from "../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { ResidentClearance } from "../../../../../../src/game/objects/castle/residents/ResidentClearance.js";

it("leaves either wall for the corridor center and still reaches exact endpoints", () => {
  for (const width of [1, 2, 3]) {
    for (const side of [0.125, width - 0.125]) {
      const entity = new pc.Entity();
      entity.setPosition(0.25, 0, side);
      const motion = new CastleResidentMotion({
        actor: {
          entity,
          pose: () => {},
        },
        layout: {
          origin: { y: 0 },
          walkableAreas: [{
            minX: 0,
            maxX: 8,
            minZ: 0,
            maxZ: width,
            floorY: 0,
          }],
          authoredStairs: [],
          stairs: null,
          toLocal: (x, z) => ({
            x,
            z,
          }),
          toWorld: (x, z, y) => ({
            x,
            y,
            z,
          }),
        },
        blocked: () => false,
        clear: () => true,
      });
      for (const x of [7.75, 0.25]) {
        motion.moveTo(new pc.Vec3(x, 0, side));
        let samples = 0;
        let previousHeading = null;
        for (let frame = 0; frame < 200 && !motion.arrived; frame++) {
          const before = entity.getPosition().clone();
          const beforeYaw = Math.atan2(entity.forward.x, entity.forward.z) * 180 / Math.PI;
          motion.update(0.1);
          const point = entity.getPosition();
          const yaw = Math.atan2(entity.forward.x, entity.forward.z) * 180 / Math.PI;
          const rotation = ((yaw - beforeYaw) % 360 + 540) % 360 - 180;
          assert.ok(Math.abs(rotation) <= 24.001, `turn rate: ${rotation}`);
          const movement = point.clone().sub(before);
          if (movement.length() > 0.03) {
            const heading = Math.atan2(movement.x, movement.z) * 180 / Math.PI;
            if (previousHeading !== null) {
              const bend = ((heading - previousHeading) % 360 + 540) % 360 - 180;
              assert.ok(Math.abs(bend) <= 45, `route bend: ${bend}, width ${width}, side ${side}, frame ${frame}, point ${point}`);
            }
            previousHeading = heading;
          }
          if (point.x > 3 && point.x < 5) {
            assert.ok(Math.abs(point.z - width / 2) <= 0.25,
              `width ${width}, side ${side}: ${point}`);
            samples++;
          }
        }
        assert.ok(samples > 0);
        assert.equal(motion.arrived, true);
        assert.ok(entity.getPosition().distance(new pc.Vec3(x, 0, side)) < 0.025);
      }
    }
  }
});

it("replans around new solid objects and returns to a raised seating home", () => {
  const entity = new pc.Entity();
  entity.setPosition(0, 0.167, 0.5);
  const layout = {
    origin: { y: 0 },
    walkableAreas: [{
      minX: 0,
      maxX: 2,
      minZ: 0,
      maxZ: 2,
      floorY: 0,
    }],
    authoredStairs: [],
    stairs: null,
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
  let occupied = () => false;
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: () => {},
    },
    layout,
    blocked: point => occupied(point),
    clear: () => true,
  });
  motion.moveTo(new pc.Vec3(1.5, 0, 0.5));
  occupied = point => point.x >= 0.4 && point.x <= 0.8 && point.z <= 0.9;
  let furthest = 0;
  for (let frame = 0; frame < 150 && !motion.arrived; frame++) {
    const before = entity.getPosition().clone();
    motion.update(0.1);
    const after = entity.getPosition().clone();
    for (let sample = 0; sample <= 10; sample++) {
      assert.equal(occupied(before.clone().lerp(before, after, sample / 10)), false);
    }
    furthest = Math.max(furthest, after.z);
  }
  assert.equal(motion.arrived, true);
  assert.ok(furthest > 0.9);
  motion.moveTo(motion.home);
  for (let frame = 0; frame < 150 && !motion.arrived; frame++) {
    motion.update(0.1);
    assert.equal(occupied(entity.getPosition()), false);
  }
  assert.equal(motion.arrived, true);
});

it("retains floor connections occupied by props during graph construction", () => {
  const entity = new pc.Entity();
  const layout = {
    origin: { y: 0 },
    walkableAreas: [{
      minX: 0,
      maxX: 2,
      minZ: 0,
      maxZ: 2,
      floorY: 0,
    }],
    authoredStairs: [],
    stairs: null,
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
  let closed = true;
  let homeBlocked = false;
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: () => {},
    },
    layout,
    blocked: (point, avoidDoors, includeProps = true) => includeProps &&
      ((closed && point.x > 0.4 && point.x < 0.8) || (homeBlocked && point.x < 0.3)),
    clear: () => true,
    homeArea: layout.walkableAreas[0],
  });
  motion.moveTo(new pc.Vec3(1.5, 0, 0));
  motion.update(0.1);
  assert.ok(entity.getPosition().equals(pc.Vec3.ZERO));
  closed = false;
  for (let frame = 0; frame < 100 && !motion.arrived; frame++) {
    motion.update(0.1);
  }
  assert.equal(motion.arrived, true);
  homeBlocked = true;
  motion.moveTo(motion.home);
  for (let frame = 0; frame < 100 && !motion.arrived; frame++) {
    motion.update(0.1);
  }
  assert.equal(motion.arrived, true);
  assert.ok(motion.home.x >= 0.3 && motion.home.x <= layout.walkableAreas[0].maxX);
  assert.equal(motion.home.y, 0);
});

it("walks existing residents through authored castle stairs and home without jumps", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const plan = await CastleAuthoredBuildPlan.generate({
      basePlanId: "castle-demo-compact",
      position: {
        x: -8,
        z: -14,
        width: 28,
        depth: 16,
        elevation: 3,
      },
      doors: [{
        side,
        offset: 8,
        width: 2,
      }],
      seed: 0,
    });
    const layout = new CastleResidentialLayout(plan);
    const blocks = plan.metadata.collision.cameraBlocks;
    const blocked = (point) => ResidentClearance.blockedByWalls(blocks, point, ResidentClearance.wallRadiusAt(layout, point));
    for (const room of [layout.rooms.work, layout.rooms.servantBedroom]) {
      const entity = new pc.Entity("Resident");
      const scene = new pc.Entity();
      scene._enabledInHierarchy = true;
      scene.addChild(entity);
      const home = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2,
        room.floorY - layout.origin.y);
      entity.setPosition(home.x, home.y, home.z);
      const actor = {
        entity,
        pose: () => {},
      };
      const motion = new CastleResidentMotion({
        actor,
        layout,
        blocked,
        clear: () => true,
      });
      const terrace = plan.metadata.runtime.terrace;
      const radians = terrace.yaw * Math.PI / 180;
      const target = new pc.Vec3(terrace.x + Math.sin(radians) * 0.7, terrace.y,
        terrace.z + Math.cos(radians) * 0.7);
      for (const destination of [target, motion.home]) {
        motion.moveTo(destination);
        const start = entity.getPosition().clone();
        assert.ok(entity.getPosition().equals(start));
        for (let frame = 0; frame < 3000 && !motion.arrived; frame++) {
          const before = entity.getPosition().clone();
          motion.update(0.1);
          assert.ok(entity.getPosition().distance(before) <= 0.120001);
        }
        assert.ok(motion.arrived, `${side} from floor ${room.floorY} reaches ${destination}`);
        assert.equal(actor.entity, entity);
        assert.equal(entity.enabled, true);
      }
    }
  }
});

it("holds position when a doorway blocks the route and resumes the same actor", () => {
  const entity = new pc.Entity();
  const layout = {
    origin: { y: 0 },
    walkableAreas: [{
      minX: 0,
      maxX: 2,
      minZ: 0,
      maxZ: 2,
      floorY: 0,
    }],
    authoredStairs: [],
    stairs: null,
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
  let open = false;
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: () => {},
    },
    layout,
    blocked: () => false,
    clear: () => open,
  });
  motion.moveTo(new pc.Vec3(1, 0, 1));
  motion.update(1);
  assert.ok(entity.getPosition().length() < 0.00001);
  assert.equal(motion.arrived, false);
  open = true;
  for (let index = 0; index < 100; index++) {
    motion.update(0.1);
  }
  assert.equal(motion.arrived, true);
});
import { TerraceRoyalActions } from "../../../../../../src/game/objects/castle/rooms/terrace/TerraceRoyalActions.js";
import { QueenLeisureBehavior } from "../../../../../../src/game/objects/castle/residents/QueenLeisureBehavior.js";
import { PrincessLeisureBehavior } from "../../../../../../src/game/objects/castle/residents/PrincessLeisureBehavior.js";
import { KingTrainingBehavior } from "../../../../../../src/game/objects/castle/residents/KingTrainingBehavior.js";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../../../../../src/game/enum/CastleTerracePhase.js";

for (const [kind, Behavior] of [["king", KingTrainingBehavior], ["queen", QueenLeisureBehavior], ["princess", PrincessLeisureBehavior]]) {
  it(`uses the ${kind}'s existing entity for both departure and return states`, () => {
    const scene = new pc.Entity();
    scene._enabledInHierarchy = true;
    const entity = new pc.Entity("Royal resident");
    scene.addChild(entity);
    const actor = {
      entity,
      height: 1.8,
      pose: () => {},
    };
    const stage = new pc.Entity("Terrace");
    stage.setPosition(3, 0, 3);
    scene.addChild(stage);
    const layout = {
      origin: { y: 0 },
      walkableAreas: [{
        minX: -1,
        maxX: 10,
        minZ: -1,
        maxZ: 10,
        floorY: 0,
      }],
      authoredStairs: [],
      stairs: null,
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
    class RoyalType {
      static kind = kind;
      constructor() {
        assert.fail("a terrace visit must reuse the resident model");
      }
    }
    const actions = new TerraceRoyalActions({
      RoyalType,
      pc,
      actor,
      stage,
      navigation: {
        layout,
        blocked: () => false,
        clear: () => true,
      },
    });
    const behavior = new Behavior(() => {});
    behavior.canComplete = () => ![PHASE.ROYAL_ENTER, PHASE.ROYAL_EXIT].includes(behavior.stagePhase) || actions.arrived;
    behavior.requested = true;
    if (behavior.wish) {
      behavior.fulfillWish(behavior.wish);
    }
    actions.sync(behavior);
    assert.ok(entity.getPosition().equals(pc.Vec3.ZERO), "entering a state cannot teleport the resident");
    behavior.update(100);
    assert.equal(behavior.stagePhase, PHASE.ROYAL_ENTER);
    for (let frame = 0; frame < 150; frame++) {
      actions.sync(behavior); actions.update(0.1); behavior.update(0.1);
    }
    assert.equal(behavior.stagePhase, PHASE.ACTIVITY);
    behavior.requested = false;
    for (let frame = 0; frame < 150; frame++) {
      actions.sync(behavior); actions.update(0.1); behavior.update(0.1);
    }
    assert.equal(behavior.onThrone, true);
    assert.ok(entity.getPosition().length() < 0.00001);
    assert.equal(actions.actor, actor);
    assert.equal(entity.enabled, true);
    actions.destroy();
    assert.equal(entity.parent, scene, "action cleanup cannot destroy the resident");
  });

}

it("replans around an opened leaf instead of forcing an actor through it", () => {
  const entity = new pc.Entity(); entity.setPosition(0, 0, 0.5);
  const layout = {
    origin: { y: 0 },
    walkableAreas: [{
      minX: 0,
      maxX: 2,
      minZ: 0,
      maxZ: 2,
      floorY: 0,
    }],
    authoredStairs: [],
    stairs: null,
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
  const occupied = (point) => point.x >= 0.4 && point.x <= 0.6 && point.z <= 0.8;
  const motion = new CastleResidentMotion({
    actor: {
      entity,
      pose: () => {},
    },
    layout,
    blocked: (point, avoidDoors) => avoidDoors && occupied(point),
    clear: (point) => !point || !occupied(point),
  });
  motion.moveTo(new pc.Vec3(1, 0, 0.5));
  let furthest = 0;
  for (let index = 0; index < 100 && !motion.arrived; index++) {
    motion.update(0.1);
    assert.equal(occupied(entity.getPosition()), false);
    furthest = Math.max(furthest, entity.getPosition().z);
  }
  assert.equal(motion.arrived, true);
  assert.ok(furthest > 0.8);
});


it("carries terrace equipment out of furnished basement storage and back in both mirrors", async () => {
  for (const seed of [2, 3]) {
    const plan = await CastleAuthoredBuildPlan.generate({
      basePlanId: "castle-demo-compact",
      position: {
        x: -8,
        z: -14,
        width: 28,
        depth: 16,
        elevation: 3,
      },
      doors: [{
        side: "NORTH",
        offset: 8,
        width: 2,
      }],
      seed,
    });
    const layout = new CastleResidentialLayout(plan);
    const furniture = plan.metadata.runtime.residential.furniture.filter(item => item.roomId === "storage-south" && !item.supportId);
    const blocks = plan.metadata.collision.cameraBlocks;
    const blocked = point => {
      const local = layout.toLocal(point.x, point.z);

      return ResidentClearance.blockedByWalls(blocks, point, ResidentClearance.wallRadiusAt(layout, point)) ||
        furniture.some(item => Math.abs(item.floorY - point.y) < 0.1 && Math.hypot(
          Math.max(0, Math.abs(local.x - item.x) - item.width * item.scale / 2),
          Math.max(0, Math.abs(local.z - item.z) - item.depth * item.scale / 2)) < 0.22);
    };
    const room = plan.layout.roomPlan.spaces.find(space => space.id === "storage-south");
    const home = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, room.floorY - layout.origin.y);
    const scene = new pc.Entity(); scene._enabledInHierarchy = true;
    const entity = new pc.Entity("Storage servant"); scene.addChild(entity);
    entity.setPosition(home.x, home.y, home.z);
    const motion = new CastleResidentMotion({
      actor: {
        entity,
        pose: () => {},
      },
      layout,
      blocked,
      clear: () => true,
    });
    const terrace = plan.metadata.runtime.terrace;
    const radians = terrace.yaw * Math.PI / 180;
    const target = new pc.Vec3(terrace.x + Math.sin(radians) * 0.7, terrace.y, terrace.z + Math.cos(radians) * 0.7);
    for (const destination of [target, motion.home]) {
      motion.moveTo(destination, "carry");
      for (let frame = 0; frame < 3000 && !motion.arrived; frame++) {
        motion.update(0.1);
      }
      assert.ok(motion.arrived, "storage servant completes the carrying route for seed " + seed);
    }
  }
});
