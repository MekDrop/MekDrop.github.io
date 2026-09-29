import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";

// Captured before collaborator extraction. Include Map/Set entries in insertion
// order: JSON.stringify alone would silently omit route ownership and arrows.
const baselines = JSON.parse(
  readFileSync(new URL("./fixtures/pre-extraction-seeds.json", import.meta.url)),
);

describe("map generation pre-extraction compatibility", () => {
  for (const { options, sha256, error } of baselines) {
    it(`preserves the complete result for ${options.mapName}`, async () => {
      if (error) {
        await assert.rejects(MapGenerator.generate({ ...options, islandConnectors: false }), error);
        return;
      }

      // These fixtures document the pre-feature output; opt out of connectors.
      const map = await MapGenerator.generate({ ...options, islandConnectors: false });
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
    });
  }
});
