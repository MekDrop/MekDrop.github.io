import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../../src/game/generator/castle/CastleGenerator.js";
import { createCastleStairFlight } from "../../../../../../src/game/objects/castle/stairs/CastleStairFlight.js";

it("aligns equal-depth entrance treads with the projecting doorway on every facing", async () => {
  for (const side of ["NORTH", "SOUTH", "EAST", "WEST"]) {
    const door = {
      side,
      offset: 12,
      width: 2,
      approachElevation: 2,
    };
    const plan = await CastleGenerator.generate({
      basePlanId: "castle-rear-bell-tower",
      position: {
        x: 3,
        z: -8,
        width: 16,
        depth: 18,
        elevation: 3,
      },
      doors: [door],
      seed: 1,
    });
    const adapted = plan.input.doors[0];
    const flight = createCastleStairFlight(plan.input.position, adapted);
    const opening = plan.metadata.runtime.residential.openings.find(item => item.exteriorEntrance);
    const threshold = plan.metadata.runtime.residential.walkableAreas.find(area => area.id.startsWith("doorThreshold:throne-hall"));
    assert.equal(adapted.stairBoundaryOffset, -opening.coordinate);
    assert.equal(door.stairBoundaryOffset, undefined, "Generation does not mutate the caller's doorway");
    assert.equal(flight.stepRun, 0.5);
    assert.equal(flight.stepHeight, 0.25);
    assert.equal(flight.run, flight.riseBlocks * flight.stepRun);
    // Entrance-local -Z points outside. The threshold owns the complete final
    // tread, beginning exactly one ordinary tread before the actual door plane.
    const finalTreadFront = -adapted.stairBoundaryOffset - flight.stepRun;
    assert.ok(Math.abs(threshold.minZ - finalTreadFront) < 1e-6, `${side}: threshold does not shorten the penultimate tread`);
    assert.ok(Math.abs(opening.coordinate - finalTreadFront - flight.stepRun) < 1e-6);
    const boundary = {
      NORTH: -8,
      SOUTH: 10,
      WEST: 3,
      EAST: 19,
    }[side];
    const sign = ["NORTH", "WEST"].includes(side) ? -1 : 1;
    assert.equal(flight.outerEdge, boundary + sign * (adapted.stairBoundaryOffset + flight.run));
  }
});
