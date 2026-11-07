import assert from "node:assert/strict";
import { it } from "node:test";
import { Vec3 } from "playcanvas";
import { LatchCompanionRoute } from "../../../../../../src/game/objects/enemies/latch-slug/LatchCompanionRoute.js";
import { SceneObjectRegistry } from "../../../../../../src/game/rendering/scene/SceneObjectRegistry.js";

it("indexes social occupancy once per scene revision rather than once per search point", () => {
  const { owner, human, front } = fixture();
  const route = new LatchCompanionRoute(owner, () => false);
  const expected = route.next(human);
  const objects = new SceneObjectRegistry();
  let reads = 0;
  const terrain = {
    get affection() {
      reads++;

      return null;
    },
  };
  for (let index = 0; index < 1000; index++) {
    objects.add("terrain", terrain);
  }
  objects.add("slug", front);
  owner.runtime.objects = objects;
  for (let query = 0; query < 5; query++) {
    assert.deepEqual(route.next(human), expected);
  }
  assert.equal(reads, 1000);
  objects.remove(front);
  owner.actors = [];
  const indexed = route.next(human);
  delete owner.runtime.objects;
  assert.deepEqual(indexed, route.next(human));
  assert.equal(reads, 2000);
});

it("bounds failed detour retries and rejects a cached waypoint immediately when its collision changes", () => {
  const { owner, human, front } = fixture();
  const objects = new SceneObjectRegistry();
  objects.add("slug", front);
  owner.runtime.objects = objects;
  owner.elapsed = 0;
  let blocked = true;
  let queries = 0;
  const route = new LatchCompanionRoute(owner, () => {
    queries++;

    return blocked;
  });
  assert.equal(route.next(human), null);
  const firstSearchQueries = queries;
  assert.ok(firstSearchQueries > 0);
  owner.elapsed = 0.1;
  assert.equal(route.next(human), null);
  assert.equal(queries, firstSearchQueries);
  owner.elapsed = 0.26;
  blocked = false;
  assert.ok(route.next(human));
  owner.elapsed = 0.27;
  blocked = true;
  assert.equal(route.next(human), null);
  owner.elapsed = 0.28;
  blocked = false;
  objects.add("actor", {});
  assert.ok(route.next(human), "scene changes invalidate a failed search immediately");
});

function fixture() {
  const human = { position: new Vec3(0, 0, 0) };
  const front = {
    position: new Vec3(1.1, 0, 0),
    affection: {},
    radius: 0.42,
  };
  const owner = {
    position: new Vec3(2.2, 0, 0),
    radius: 0.42,
    actors: [front],
    runtime: {
      mapData: {
        cols: 11,
        rows: 7,
        grid: Array.from({ length: 7 }, (_, row) => Array(11).fill(row === 3 || row === 4 ? 2 : 1)),
      },
    },
    targetPosition: actor => actor.position,
  };

  return {
    owner,
    human,
    front,
  };
}

it("changes lanes to pass a settled slime and reach an empty place beside the human", () => {
  const { owner, human, front } = fixture();
  const route = new LatchCompanionRoute(owner, () => false);
  let changedLane = false;
  for (let step = 0; step < 16; step++) {
    const next = route.next(human);
    assert.ok(next, "the open lane must provide a route");
    assert.ok(next.distance(front.position) >= 0.92);
    assert.ok(next.z >= -0.08 && next.z <= 1.08, "the entire slime stays on the path");
    changedLane ||= next.z >= 0.5;
    if (next.distance(owner.position) < 0.01) {
      break;
    }
    owner.position.copy(next);
  }
  assert.equal(changedLane, true);
  assert.ok(owner.position.distance(human.position) <= 1.2);
});

it("rejects blocked lanes instead of routing across grass or through another floor", () => {
  const { owner, human } = fixture();
  assert.equal(new LatchCompanionRoute(owner, () => true).next(human), null);
  owner.runtime.mapData.heightmap = Array.from({ length: 7 }, () => Array(11).fill(2));
  assert.equal(new LatchCompanionRoute(owner, () => false).next(human), null);
});

it("can leave a touching queue to change lanes without moving into its neighbour", () => {
  const { owner, human, front } = fixture();
  owner.position.set(2, 0, 0);
  front.position.x = 1.16;
  const route = new LatchCompanionRoute(owner, point => point.x > 2);
  for (let step = 0; step < 160 && owner.position.distance(human.position) > 1.2; step++) {
    const next = route.next(human);
    assert.ok(next, "contact spacing must not trap the slime inside the steering margin");
    assert.ok(next.distance(owner.position) > 0.025);
    const previousDistance = owner.position.distance(front.position);
    owner.position.lerp(owner.position, next, Math.min(1, 0.04 / next.distance(owner.position)));
    assert.ok(owner.position.distance(front.position) >= Math.min(previousDistance, 0.92) - 1e-6);
  }
  assert.ok(owner.position.distance(human.position) <= 1.2);
});

it("closes an open gap in the same lane and settles when forward clearance is blocked", () => {
  const { owner, human } = fixture();
  owner.actors = [];
  owner.position.set(1.5, 0, 0);
  const route = new LatchCompanionRoute(owner, () => false);
  assert.deepEqual(route.laneStep(human), new Vec3(1.25, 0, 0));
  assert.deepEqual(route.next(human), new Vec3(1.25, 0, 0));
  owner.position.copy(route.next(human));
  owner.position.copy(route.next(human));
  assert.equal(owner.position.z, 0);
  assert.equal(route.laneStep(human), null);
  owner.position.set(1.5, 0, 0);
  const blocked = new LatchCompanionRoute(owner, () => true);
  assert.equal(blocked.laneStep(human), null);
  assert.deepEqual(blocked.next(human), owner.position);
});

it("takes the free side around an affectionate slime even inside the social stopping radius", () => {
  const { owner, human, front } = fixture();
  owner.position.set(1.3, 0, 0.9);
  front.position.set(0.95, 0, 0);
  const route = new LatchCompanionRoute(owner, () => false);
  assert.equal(route.laneStep(human), null, "the direct approach is occupied");
  for (let step = 0; step < 24 && owner.position.distance(human.position) > 1.2; step++) {
    const next = route.next(human);
    assert.ok(next, "the opposite side remains reachable on the path");
    assert.ok(next.distance(owner.position) > 0.025, "social range must not stop the detour early");
    assert.ok(next.distance(front.position) >= 0.92);
    owner.position.copy(next);
  }
  assert.ok(owner.position.distance(human.position) <= 1.2);
});
