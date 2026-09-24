import assert from "node:assert/strict";
import { it } from "node:test";

import { GATEWAY_COLORS } from "../../src/game/config/gateway.js";
import { MapGenerator } from "../../src/game/MapGenerator.js";

it("stores each gateway color in the generated map", () => {
  const map = MapGenerator.generate({
    mapName: "variant-4",
    numPaths: 4,
    numRivers: 0,
    overpass: true,
  });

  assert.equal(map.entries.length, GATEWAY_COLORS.length);
  assert.deepEqual(
    map.entries.map((entry) => entry.color),
    GATEWAY_COLORS,
  );
});
