import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

// Authored castles change the reserved foundation and entrance route.
// Preserve both full results and routing for the new authored-plan contract.
const baselines = JSON.parse(
  readFileSync(new URL("./fixtures/authored-castle-seeds.json", import.meta.url)),
);

describe("map generation authored-castle compatibility", () => {
  for (const { options, sha256, routingSha256, error } of baselines) {
    it(`preserves the complete result for ${options.mapName}`, async () => {
      if (error) {
        await assert.rejects(MapGenerator.generate({ ...options, islandConnectors: false }), error);
        return;
      }

      // Keep connector generation independent of this castle baseline.
      const map = await MapGenerator.generate({ ...options, islandConnectors: false });
      // Terrain is now published as object records; compare the original
      // generation contract independently of this derived rendering metadata.
      map.objects = map.objects.filter(({ generated }) => !generated);
      delete map.renderCommands;
      const serialized = JSON.stringify(map, (_key, value) => {
        if (value instanceof Map) {
          return { mapEntries: [...value] };
        }
        if (value instanceof Set) {
          return { setValues: [...value] };
        }
        return value;
      });
      assert.equal(createHash("sha256").update(serialized).digest("hex"), sha256);
      const routing = JSON.stringify(
        { routes: map.paths.map((path) => path.route), arrowData: map.arrowData },
        (_key, value) => value instanceof Map ? { mapEntries: [...value] } : value,
      );
      assert.equal(createHash("sha256").update(routing).digest("hex"), routingSha256);
    });
  }
});
