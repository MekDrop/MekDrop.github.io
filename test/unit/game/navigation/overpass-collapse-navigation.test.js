import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { MapObjectDefinitions } from "../../../../src/game/objects/MapObjectDefinitions.js";
import { WalkingPaths } from "../../../../src/game/navigation/WalkingPaths.js";
import { EnemyBridgeNavigation } from "../../../../src/game/navigation/EnemyBridgeNavigation.js";
import { ENEMY_TRAVERSAL } from "../../../../src/game/enum/EnemyTraversal.js";
import { DivecapRoute } from "../../../../src/game/objects/enemies/divecap/DivecapRoute.js";

/**
 * @param {boolean} oneSided
 */
function fixture(oneSided) {
  const filename = oneSided ? "overpass-collapse-one-sided.json" : "overpass-collapse.json";
  const map = JSON.parse(readFileSync(new URL(`../../../../src/game/maps/tests/${filename}`, import.meta.url), "utf8"));
  MapObjectDefinitions.prepare(map);
  map.overpassData.collapsed = true;
  for (const { col, row } of map.overpassData.crossingCells) {
    map.tileMeta[row][col].overpassCollapsed = true;
  }
  WalkingPaths.rebuild(map);

  return map;
}

/**
 * @param {Map<string, Set<string>>} graph
 * @param {string} start
 * @param {string} end
 * @returns {boolean}
 */
function connected(graph, start, end) {
  const seen = new Set([start]);
  const pending = [start];
  for (let index = 0; index < pending.length; index++) {
    for (const next of graph.get(pending[index]) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
    }
  }

  return seen.has(end);
}

for (const oneSided of [false, true]) {
  const stairs = oneSided ? "one stair approach" : "two stair approaches";
  it(`keeps only flight across the destroyed upper deck with ${stairs} and directs ground traffic down`, () => {
    const map = fixture(oneSided);
    const { graphs, drops, points, gaps } = map.enemyNavigation;
    const northLip = "13,13,4";
    const southLip = "13,17,4";
    const lowerGoal = "22,15,2";
    assert.equal(gaps.length, 4);
    assert.ok(gaps.every((gap) => gap.overpass && gap.elevation === 4));
    assert.equal(connected(graphs.get(ENEMY_TRAVERSAL.FLYING), northLip, southLip), true);
    assert.equal(drops.size, 2);
    for (const capability of [ENEMY_TRAVERSAL.WALKING, ENEMY_TRAVERSAL.JUMPING]) {
      const graph = graphs.get(capability);
      assert.equal(connected(graph, northLip, southLip), false);
      assert.equal(connected(graph, northLip, lowerGoal), true);
      assert.equal(connected(graph, southLip, lowerGoal), true);
      for (const [source, destinations] of drops) {
        for (const destination of destinations) {
          assert.equal(graph.get(source).has(destination), true);
          assert.equal(graph.get(destination).has(source), false);
          assert.equal(graphs.get(ENEMY_TRAVERSAL.FLYING).get(source).has(destination), false);
          assert.equal(points.get(source).elevation, 4);
          assert.equal(points.get(destination).elevation, 2);
          assert.equal(connected(graph, destination, source), false);
        }
      }
    }
  });

  it(`builds castle-directed walking routes through the one-way drop with ${stairs}`, () => {
    const map = fixture(oneSided);
    map.objects.push({
      id: "drop-entry",
      object: "Gateway",
      entry: {
        col: 6.5,
        rows: [6.5],
      },
    }, {
      id: "lower-castle",
      object: "Castle",
      navigation: {
        doors: [{
          centerCol: 11,
          centerRow: 7.5,
        }],
      },
    });
    WalkingPaths.rebuild(map);
    const route = map.paths[0].route;
    assert.ok(route.length > 3);
    assert.equal(route[0].elevation, 4);
    assert.equal(route.at(-1).elevation, 2);
    assert.equal(route.at(-1).col, 11);
    const firstLower = route.findIndex((point) => point.elevation === 2);
    assert.ok(firstLower > 0);
    assert.ok(route.slice(firstLower).every((point) => point.elevation === 2));
  });

  for (const capability of [ENEMY_TRAVERSAL.WALKING, ENEMY_TRAVERSAL.JUMPING]) {
    it(`steers ${capability} off the lip with ${stairs}, preserves real downward velocity, then continues on the lower path`, () => {
      const map = fixture(oneSided);
      const owner = {
        pc: { Vec3 },
        app: { systems: { rigidbody: { gravity: new Vec3(0, -9.81, 0) } } },
        runtime: { mapData: map },
        position: new Vec3(0.5, 4.05, -1.5),
        radius: 0.3,
        elapsed: 0,
        grounded: true,
        traversalCapability: capability,
        entity: { rigidbody: { linearVelocity: new Vec3(0, -0.4, 0) } },
      };
      const navigation = new EnemyBridgeNavigation(owner);
      const goal = new Vec3(5, 2, -0.5);
      const next = navigation.next(goal, 1.2);
      assert.ok(next.point);
      assert.equal(next.point.y, 2);
      assert.equal(owner.entity.rigidbody.linearVelocity.y, -0.4);
      assert.equal(owner.position.y, 4.05);
      assert.equal(owner.grounded, false);
      owner.position.set(next.point.x, 3, next.point.z);
      owner.entity.rigidbody.linearVelocity.y = -4;
      assert.equal(navigation.next(goal, 1.2).point, next.point);
      assert.equal(owner.entity.rigidbody.linearVelocity.y, -4);
      owner.position.y = 2.02;
      owner.grounded = true;
      assert.equal(navigation.next(goal, 1.2).point, goal);
      assert.equal(owner.entity.rigidbody.linearVelocity.y, -4);
    });
  }
}

