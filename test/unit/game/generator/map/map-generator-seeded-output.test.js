import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

// Terrain baselines began before collaborator extraction. Full-result hashes
// reflect the tile-derived runtime schema; routing hashes were captured from
// the previous layout router and preserve its exact routes and arrows.
const baselines = JSON.parse(
  readFileSync(new URL("./fixtures/pre-extraction-seeds.json", import.meta.url)),
);

describe("map generation pre-extraction compatibility", () => {
  for (const { options, sha256, routingSha256, error } of baselines) {
    it(`preserves the complete result for ${options.mapName}`, async () => {
      if (error) {
        await assert.rejects(MapGenerator.generate({ ...options, islandConnectors: false }), error);
        return;
      }

      // These fixtures document the pre-feature output; opt out of connectors.
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
