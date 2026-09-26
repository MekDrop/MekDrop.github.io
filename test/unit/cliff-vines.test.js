import assert from "node:assert/strict";
import { accessSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { generateMap, TileType } from "../../src/game/MapGenerator.js";
import { createCliffVineLayout } from "../../src/game/objects/vegetation/CliffVineLayout.js";

describe("generated cliff vines", () => {
  it("places seed-stable vines only on exposed grass faces", () => {
    const map = generateMap({ mapName: "cliff-vine-audit" });
    assert.ok(map.cliffVineData.length >= 1);
    assert.ok(map.cliffVineData.length <= 4);
    assert.deepEqual(
      map.cliffVineData,
      generateMap({ mapName: "cliff-vine-audit" }).cliffVineData,
    );

    for (const vine of map.cliffVineData) {
      assert.equal(map.grid[vine.row][vine.col], TileType.GRASS);
      assert.ok(vine.topY > vine.bottomY);
      assert.ok(vine.strandCount >= 2 && vine.strandCount <= 4);
      assert.ok(Math.abs(vine.offset) <= 0.22);
      assert.ok(vine.width >= 0.13 && vine.width <= 0.19);
    }
  });

  it("repeats the authored module within each face's vertical bounds", () => {
    const modules = createCliffVineLayout({
      cols: 3,
      rows: 3,
      cliffVineData: [
        {
          col: 1,
          row: 1,
          direction: "SOUTH",
          topY: 2.9,
          bottomY: 1.2,
          offset: 0.1,
          width: 0.16,
          strandCount: 3,
          phase: 1.4,
        },
      ],
    });
    assert.ok(modules.length >= 3);
    assert.ok(modules.every(({ y }) => y <= 2.9 && y >= 1.2));
    assert.ok(modules.every(({ moduleBottomY }) => moduleBottomY >= 1.2));
    assert.ok(modules.every(({ z }) => z > 0.5));
  });

  it("ships an editable Blender source beside the runtime model", () => {
    const glb = new URL(
      "../../src/game/models/vegetation/cliff-vine.glb",
      import.meta.url,
    );
    accessSync(glb);
    const blend = new URL(glb.href.replace(/\.glb$/, ".blend"));
    accessSync(blend);
    const buffer = readFileSync(glb);
    const jsonLength = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.subarray(20, 20 + jsonLength));
    assert.equal(
      json.scenes[json.scene].extras.sourceBlendSizeBytes,
      statSync(blend).size,
    );
    assert.ok(
      json.materials.every(
        ({ pbrMetallicRoughness }) =>
          pbrMetallicRoughness.baseColorFactor[1] >
            pbrMetallicRoughness.baseColorFactor[0] &&
          pbrMetallicRoughness.baseColorFactor[2] < 0.04,
      ),
    );
  });
});
