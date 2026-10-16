import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { it } from "node:test";
import { MapObjectDefinitions } from "../../../../src/game/objects/MapObjectDefinitions.js";
import { GameMapLoader } from "../../../../src/game/GameMapLoader.js";

it("round-trips canonical object records through runtime views without losing navigation or placements", () => {
  const original = {
    entries: [{
      col: 1,
      row: 2,
      rows: [2, 3],
      side: "LEFT",
      color: 123,
    }],
    riverData: [{
      id: "stream",
      cells: [{
        col: 2,
        row: 3,
      }],
    }],
    groundCoverData: [{
      col: 4,
      row: 5,
      variant: "daisy-patch",
      offsetX: 0.1,
    }],
    overpassData: {
      id: "bridge",
      deckElevation: 4,
    },
    heroSpawn: {
      x: 1,
      y: 2,
      z: 3,
    },
    islandConnectorData: { islands: [["1,2"], ["3,4"]] },
    castle: {
      doors: [{
        centerCol: 2,
        centerRow: 3,
      }],
    },
  };
  const map = {
    objects: [
      {
        id: "castle",
        object: "Castle",
        navigation: structuredClone(original.castle),
      },
      {
        id: "gate",
        object: "Gateway",
        entry: structuredClone(original.entries[0]),
      },
      {
        id: "rivers",
        object: "Rivers",
        rivers: structuredClone(original.riverData),
      },
      {
        id: "cover",
        object: "GroundCover",
        placements: structuredClone(original.groundCoverData),
      },
      {
        id: "overpass",
        object: "Overpass",
        layout: structuredClone(original.overpassData),
      },
      {
        id: "spawn",
        object: "SpawnPoint",
        position: structuredClone(original.heroSpawn),
      },
      {
        id: "connector",
        object: "IslandConnector",
        topology: structuredClone(original.islandConnectorData),
      },
    ],
  };
  MapObjectDefinitions.prepare(map);
  const count = map.objects.length;
  MapObjectDefinitions.prepare(map);
  assert.equal(map.objects.length, count);
  const stored = JSON.parse(JSON.stringify(map));
  for (const field of ["entries", "riverData", "groundCoverData", "overpassData", "heroSpawn", "islandConnectorData", "castle"]) {
    assert.equal(Object.hasOwn(stored, field), false, field);
  }
  MapObjectDefinitions.prepare(stored);
  for (const field of ["entries", "riverData", "groundCoverData", "overpassData", "heroSpawn", "islandConnectorData", "castle"]) {
    assert.deepEqual(stored[field], original[field], field);
  }
  stored.heroSpawn = {
    x: 7,
    y: 8,
    z: 9,
  };
  assert.deepEqual(stored.objects.find(({ object }) => object === "SpawnPoint").position, stored.heroSpawn);
  stored.groundCoverData = [];
  assert.deepEqual(stored.objects.find(({ object }) => object === "GroundCover").placements, []);
  stored.riverData[0].cells.push({
    col: 6,
    row: 7,
  });
  assert.equal(stored.objects.find(({ object }) => object === "Rivers").rivers[0].cells.length, 2);
});

it("reloads cloned maps and preserves existing spawn identity when replacing runtime position", () => {
  const source = {
    objects: [{
      id: "start",
      object: "SpawnPoint",
      position: {
        x: 0,
        y: 2,
        z: 0,
      },
    }],
  };
  MapObjectDefinitions.prepare(source);
  const clone = structuredClone(source);
  MapObjectDefinitions.prepare(clone);
  clone.heroSpawn = {
    x: 2,
    y: 3,
    z: 4,
  };
  assert.equal(clone.objects.length, 1);
  assert.equal(clone.objects[0].id, "start");
  assert.deepEqual(source.heroSpawn, {
    x: 0,
    y: 2,
    z: 0,
  });
});

it("loads every test map from canonical object records without changing the authored source", async () => {
  const directory = new URL("../../../../src/game/maps/tests/", import.meta.url);
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json")) { continue; }
    const source = JSON.parse(await readFile(new URL(name, directory), "utf8"));
    for (const field of ["entries", "riverData", "groundCoverData", "overpassData", "heroSpawn", "islandConnectorData", "castle", "castles", "paths", "arrowData"]) {
      assert.equal(Object.hasOwn(source, field), false, `${name}: ${field}`);
    }
    const ids = source.objects.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length, `${name}: duplicate object ID`);
    const before = JSON.stringify(source);
    const loaded = GameMapLoader.load(source, () => 0.99);
    assert.equal(JSON.stringify(source), before, name);
    assert.ok(Array.isArray(loaded.paths), name);
    assert.ok(loaded.arrowData instanceof Map, name);
    assert.deepEqual(loaded.entries, source.objects.filter(({ object }) => object === "Gateway").map(({ entry }) => entry), name);
    assert.deepEqual(loaded.riverData, source.objects.find(({ object }) => object === "Rivers")?.rivers ?? [], name);
    assert.deepEqual(loaded.heroSpawn, source.objects.find(({ object }) => object === "SpawnPoint")?.position, name);
  }
});
