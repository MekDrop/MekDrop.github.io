import assert from "node:assert/strict";
import { accessSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { generateMap, TileType } from "../../../../../src/game/generator/map/MapGenerator.js";
import { createCliffVineLayout } from "../../../../../src/game/objects/vegetation/CliffVineLayout.js";

describe("generated cliff vines", () => {
  it("fills the exposed grass gap between existing patches with varying partial lengths", () => {
    const map = {
      rows: 2, cols: 5, mapName: "vine-gap",
      grid: [Array(5).fill(TileType.GRASS), Array(5).fill(TileType.GRASS)],
      heightmap: [Array(5).fill(6), Array(5).fill(0)],
      cliffVineData: [0, 4].map((col) => ({ col, row: 0, direction: "SOUTH",
        topY: 6, bottomY: 5.4, offset: 0, width: 0.16 })),
    };
    const faces = createCliffVineLayout(map);
    assert.deepEqual(faces.map(({ col }) => col).sort(), [0, 1, 2, 3, 4]);
    assert.ok(faces.every(({ bottomY }) => bottomY >= 1.5 && bottomY <= 3.9));
    assert.ok(new Set(faces.map(({ bottomY }) => bottomY)).size > 1);
    map.grid[0][2] = TileType.PATH;
    assert.equal(createCliffVineLayout(map).length, 2);
  });
  it("extends vines down the floating island underside even with a one-tile surface elevation", () => {
    const map = {
      rows: 3, cols: 3, mapName: "underside-vines",
      grid: [[TileType.WATER, TileType.WATER, TileType.WATER],
        [TileType.WATER, TileType.GRASS, TileType.WATER],
        [TileType.WATER, TileType.WATER, TileType.WATER]],
      heightmap: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
      cliffVineData: [{ col: 1, row: 1, direction: "SOUTH", topY: 0.9,
        bottomY: 0.3, offset: 0.1, width: 0.16 }],
    };
    const [face] = createCliffVineLayout(map);
    assert.ok(face.bottomY < 0.3);
    assert.ok(face.bottomY > -5);
  });
  it("extends tall cliffs and only a seed-stable share of two-tile cliffs", () => {
    const map = {
      rows: 3, cols: 3,
      heightmap: [[0, 0, 0], [0, 3, 0], [0, 1, 0]],
      cliffVineData: [{ col: 1, row: 1, direction: "SOUTH", topY: 3,
        bottomY: 2.4, offset: 0.1, width: 0.16 }],
    };
    let extended = 0;
    for (let seed = 0; seed < 1000; seed++) {
      map.mapName = `extension-${seed}`;
      const [face] = createCliffVineLayout(map);
      assert.deepEqual(createCliffVineLayout(map), createCliffVineLayout(map));
      if (face.bottomY !== 2.4) {
        extended++;
        assert.ok(face.bottomY >= 1.5 && face.bottomY <= 2.3);
      }
      else assert.equal(face.bottomY, 2.4);
    }
    assert.ok(extended > 250 && extended < 350);
    map.heightmap[2][1] = 0;
    assert.ok(createCliffVineLayout(map)[0].bottomY >= 0.75);
    assert.ok(createCliffVineLayout(map)[0].bottomY <= 1.95);
    map.heightmap[2][1] = 1.5;
    assert.equal(createCliffVineLayout(map)[0].bottomY, 2.4);
  });
  it("rejects faces buried by changed terrain and clamps anchors away from corners", () => {
    const map = {
      cols: 3, rows: 3,
      heightmap: [[0, 0, 0], [0, 3, 0], [0, 3, 0]],
      cliffVineData: [{ col: 1, row: 1, direction: "SOUTH", topY: 3,
        bottomY: 1, offset: 0.22, width: 0.16 }],
    };
    assert.deepEqual(createCliffVineLayout(map), []);
    map.heightmap[2][1] = 0.5;
    const [face] = createCliffVineLayout(map);
    assert.equal(face.x, -0.12);
    assert.equal(face.z, 0.502);
    assert.ok(face.bottomY >= 1.125 && face.bottomY <= 2.125);
  });
  it("places seed-stable vines only on exposed grass faces", async () => {
    const map = await generateMap({ mapName: "cliff-vine-audit" });
    assert.ok(map.cliffVineData.length >= 1);
    assert.ok(map.cliffVineData.length <= 4);
    assert.deepEqual(
      map.cliffVineData,
      (await generateMap({ mapName: "cliff-vine-audit" })).cliffVineData,
    );

    for (const vine of map.cliffVineData) {
      assert.equal(map.grid[vine.row][vine.col], TileType.GRASS);
      assert.ok(vine.topY > vine.bottomY);
      assert.ok(vine.strandCount >= 2 && vine.strandCount <= 4);
      assert.ok(Math.abs(vine.offset) <= 0.22);
      assert.ok(vine.width >= 0.13 && vine.width <= 0.19);
    }
  });

  it("fits continuous authored trails within each face's vertical bounds", () => {
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
    assert.equal(modules.length, 1);
    assert.ok(modules.every(({ y }) => y <= 2.9 && y >= 1.2));
    assert.ok(modules.every(({ moduleBottomY }) => moduleBottomY >= 1.2));
    assert.ok(modules.every(({ z }) => z > 0.5));
  });

  it("ships an editable Blender source beside the runtime model", () => {
    const glb = new URL(
      "../../../../../src/game/models/vegetation/cliff-vine.glb",
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
