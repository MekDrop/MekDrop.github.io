import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GroundCollisionWorld } from "../../src/game/collision/GroundCollisionWorld.js";

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
});
