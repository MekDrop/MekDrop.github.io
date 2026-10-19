import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredMapObjects } from "../../../../../../src/game/objects/castle/structure/CastleAuthoredMapObjects.js";

it("publishes castle fixtures once and replaces them when the plan changes", () => {
  const fixture = {
    id: "tower-lower-stairs",
    object: "SpiralStaircase",
    position: {
      x: 4,
      y: 2,
      z: 6,
    },
    Z1: 2,
    Z2: 6,
  };
  const castle = {
    id: "castle",
    object: "Castle",
    buildPlan: {
      input: {
        position: {
          x: -8,
          z: -9,
        },
      },
      metadata: { runtime: { authoredObjects: [fixture] } },
    },
  };
  const map = {
    cols: 44,
    rows: 44,
    objects: [castle],
  };
  CastleAuthoredMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 2);
  assert.equal(map.objects[1].sourceCastleId, castle.id);
  assert.deepEqual(map.objects[1].position, fixture.position);
  CastleAuthoredMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 2);
  fixture.position.x = 12;
  CastleAuthoredMapObjects.prepareMap(map);
  assert.equal(map.objects[1].position.x, 12);
  castle.buildPlan.metadata.runtime.authoredObjects = [];
  CastleAuthoredMapObjects.prepareMap(map);
  assert.deepEqual(map.objects, [castle]);
});
