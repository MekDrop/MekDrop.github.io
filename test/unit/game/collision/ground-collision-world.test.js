import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GroundCollisionWorld } from "../../../../src/game/collision/GroundCollisionWorld.js";

describe("ground collision world physics surfaces", () => {
  it("keeps dynamic blockers out of the static physics surface", () => {
    const world = new GroundCollisionWorld();
    const terrain = { surfaceHeightAt: () => 2 };
    const vegetation = { surfaceHeightAt: () => 4 };

    world.add(terrain);
    world.add(vegetation, { physicsSurface: false });

    assert.equal(world.surfaceHeightAt(0, 0), 4);
    assert.equal(world.physicsSurfaceHeightAt(0, 0), 2);
  });

  it("clears both collision and physics surface registrations", () => {
    const world = new GroundCollisionWorld();
    world.add({ surfaceHeightAt: () => 2 });

    world.clear();

    assert.equal(world.surfaceHeightAt(0, 0), null);
    assert.equal(world.physicsSurfaceHeightAt(0, 0), null);
  });

  it("delegates movement repulsion to registered colliders", () => {
    const world = new GroundCollisionWorld();
    world.add({ repulsionForMovement: () => null });
    world.add({
      repulsionForMovement: (fromX, fromZ, toX, toZ, radius) => ({
        x: toX - fromX + radius,
        z: toZ - fromZ,
      }),
    });

    assert.deepEqual(world.movementRepulsionFor(1, 2, 4, 6, 0.5), {
      x: 3.5,
      z: 4,
    });
  });

  it("uses movement-specific collision depth only while moving", () => {
    const world = new GroundCollisionWorld();
    world.add({
      collisionDepthAt: () => 0,
      movementCollisionDepthAt: () => 0.2,
    });

    assert.equal(world.isBlocked(0, 0, 0.18, 0, 0.22), false);
    assert.equal(
      world.isMovementBlocked(-1, 0, 0, 0, 0.18, 0, 0.22),
      true,
    );
  });

  it("delegates free-camera collision to registered colliders", () => {
    const world = new GroundCollisionWorld();
    const calls = [];
    world.add({
      blocksCameraAt: (x, y, z, radius) => {
        calls.push({ x, y, z, radius });
        return x + radius >= 2;
      },
    });

    assert.equal(world.isCameraBlocked(1, 3, 4, 0.25), false);
    assert.equal(world.isCameraBlocked(1.8, 3, 4, 0.25), true);
    assert.deepEqual(calls, [
      { x: 1, y: 3, z: 4, radius: 0.25 },
      { x: 1.8, y: 3, z: 4, radius: 0.25 },
    ]);
  });
});

it("passes a support height limit to objects with stacked floors", () => {
  const world = new GroundCollisionWorld();
  world.add({ surfaceHeightAt: (x, z, radius, maximumHeight) =>
    maximumHeight < 4 ? 2 : 4 }, { physicsSurface: false });
  assert.equal(world.surfaceHeightAt(1, 1, 0, 2.3), 2);
  assert.equal(world.surfaceHeightAt(1, 1), 4);
  assert.equal(world.physicsSurfaceHeightAt(1, 1), null);
});
