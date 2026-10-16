import assert from "node:assert/strict";
import { test } from "node:test";
import { CastleBrazierMapObjects } from "../../../../../../src/game/objects/castle-props/brazier/CastleBrazierMapObjects.js";

test("castle bowls keep placement, phase and footprint island through repeat preparation and regeneration", () => {
  const flames = [{
    x: -4,
    y: 3,
    z: 2,
    scale: 0.3,
  }, {
    x: 4,
    y: 6,
    z: 2,
    scale: 0.2,
  }];
  const castle = {
    id: "castle",
    object: "Castle",
    buildPlan: {
      input: {
        position: {
          x: -2,
          z: -3,
        },
      },
      geometry: { decorations: { flames } },
    },
  };
  const authored = {
    id: "authored",
    object: "Brazier",
  };
  const map = {
    cols: 20,
    rows: 20,
    objects: [castle, authored],
  };
  CastleBrazierMapObjects.prepareMap(map);
  CastleBrazierMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 4);
  const bowls = map.objects.filter(item => item.castleBrazier);
  for (const [index, bowl] of bowls.entries()) {
    assert.equal(bowl.object, "Brazier");
    assert.deepEqual(bowl.position, {
      x: flames[index].x,
      y: flames[index].y,
      z: flames[index].z,
    });
    assert.deepEqual(bowl.tile, {
      col: 8,
      row: 7,
    });
    assert.equal(bowl.scale, flames[index].scale);
    assert.equal(bowl.phase, index * 1.713 + flames[index].x * 0.37 + flames[index].z * 0.53);
    assert.equal(bowl.sourceCastleId, castle.id);
  }
  flames.pop();
  CastleBrazierMapObjects.prepareMap(map);
  assert.equal(map.objects.length, 3);
  assert.ok(map.objects.includes(authored));
});
