import assert from "node:assert/strict";
import { it } from "node:test";
import { WalkingPaths } from "../../../../src/game/navigation/WalkingPaths.js";
import { GameMapLoader } from "../../../../src/game/GameMapLoader.js";
import { MapGenerator } from "../../../../src/game/generator/map/MapGenerator.js";
import { RouteDataBuilder } from "../../../../src/game/generator/map/RouteDataBuilder.js";

function fixture() {
  return {
    cols: 7, rows: 2,
    grid: [Array(7).fill(2), Array(7).fill(2)],
    heightmap: [Array(7).fill(2), Array(7).fill(2)],
    tileMeta: [Array.from({length: 7}, () => ({})), Array.from({length: 7}, () => ({}))],
    entries: [{col: 0, rows: [0, 1]}, {col: 6, rows: [0, 1]}],
    castle: {doors: [{centerCol: 4, centerRow: 0.5}]},
  };
}

it("derives the same deterministic quickest centerlines and arrows as the layout router", () => {
  const map = fixture();
  const expected = new RouteDataBuilder().buildRouteData({
    pathRows: [0, 1], castleEntranceCol: 4,
    entries: [{gateCol: 0, gateRows: [0, 1], mergeCol: 2},
      {gateCol: 6, gateRows: [0, 1], mergeCol: 2}],
  });
  WalkingPaths.rebuild(map);
  assert.deepEqual(map.paths.map((path) => path.route), expected.routes);
  assert.deepEqual(map.arrowData, expected.arrowData);
});

it("rebuilds after destruction and restoration without retaining stale connections", () => {
  const map = fixture();
  const first = WalkingPaths.rebuild(map);
  const routes = map.paths;
  map.grid[0][2] = 1;
  map.grid[1][2] = 1;
  const broken = WalkingPaths.rebuild(map);
  assert.deepEqual(map.paths[0].route, []);
  assert.equal(map.paths[1].route.length, 5);
  assert.notEqual(map.paths, routes);
  assert.ok(broken.graph.size < first.graph.size);
  map.grid[0][2] = 2;
  map.grid[1][2] = 2;
  WalkingPaths.rebuild(map);
  assert.deepEqual(map.paths, routes);
});

it("loading ignores stale route records and leaves authoritative source tiles unchanged", () => {
  const source = fixture();
  source.paths = [{route: [{col: -99, row: -99}]}];
  const original = structuredClone(source);
  const loaded = GameMapLoader.load(source, () => 0.9);
  assert.equal(loaded.paths[0].route.length, 9);
  assert.deepEqual(source, original);
});

it("rejects diagonal contact, a missing lane, and discontinuous elevations", () => {
  for (const change of [
    (map) => { map.grid[0][2] = 1; },
    (map) => { map.heightmap[0][2] = 3; map.heightmap[1][2] = 3; },
    (map) => { map.grid[0][2] = 1; map.grid[1][3] = 1; },
  ]) {
    const map = fixture();
    change(map);
    WalkingPaths.rebuild(map);
    assert.deepEqual(map.paths[0].route, []);
  }
});

it("connects matching ramp edges using tile slope metadata", () => {
  const map = fixture();
  for (let row = 0; row < 2; row++) {
    map.tileMeta[row][2] = {slope: {lowHeight: 2, highHeight: 3, riseDirection: "EAST"}};
    map.heightmap[row][2] = 2.5;
    for (let col = 3; col < 7; col++) { map.heightmap[row][col] = 3; }
  }
  WalkingPaths.rebuild(map);
  assert.deepEqual(map.paths[0].route.map((point) => point.elevation),
    [2, 2, 2, 2, 2.5, 3, 3, 3, 3]);
});

it("preserves generated overpass route lengths and keeps crossing levels disconnected", async () => {
  for (const [mapName, lengths] of [["variant-4", [61, 71, 97, 113]], ["variant-2", [117, 99, 73, 61]]]) {
    const map = await MapGenerator.generate({mapName, numPaths: 4, numRivers: 0, overpass: true});
    const {graph} = WalkingPaths.rebuild(map);
    assert.deepEqual(map.paths.map((path) => path.route.length), lengths);
    const {col, row} = map.overpassData.crossing;
    const lower = `${col * 2 + 1},${row * 2 + 1},2`;
    const upper = `${col * 2 + 1},${row * 2 + 1},${map.overpassData.deckElevation}`;
    assert.ok(graph.has(lower));
    assert.ok(graph.has(upper));
    assert.equal(graph.get(lower).has(upper), false);
  }
});

it("stored maps contain only authoritative tiles, without authored walking paths", async () => {
  const {readdir, readFile} = await import("node:fs/promises");
  const directory = new URL("../../../../src/game/maps/tests/", import.meta.url);
  for (const file of await readdir(directory, {recursive: true})) {
    if (!file.endsWith(".json")) { continue; }
    const map = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    assert.equal(Object.hasOwn(map, "paths"), false, file);
    assert.equal(Object.hasOwn(map, "arrowData"), false, file);
    const loaded = GameMapLoader.load(map, () => 0.9);
    assert.ok(Array.isArray(loaded.paths), file);
    assert.ok(loaded.arrowData instanceof Map, file);
  }
});