it("never starts a jump across even one missing raised-overpass station", () => {
  const map = fixture(false);
  for (const cell of map.overpassData.crossingCells) {
    if (cell.row === 8) {
      map.tileMeta[cell.row][cell.col].overpassCollapsed = false;
    }
  }
  WalkingPaths.rebuild(map);
  const owner = {
    pc: { Vec3 },
    app: { systems: { rigidbody: { gravity: new Vec3(0, -9.81, 0) } } },
    runtime: { mapData: map },
    position: new Vec3(0.5, 4.05, -1.5),
    radius: 0.3,
    elapsed: 0,
    grounded: true,
    traversalCapability: ENEMY_TRAVERSAL.JUMPING,
    entity: { rigidbody: { linearVelocity: new Vec3(0, 0, 0) } },
  };
  const next = new EnemyBridgeNavigation(owner).next(new Vec3(5, 2, -0.5), 1.2);
  assert.equal(next.point?.y, 2);
  assert.equal(owner.entity.rigidbody.linearVelocity.y, 0);
});

it("hands Divecap's local same-floor planner over to the shared drop route until real landing", () => {
  const map = fixture(false);
  const owner = {
    pc: { Vec3 },
    app: { systems: { rigidbody: { gravity: new Vec3(0, -9.81, 0) } } },
    runtime: {
      mapData: map,
      collisionWorld: {
        isMovementBlocked: () => true,
      },
    },
    position: new Vec3(0.5, 4.05, -1.5),
    radius: 0.3,
    elapsed: 0,
    grounded: true,
    traversalCapability: ENEMY_TRAVERSAL.WALKING,
    entity: { rigidbody: { linearVelocity: new Vec3(0, -0.4, 0) } },
    get bridgeDropActive() {
      return shared.dropping;
    },
  };
  const shared = new EnemyBridgeNavigation(owner);
  const local = new DivecapRoute(owner);
  const goal = new Vec3(5, 2, -0.5);
  const handedOff = local.next(goal);
  assert.ok(handedOff);
  const drop = shared.next(handedOff, 1.05);
  assert.equal(drop.point.y, 2);
  assert.equal(owner.bridgeDropActive, true);
  owner.position.set(drop.point.x, 2.8, drop.point.z);
  // At this height the missing upper plane is outside the gap sweep. The
  // active drop still bypasses A* until the capsule actually reaches ground.
  const stillHandedOff = local.next(goal);
  assert.ok(stillHandedOff);
  assert.equal(shared.next(stillHandedOff, 1.05).point, drop.point);
  owner.position.y = 2.02;
  owner.grounded = true;
  shared.next(local.next(goal), 1.05);
  assert.equal(owner.bridgeDropActive, false);
  assert.equal(local.next(goal), null);
});
