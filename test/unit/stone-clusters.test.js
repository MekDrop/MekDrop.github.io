import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateMap, TileType } from "../../src/game/MapGenerator.js";
import { GrassCarpetLayout } from "../../src/game/objects/ground-cover/GrassCarpetLayout.js";
import { TILE_SHAPE } from "../../src/game/enum/TileShape.js";
import { STONE_COLORS } from "../../src/game/config/stoneStyles.js";
import { buildStoneVoxelGeometry } from "../../src/game/objects/scenery/StoneVoxelGeometry.js";

describe("generated stone clusters", () => {
  it("has seed-stable empty maps and no more than ten clusters on populated maps", () => {
    const empty = generateMap({ mapName: "stone-audit-4" });
    const populated = generateMap({ mapName: "stone-audit-0" });
    assert.equal(empty.stoneData.length, 0);
    assert.ok(populated.stoneData.length > 0);
    assert.ok(populated.stoneData.length <= 10);
    assert.deepEqual(
      populated.stoneData,
      generateMap({ mapName: "stone-audit-0" }).stoneData,
    );
  });

  it("places each cluster on free flat grass with room for all of its parts", () => {
    const map = generateMap({ mapName: "stone-audit-0" });
    const occupied = new Set(
      [...map.vegetationData, ...map.groundCoverData].map(
        ({ col, row }) => `${col},${row}`,
      ),
    );
    for (const { col, row, parts } of map.stoneData) {
      assert.equal(map.grid[row][col], TileType.GRASS);
      assert.equal(map.tileMeta[row][col].shape, TILE_SHAPE.FLAT);
      assert.ok(!occupied.has(`${col},${row}`));
      assert.ok(parts.length >= 1 && parts.length <= 3);
      assert.equal(
        new Set(parts.map(({ variant }) => variant)).size,
        parts.length,
      );
      for (const { levels, offsetX, offsetZ, diameter, height } of parts) {
        assert.ok(Number.isInteger(levels) && levels >= 1 && levels <= 3);
        assert.ok(Math.abs(offsetX) + diameter / 2 <= 0.5);
        assert.ok(Math.abs(offsetZ) + diameter / 2 <= 0.5);
        assert.ok(height > 0 && height <= 0.8);
      }
      for (let first = 0; first < parts.length; first++) {
        for (let second = first + 1; second < parts.length; second++) {
          const a = parts[first];
          const b = parts[second];
          const requiredGap = (a.diameter + b.diameter) / 2;
          assert.ok(
            Math.abs(a.offsetX - b.offsetX) > requiredGap ||
              Math.abs(a.offsetZ - b.offsetZ) > requiredGap,
          );
        }
      }
    }
  });

  it("assigns unique shape and color styles to every stone part on each map", () => {
    assert.ok(STONE_COLORS.length * 3 >= 30);
    assert.equal(new Set(STONE_COLORS).size, STONE_COLORS.length);
    for (let seed = 0; seed < 24; seed++) {
      const map = generateMap({ mapName: `stone-style-${seed}` });
      const parts = map.stoneData.flatMap((cluster) => cluster.parts);
      const styles = parts.map(({ style }) => style);
      assert.equal(new Set(styles).size, styles.length);
      for (const { variant, style, color } of parts) {
        assert.ok(STONE_COLORS.includes(color));
        assert.equal(
          style,
          variant * STONE_COLORS.length + STONE_COLORS.indexOf(color),
        );
      }
      for (const cluster of map.stoneData) {
        assert.equal(
          new Set(cluster.parts.map(({ color }) => color)).size,
          cluster.parts.length,
        );
      }
    }
  });

  it("makes one-level stones common and three-level stones rare", () => {
    const counts = [0, 0, 0, 0];
    for (let seed = 0; seed < 24; seed++) {
      const map = generateMap({ mapName: `stone-style-${seed}` });
      for (const { levels, diameter, height } of map.stoneData.flatMap(
        (cluster) => cluster.parts,
      )) {
        counts[levels]++;
        if (levels === 1) {
          assert.ok(height >= 0.24 && height <= 0.26);
        }
        if (levels === 3) {
          assert.ok(height >= 0.72 && height <= 0.78);
        }
        assert.ok(diameter === 0.4 || diameter === (height / levels) * 3);
      }
    }
    const total = counts[1] + counts[2] + counts[3];
    assert.ok(total > 100);
    assert.ok(counts[1] > total * 0.6);
    assert.ok(counts[2] > counts[3]);
    assert.ok(counts[3] < total * 0.1);
  });

  it("rarely gives one-level stones multiple parts", () => {
    let oneLevelCount = 0;
    let oneLevelMultiPartCount = 0;
    let tallMultiPartCount = 0;
    for (let seed = 0; seed < 24; seed++) {
      const map = generateMap({ mapName: "stone-style-" + seed });
      for (const { parts } of map.stoneData) {
        if (parts[0].levels === 1) {
          oneLevelCount++;
          if (parts.length > 1) {
            oneLevelMultiPartCount++;
          }
        } else if (parts.length > 1) {
          tallMultiPartCount++;
        }
      }
    }
    assert.ok(oneLevelCount > 50);
    assert.ok(oneLevelMultiPartCount < oneLevelCount * 0.12);
    assert.ok(tallMultiPartCount > 0);
  });

  it("builds separate beveled voxel rows at runtime", () => {
    let previousVertices = 0;
    for (const levels of [1, 2, 3]) {
      const geometry = buildStoneVoxelGeometry([
        {
          x: 1,
          z: -2,
          ground: 2,
          diameter: 0.75,
          height: levels * 0.25,
          levels,
          variant: 0,
          rotation: 0,
          color: 0x808080,
        },
      ]);
      const vertexCount = geometry.positions.length / 3;
      const heights = geometry.positions.filter((_, index) => index % 3 === 1);
      assert.ok(vertexCount > previousVertices);
      assert.equal(geometry.normals.length, geometry.positions.length);
      assert.equal(geometry.colors.length, vertexCount * 4);
      assert.ok(geometry.indices.every((index) => index < vertexCount));
      assert.ok(Math.abs(Math.min(...heights) - 2) < 0.001);
      assert.ok(Math.abs(Math.max(...heights) - (2 + levels * 0.25)) < 0.001);
      previousVertices = vertexCount;
    }
  });

  it("grows taller grass around stones while leaving distant clumps unchanged", () => {
    const map = {
      mapName: "stone-grass",
      cols: 3,
      rows: 3,
      grid: Array.from({ length: 3 }, () => Array(3).fill(TileType.GRASS)),
      heightmap: Array.from({ length: 3 }, () => Array(3).fill(2)),
      tileMeta: Array.from({ length: 3 }, () =>
        Array.from({ length: 3 }, () => ({})),
      ),
    };
    const ordinary = GrassCarpetLayout.create(map);
    const withStones = GrassCarpetLayout.create({
      ...map,
      stoneData: [
        { col: 1, row: 1, parts: [{ offsetX: 0, offsetZ: 0, diameter: 0.75 }] },
      ],
    });
    assert.equal(ordinary.length, withStones.length);
    assert.ok(
      withStones.some((clump, index) => clump.height > ordinary[index].height),
    );
    assert.ok(
      withStones.every(
        (clump, index) => clump.height >= ordinary[index].height,
      ),
    );
    const tallClumps = withStones.filter(
      (clump, index) => clump.height > ordinary[index].height * 1.8,
    );
    assert.ok(tallClumps.length > 3);
    assert.ok(
      tallClumps.some(
        (clump) => Math.abs(clump.x) > 0.5 || Math.abs(clump.z) > 0.5,
      ),
    );
    assert.ok(
      withStones.every((clump, index) =>
        Math.hypot(clump.x, clump.z) > 0.95
          ? clump.height === ordinary[index].height
          : true,
      ),
    );
  });
});
