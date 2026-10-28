import assert from "node:assert/strict";
import { it } from "node:test";
import { BridgeDefinitions } from "../../../../src/game/objects/path/BridgeDefinitions.js";
import { WalkingPaths } from "../../../../src/game/navigation/WalkingPaths.js";

function fixture(material) {
  const cells = [2, 3].flatMap((col) => [0, 1].map((row) => ({
    col,
    row,
  })));
  const map = {
    cols: 7,
    rows: 2,
    grid: [Array(7).fill(2), Array(7).fill(2)],
    heightmap: [Array(7).fill(0), Array(7).fill(0)],
    tileMeta: Array.from({ length: 2 }, () => Array.from({ length: 7 }, () => ({}))),
    objects: [
      {
        id: "entry",
        object: "Gateway",
        entry: {
          col: 0,
          rows: [0, 1],
        },
      },
      {
        id: "castle",
        object: "Castle",
        navigation: {
          doors: [{
            centerCol: 6,
            centerRow: 0.5,
          }],
        },
      },
      {
        id: "bridge",
        object: "Bridge",
        elevation: 2,
        span: {
          horizontal: true,
          start: 2,
          end: 3,
          length: 2,
          crossCenter: 0.5,
          cells,
        },
      },
    ],
    renderCommands: cells.map(({ col, row }) => ({
      method: "addCubeMatrix",
      args: [material, 0, col - 3, -0.5, row - 0.5],
    })),
  };
  BridgeDefinitions.populate(map);

  return {
    map,
    cells,
  };
}

it("keeps the real lower path connected before, during and after bridge destruction", () => {
  const { map, cells } = fixture("path");
  for (const state of ["intact", "bridgeCollapsing", "bridgeCollapsed"]) {
    for (const { col, row } of cells) {
      const meta = map.tileMeta[row][col];
      meta.bridgeCollapsing = state === "bridgeCollapsing";
      meta.bridgeCollapsed = state === "bridgeCollapsed";
      assert.equal(meta.bridgeGroundPath, true);
    }
    WalkingPaths.rebuild(map);
    assert.ok(map.paths[0].route.length > 0, state);
    assert.ok(map.paths[0].route.every((point) => point.elevation === 0), state);
    assert.ok(map.paths[0].route.some((point) => point.col >= 2 && point.col <= 3), state);
  }
});

it("does not invent a lower walking route over non-path terrain", () => {
  const { map, cells } = fixture("grass");
  for (const { col, row } of cells) {
    map.tileMeta[row][col].bridgeCollapsed = true;
    assert.equal(map.tileMeta[row][col].bridgeGroundPath, false);
  }
  WalkingPaths.rebuild(map);
  assert.equal(map.paths[0].route.length, 0);
});
