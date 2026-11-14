import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Vec3 } from "playcanvas";
import { LatchBridgeApproach } from "../../../../../../src/game/objects/enemies/latch-slug/LatchBridgeApproach.js";
import { LatchCompanionRoute } from "../../../../../../src/game/objects/enemies/latch-slug/LatchCompanionRoute.js";

/**
 * @param {number|null} nextHeight
 */
const fixture = (nextHeight) => {
  const tissue = { tags: { has: () => true } };
  const body = { linearVelocity: new Vec3(0, -0.2, 0) };
  let stopped = false;
  const owner = {
    pc: { Vec3 },
    position: new Vec3(),
    entity: { rigidbody: body },
    grounded: true,
    airborne: false,
    stop: () => {
      stopped = true;
    },
    faceTarget: () => {},
    app: {
      systems: {
        rigidbody: {
          gravity: new Vec3(0, -9.81, 0),
          raycastFirst: (start) => start.x > 0.1 ? nextHeight === null ? null : {
            entity: tissue,
            point: new Vec3(start.x, nextHeight, 0),
          } : {
            entity: tissue,
            point: new Vec3(),
          },
        },
      },
    },
  };

  return {
    owner,
    body,
    stopped: () => stopped,
  };
};

test("live tissue traversal keeps Ammo's vertical velocity on a supported slope", () => {
  const { owner, body } = fixture(0.1);
  assert.equal(LatchBridgeApproach.advance(owner, new Vec3(2, 0, 0)), true);
  assert.equal(body.linearVelocity.x, 0.9);
  assert.equal(body.linearVelocity.y, -0.2);
});

test("unreachable unsupported tissue stops without launching", () => {
  const { owner, body, stopped } = fixture(null);
  assert.equal(LatchBridgeApproach.advance(owner, new Vec3(2, 0, 0)), true);
  assert.equal(stopped(), true);
  assert.equal(owner.airborne, false);
  assert.equal(body.linearVelocity.x, 0);
});

test("a steep supported rise stops instead of launching toward tissue", () => {
  const { owner, body } = fixture(0.3);
  LatchBridgeApproach.advance(owner, new Vec3(2, 0, 0));
  assert.equal(owner.airborne, false);
  assert.equal(owner.grounded, true);
  assert.equal(body.linearVelocity.y, -0.2);
  body.linearVelocity.y = -1;
  LatchBridgeApproach.advance(owner, new Vec3(2, 0, 0));
  assert.equal(body.linearVelocity.y, -1);
});

test("a lower hanging tip never authorizes a jump even with a distant surface hit", () => {
  const { owner, body } = fixture(null);
  owner.app.systems.rigidbody.raycastFirst = (start) => {
    if (start.x < 0.1) {
      return {
        entity: { rigidbody: { type: "static" } },
        point: new Vec3(),
      };
    }
    if (start.x > 1.5) {
      return {
        entity: { tags: { has: () => true } },
        normal: new Vec3(0, 1, 0),
        point: new Vec3(2, -1, 0),
      };
    }

    return null;
  };
  assert.equal(LatchBridgeApproach.advance(owner, new Vec3(2, -1, 0)), true);
  assert.equal(owner.airborne, false);
  assert.equal(owner.grounded, true);
  assert.equal(body.linearVelocity.x, 0);
  assert.equal(body.linearVelocity.y, -0.2);
});

test("a diagonally offset worker can reach the first tissue contact from the real bank surface", () => {
  const { owner, body } = fixture(null);
  owner.position.set(-3.68, 2, 6.5);
  owner.app.systems.rigidbody.raycastFirst = (start) => ({
    entity: { rigidbody: { type: "static" } },
    point: new Vec3(start.x, 2, start.z),
  });
  assert.equal(LatchBridgeApproach.advance(owner, new Vec3(-2.5, 2, 7)), true);
  assert.ok(body.linearVelocity.x > 0);
  assert.ok(body.linearVelocity.z > 0);
  assert.equal(body.linearVelocity.y, -0.2);
  assert.equal(owner.airborne, false);
});

test("the saved two-lane bank permits a physically supported grass sidestep without allowing cliffs or occupied space", () => {
  const map = JSON.parse(readFileSync(new URL("../../../../../../src/game/maps/tests/slime-bridge-span.json", import.meta.url), "utf8"));
  const { owner, body } = fixture(null);
  owner.position.set(-4.8, 2, 6.55);
  owner.radius = 0.42;
  owner.height = 0.84;
  owner.runtime = { mapData: map };
  owner.actors = [];
  owner.targetPosition = (actor) => actor.position;
  owner.app.systems.rigidbody.raycastFirst = (from, to) => {
    if (from.y <= to.y) {
      return null;
    }
    const col = Math.round(from.x + (map.cols - 1) / 2);
    const row = Math.round(from.z + (map.rows - 1) / 2);
    const height = map.heightmap[row]?.[col];
    if (!map.grid[row]?.[col] || height > from.y || height < to.y) {
      return null;
    }

    return {
      entity: { rigidbody: { type: "static" } },
      point: new Vec3(from.x, height, from.z),
      normal: new Vec3(0, 1, 0),
    };
  };
  const requester = { position: new Vec3(-5.7, 2, 6.55) };
  const grass = new Vec3(-4.8, 2, 5.55);
  assert.equal(new LatchCompanionRoute(owner, () => false).clearSegment(grass, requester), false,
    "ordinary social navigation deliberately stays within the two path lanes");
  const dormant = {
    position: grass.clone(),
    radius: 0.42,
    isBridgeCommitted: true,
    entity: { rigidbody: { enabled: false } },
  };
  owner.actors.push(dormant);
  assert.equal(LatchBridgeApproach.clearPeerStep(owner, grass, requester), true);
  assert.equal(LatchBridgeApproach.clearPeerStep(owner, new Vec3(-4.8, 2, 4.55), requester), false,
    "full-footprint ground checks reject the cliff beyond the raised bank");
  owner.actors.push({
    position: grass.clone(),
    radius: 0.42,
  });
  assert.equal(LatchBridgeApproach.clearPeerStep(owner, grass, requester), false);
  owner.actors.pop();
  owner.position.set(-6.7, 2, 6.55);
  assert.equal(LatchBridgeApproach.advance(owner, new Vec3(-2.5, 2, 6.55)), true,
    "distant bank travel must not fall back into the blocked social planner");
  assert.ok(body.linearVelocity.x > 0);
});
