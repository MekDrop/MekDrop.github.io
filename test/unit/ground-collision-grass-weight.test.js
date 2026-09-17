import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GroundCollisionWorld } from "../../src/game/collision/GroundCollisionWorld.js";

describe("ground collision grass weight", () => {
  it("uses a collider's explicit grass weight", () => {
    const world = new GroundCollisionWorld();
    world.add({
      grassWeightAt: (x) => (x === 1 ? 0.4 : 0),
    });

    assert.equal(world.grassWeightAt(1, 2, 3), 0.4);
    assert.equal(world.grassWeightAt(0, 2, 3), 0);
  });

  it("lets an explicit zero weight preserve grass inside broader collision bounds", () => {
    const world = new GroundCollisionWorld();
    world.add({
      grassWeightAt: () => 0,
      intersectsGroundFootprint: () => true,
    });

    assert.equal(world.grassWeightAt(0, 0, 2), 0);
  });

  it("treats an ordinary solid collider as fully weighted", () => {
    const world = new GroundCollisionWorld();
    world.add({ intersectsGroundFootprint: () => true });

    assert.equal(world.grassWeightAt(0, 0, 2), 1);
  });

  it("allows a solid collider to define a lighter global weight", () => {
    const world = new GroundCollisionWorld();
    world.add({
      grassWeight: 0.25,
      blocksMovementAt: () => true,
    });

    assert.equal(world.grassWeightAt(0, 0, 2), 0.25);
  });
});
