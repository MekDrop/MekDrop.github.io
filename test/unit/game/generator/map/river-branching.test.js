import assert from "node:assert/strict";
import { it } from "node:test";
import { RiverBuilder } from "../../../../../src/game/generator/map/RiverBuilder.js";
import { RiverValidator } from "../../../../../src/game/generator/map/RiverValidator.js";
import { MapGenerator } from "../../../../../src/game/generator/map/MapGenerator.js";
import { MAP_TILE_TYPE } from "../../../../../src/game/enum/MapTileType.js";

function fixture(roll, available = 2, kind = "WATER") {
  const grid = Array.from({ length: 42 }, (_, row) => Array.from({ length: 42 }, (_, col) =>
    row >= 6 && row <= 35 && col >= 6 && col <= 35 ? MAP_TILE_TYPE.GRASS : MAP_TILE_TYPE.WATER));
  const mask = grid.map(row => row.map(tile => tile === MAP_TILE_TYPE.GRASS));
  const heights = grid.map(row => row.map(() => 2));
  for (let col = 19; col <= 23; col++) {
    heights[20][col] = 4;
  }
  const meta = grid.map(row => row.map(() => ({})));
  const route = Array.from({ length: 16 }, (_, index) => ({
    col: 20 + index,
    row: 20,
  }));
  let calls = 0;
  const router = {
    riverSourceHasEarthEnclosure: () => true,
    findRiverRoute: async (...args) => {
      calls++;
      if (calls === 1) {
        return {
          route,
          terminalDirection: "EAST",
        };
      }
      if (calls - 1 > available) {
        return null;
      }
      const prefix = args[7];
      const junction = prefix.at(-1);
      const step = calls === 2 ? -1 : 1;
      const end = step === -1 ? 6 : 35;
      const tail = Array.from({ length: Math.abs(end - junction.row) }, (_, index) =>
        ({
          col: junction.col,
          row: junction.row + step * (index + 1),
        }));
      return {
        route: [...prefix, ...tail],
        terminalDirection: step === -1 ? "NORTH" : "SOUTH",
      };
    },
  };
  const random = {
    rng: () => roll,
    shuffle: items => items,
  };
  const builder = new RiverBuilder(random, router, async () => {});
  const layout = {
    castleLeft: -20,
    castleRight: -10,
    castleTop: -20,
    castleBottom: -10,
    entries: [],
  };
  return {
    builder,
    grid,
    heights,
    meta,
    mask,
    layout,
    kind,
  };
}

async function splitFixture(roll, available = 2, kind = "WATER") {
  const value = fixture(roll, available, kind);
  const { builder, grid, heights, meta, mask, layout } = value;
  const rivers = await builder.generateRivers(grid, heights, meta, layout, mask, 1, {});
  rivers[0].kind = kind;
  const before = JSON.stringify({
    grid,
    heights,
    meta,
    rivers,
  });
  await builder.splitRivers(grid, heights, meta, layout, mask, rivers, {});
  return {
    ...value,
    rivers,
    before,
  };
}

for (const [roll, count] of [[1, 3], [8, 3], [9, 2], [25, 2], [26, 1], [100, 1]]) {
  it(`roll ${roll} produces ${count} complete channels when space permits`, async () => {
    const { builder, grid, heights, meta, mask, layout, rivers } = await splitFixture(roll);
    assert.equal(rivers.length, count);
    for (const river of rivers) {
      const start = river.branchStart ?? rivers[1]?.branchStart ?? river.cells.length;
      for (const cell of river.cells.slice(start)) {
        assert.equal(cell.flowScale, 1 / count);
      }
    }
    builder.materializeRiverBanks(grid, heights, meta, mask, rivers);
    new RiverValidator().validateRivers(grid, heights, meta, mask, layout, rivers);
  });
}

it("rolls back the entire fork when only one of two requested outlets fits", async () => {
  const { grid, heights, meta, rivers, before } = await splitFixture(8, 1);
  assert.equal(JSON.stringify({
    grid,
    heights,
    meta,
    rivers,
  }), before);
});

it("keeps lava branches in one source family after raising their surfaces", async () => {
  const { builder, grid, heights, meta, mask, layout, rivers } = await splitFixture(8, 2, "LAVA");
  builder.raiseLavaSurfaces(heights, meta, rivers);
  builder.materializeRiverBanks(grid, heights, meta, mask, rivers);
  assert.equal(rivers.length, 3);
  assert.ok(rivers.every(river => river.kind === "LAVA"));
  new RiverValidator().validateRivers(grid, heights, meta, mask, layout, rivers);
});

for (const [seed, count] of [[0, 2], [908, 3], [1344, 1]]) {
  it(`generates and validates real seeded topology split-check-${seed}`, async () => {
    const map = await MapGenerator.generate({
      mapName: `split-check-${seed}`,
      numRivers: 1,
    });
    assert.equal(map.riverData.length, count);
  });
}

for (const mapName of ["water-forks-16", "water-forks-78"]) {
  it(`feeds ${mapName} through one fall into a level shared basin`, async () => {
    const map = await MapGenerator.generate({ mapName });
    const branch = map.riverData.find(river => river.sourceId);
    assert.ok(branch);
    const root = map.riverData.find(river => river.id === branch.sourceId);
    const index = branch.branchStart - 1;
    const basin = root.cells[index];
    const inlet = root.cascades.filter(cascade => cascade.to.col === basin.col && cascade.to.row === basin.row);
    assert.equal(inlet.length, 1);
    assert.ok(inlet[0].topElevation > basin.elevation);
    for (const channel of map.riverData.filter(river => river === root || river.sourceId === root.id)) {
      assert.equal(channel.cells[index].elevation, basin.elevation);
      assert.equal(channel.cells[index + 1].elevation, basin.elevation);
      assert.equal(channel.cells[index].flowScale, basin.flowScale);
      assert.equal(channel.cascades.some(cascade => cascade.from.col === basin.col && cascade.from.row === basin.row), false);
    }
  });
}
