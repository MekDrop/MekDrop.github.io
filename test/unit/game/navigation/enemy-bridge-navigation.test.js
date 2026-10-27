import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { WalkingPaths } from "../../../../src/game/navigation/WalkingPaths.js";
import { EnemyBridgeNavigation } from "../../../../src/game/navigation/EnemyBridgeNavigation.js";
import { ENEMY_TRAVERSAL } from "../../../../src/game/enum/EnemyTraversal.js";

/**
 * @param {number} length
 * @param {boolean} horizontal
 */
function fixture(length = 1, horizontal = true) {
  const cols = horizontal ? 9 : 2;
  const rows = horizontal ? 2 : 9;
  const map = {
    cols,
    rows,
    grid: Array.from({ length: rows }, () => Array(cols).fill(2)),
    heightmap: Array.from({ length: rows }, () => Array(cols).fill(2)),
    tileMeta: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({}))),
    objects: [],
  };
  for (let station = 4; station < 4 + length; station++) {
    for (let lane = 0; lane < 2; lane++) {
      map.tileMeta[horizontal ? lane : station][horizontal ? station : lane] = {
        direction: horizontal ? "EAST" : "SOUTH",
        renderMode: "BRIDGE",
        bridgeCollapsed: true,
      };
    }
  }
  WalkingPaths.rebuild(map);

  return map;
}

/**
 * @param {Map<string,Set<string>>} graph
 * @param {string} start
 * @param {string} end
 */
function connected(graph, start, end) {
  const seen = new Set([start]);
  const pending = [start];
  for (let index = 0; index < pending.length; index++) {
    for (const neighbor of graph.get(pending[index]) ?? []) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        pending.push(neighbor);
      }
    }
  }

  return seen.has(end);
}

it("splits walkers, preserves flight, and limits jumps to one missing station in both orientations", () => {
  for (const horizontal of [false, true]) {
    for (const length of [1, 2, 4]) {
      const map = fixture(length, horizontal);
      const start = horizontal ? "0,1,2" : "1,0,2";
      const end = horizontal ? "16,1,2" : "1,16,2";
      assert.equal(connected(map.enemyNavigation.graphs.get(ENEMY_TRAVERSAL.WALKING), start, end), false);
      assert.equal(connected(map.enemyNavigation.graphs.get(ENEMY_TRAVERSAL.FLYING), start, end), true);
      assert.equal(connected(map.enemyNavigation.graphs.get(ENEMY_TRAVERSAL.JUMPING), start, end), length === 1);
      assert.equal(JSON.stringify(map).includes("enemyNavigation"), false);
    }
  }
});

/**
 * @param {ReturnType<typeof fixture>} map
 * @param {string} capability
 * @param {number} x
 */
function ownerFixture(map, capability, x = -2) {
  return {
    pc: { Vec3 },
    app: { systems: { rigidbody: { gravity: new Vec3(0, -9.81, 0) } } },
    runtime: { mapData: map },
    position: new Vec3(x, 2, 0),
    radius: 0.3,
    elapsed: 0,
    grounded: true,
    traversalCapability: capability,
    entity: { rigidbody: { linearVelocity: new Vec3() } },
  };
}

it("walkers approach the lip and wait instead of steering across a severed route", () => {
  const owner = ownerFixture(fixture(), ENEMY_TRAVERSAL.WALKING);
  const navigation = new EnemyBridgeNavigation(owner);
  const goal = new Vec3(4, 2, 0);
  const first = navigation.next(goal, 1.2);
  assert.ok(first.point.x > owner.position.x);
  owner.position.x = -1;
  assert.equal(navigation.next(goal, 1.2).point, null);
});

it("flying steering crosses wide gaps and one-tile jumping launches an engine-driven arc", () => {
  const goal = new Vec3(4, 2, 0);
  const flying = ownerFixture(fixture(3), ENEMY_TRAVERSAL.FLYING);
  assert.equal(new EnemyBridgeNavigation(flying).next(goal, 1.2).point, goal);
  const jumper = ownerFixture(fixture(), ENEMY_TRAVERSAL.JUMPING, -0.85);
  const navigation = new EnemyBridgeNavigation(jumper);
  const next = navigation.next(goal, 3.2);
  assert.ok(next.point.x > 1);
  assert.ok(jumper.entity.rigidbody.linearVelocity.y > 3);
  assert.equal(jumper.grounded, false);
  jumper.elapsed = 0.1;
  assert.equal(navigation.next(goal, 3.2).point, next.point);
  const blocked = ownerFixture(fixture(2), ENEMY_TRAVERSAL.JUMPING, -1);
  const waiting = new EnemyBridgeNavigation(blocked).next(goal, 3.2);
  assert.equal(waiting.point, null);
  assert.equal(blocked.entity.rigidbody.linearVelocity.y, 0);
});

it("rebuilding a restored deck restores every capability graph", () => {
  const map = fixture(3);
  for (const row of map.tileMeta) {
    for (const meta of row) {
      meta.bridgeCollapsed = false;
    }
  }
  WalkingPaths.rebuild(map);
  assert.equal(map.enemyNavigation.gaps.length, 0);
  for (const graph of map.enemyNavigation.graphs.values()) {
    assert.equal(connected(graph, "0,1,2", "16,1,2"), true);
  }
});

it("a descending jumper cannot take off again without actual ground contact", () => {
  const owner = ownerFixture(fixture(), ENEMY_TRAVERSAL.JUMPING, -0.85);
  owner.grounded = false;
  owner.entity.rigidbody.linearVelocity.y = -2;
  assert.equal(new EnemyBridgeNavigation(owner).next(new Vec3(4, 2, 0), 3.2).point, null);
  assert.equal(owner.entity.rigidbody.linearVelocity.y, -2);
});

it("reserves the whole collapsing span immediately and keeps replanning through every falling station", () => {
  for (const length of [1, 3, 6]) {
    const map = fixture();
    map.cols = 13;
    for (let row = 0; row < map.rows; row++) {
      map.grid[row].push(2, 2, 2, 2);
      map.heightmap[row].push(2, 2, 2, 2);
      map.tileMeta[row].push({}, {}, {}, {});
      for (let col = 4; col < 4 + length; col++) {
        map.tileMeta[row][col] = {
          direction: "EAST",
          renderMode: "BRIDGE",
          bridgeCollapsed: false,
          bridgeCollapsing: true,
        };
      }
    }
    let previous = null;
    // At the first impact only one station has physically fallen. Even then,
    // a jumper must not aim for a landing that belongs to the collapsing span.
    for (let station = 4; station < 4 + length; station++) {
      for (let row = 0; row < map.rows; row++) {
        map.tileMeta[row][station].bridgeCollapsed = true;
        map.tileMeta[row][station].bridgeCollapsing = false;
      }
      WalkingPaths.rebuild(map);
      const navigation = map.enemyNavigation;
      assert.notEqual(navigation, previous);
      previous = navigation;
      assert.equal(navigation.gaps.length, length * 2);
      assert.equal(connected(navigation.graphs.get(ENEMY_TRAVERSAL.WALKING), "0,1,2", "24,1,2"), false);
      assert.equal(connected(navigation.graphs.get(ENEMY_TRAVERSAL.FLYING), "0,1,2", "24,1,2"), true);
      assert.equal(connected(navigation.graphs.get(ENEMY_TRAVERSAL.JUMPING), "0,1,2", "24,1,2"), length === 1);
    }
  }
});

it("removes floating transverse graph stubs between neighboring missing tiles", () => {
  for (const horizontal of [false, true]) {
    const map = fixture(4, horizontal);
    const navigation = map.enemyNavigation;
    for (const [key, point] of navigation.points) {
      const along = horizontal ? point.col : point.row;
      if (along <= 3.5 || along >= 7.5) {
        continue;
      }
      assert.equal(navigation.graphs.get(ENEMY_TRAVERSAL.WALKING).get(key).size, 0, key);
      assert.equal(navigation.graphs.get(ENEMY_TRAVERSAL.JUMPING).get(key).size, 0, key);
      assert.ok(navigation.graphs.get(ENEMY_TRAVERSAL.FLYING).get(key).size > 0, key);
    }
  }
});
