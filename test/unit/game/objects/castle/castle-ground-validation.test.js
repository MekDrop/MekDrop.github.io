import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleResidentialLayout } from "../../../../../src/game/objects/castle/CastleResidentialLayout.js";
import { validateCastleGround } from "../../../../../src/game/objects/castle/CastleGroundValidation.js";

it("reports penetrations independently of cutout metadata and allows floor contact", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const buildPlan = await CastleGenerator.generate({ position: { x: -6, z: -6, width: 12, depth: 12, elevation: 3 },
      style: "courtyard-keep", seed: "castle-specific", doors: [{ side, offset: 5, width: 2 }] });
    const layout = new CastleResidentialLayout(buildPlan);
    const work = layout.rooms.work;
    const center = layout.toWorld((work.minX + work.maxX) / 2, (work.minZ + work.maxZ) / 2, 0);
    const terrain = { object: "Earth", id: "bad-earth", position: { x: center.x, y: 3.25, z: center.z },
      geometry: { method: "addBoxMatrix", args: ["earth", "earth", center.x, 3.25, center.z, 0, 0.2, 0.5, 0.2] } };
    const map = { cols: 1, rows: 1, grid: [[0]], heightmap: [[0]], tileMeta: [[{}]], mapName: "saved-seed",
      objects: [{ id: "castle-one", object: "Castle", buildPlan }, terrain] };
    const issues = validateCastleGround(map);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].castleId, "castle-one");
    assert.equal(issues[0].seed, "castle-specific");
    assert.equal(issues[0].area, "work");
    assert.equal(issues[0].terrainId, "bad-earth");
    assert.equal(issues[0].certainty, "confirmed");
    terrain.position.y = 2.75;
    assert.ok(validateCastleGround(map).every((issue) => issue.area !== "work"), "terrain touching a floor does not penetrate that room");
    const basement = layout.rooms.storage;
    const underground = layout.toWorld((basement.minX + basement.maxX) / 2, (basement.minZ + basement.maxZ) / 2, 0);
    terrain.position = { x: underground.x, y: basement.floorY + 0.5, z: underground.z };
    assert.equal(validateCastleGround(map)[0].area, "storage");
  }
});

it("reports canopy inside the hall even when no terrain records were stored", async () => {
  const buildPlan = await CastleGenerator.generate({ position: { x: -6, z: -6, width: 12, depth: 12, elevation: 3 },
    style: "long-hall", doors: [{ side: "NORTH", offset: 5, width: 2 }] });
  const layout = new CastleResidentialLayout(buildPlan);
  const room = layout.rooms.work;
  const point = layout.toWorld((room.minX + room.maxX) / 2, (room.minZ + room.maxZ) / 2, 0);
  const grid = Array.from({ length: 31 }, () => Array(31).fill(0));
  const col = Math.round(point.x + 15), row = Math.round(point.z + 15);
  grid[row][col] = 1;
  const map = { cols: 31, rows: 31, grid, heightmap: grid.map((line) => line.map(() => 3)),
    tileMeta: grid.map((line) => line.map(() => ({ surfaceType: "GRASS" }))), objects: [{ id: "castle", object: "Castle", buildPlan }] };
  const issues = validateCastleGround(map);
  assert.ok(issues.some((issue) => issue.kind === "grass-in-interior" && issue.area === "work" && issue.certainty === "confirmed"));
});


it("reports turf beside the servant shaft as an interior bay violation, including floor contact", async () => {
  for (const side of ["NORTH", "SOUTH", "WEST", "EAST"]) {
    const buildPlan = await CastleGenerator.generate({ position: { x: -6, z: -6, width: 12, depth: 12, elevation: 3 },
      style: "courtyard-keep", doors: [{ side, offset: 5, width: 2 }] });
    const layout = new CastleResidentialLayout(buildPlan);
    const bay = buildPlan.metadata.runtime.residential.reservations.serviceStair;
    const point = layout.toWorld(bay.minX + 0.1, bay.minZ + 0.1, 0);
    const terrain = { object: "Grass", id: "interior-turf", position: { x: point.x, y: 2.5, z: point.z },
      geometry: { method: "addBoxMatrix", args: ["grass", "earth", point.x, 2.5, point.z, 0, 0.1, 1, 0.1] } };
    const map = { cols: 1, rows: 1, grid: [[0]], heightmap: [[0]], tileMeta: [[{}]], objects: [{ object: "Castle", buildPlan }, terrain] };
    assert.ok(validateCastleGround(map).some((issue) => issue.terrainId === "interior-turf" && issue.certainty === "confirmed"), `${side} grass lying on the interior floor is rejected`);
    terrain.object = "Earth";
    assert.ok(!validateCastleGround(map).some((issue) => issue.kind === "grass-floor"), "Earth support beneath the floor stays valid");
  }
});

it("catches grass on the connecting side-bay floor outside the narrow shaft", async () => {
  const buildPlan = await CastleGenerator.generate({ position: { x: -6, z: -6, width: 12, depth: 12, elevation: 3 },
    style: "long-hall", doors: [{ side: "NORTH", offset: 5, width: 2 }] });
  const layout = new CastleResidentialLayout(buildPlan);
  const bay = layout.walkableAreas.find((area) => area.id === "serviceGroundBay");
  assert.ok(bay);
  const point = layout.toWorld(bay.minX + 0.05, bay.minZ + 0.05, 0);
  const map = { cols: 1, rows: 1, grid: [[0]], heightmap: [[0]], tileMeta: [[{}]], objects: [
    { object: "Castle", buildPlan }, { id: "bay-turf", object: "Grass", position: { x: point.x, y: 2.5, z: point.z },
      geometry: { method: "addBoxMatrix", args: ["grass", "earth", point.x, 2.5, point.z, 0, 0.04, 1, 0.04] } },
  ] };
  assert.ok(validateCastleGround(map).some((issue) => issue.terrainId === "bay-turf" && issue.certainty === "confirmed"));
});

it("checks roofed side rooms omitted by named work and servant bay bounds", async () => {
  const buildPlan = await CastleGenerator.generate({ position: { x: -6, z: -6, width: 12, depth: 12, elevation: 3 },
    style: "long-hall", doors: [{ side: "NORTH", offset: 5, width: 2 }] });
  const layout = new CastleResidentialLayout(buildPlan);
  const area = layout.walkableAreas.find((room) => room.id === "castleGroundFloor");
  assert.ok(area, "The entire rectangular footprint has a ground floor");
  const point = layout.toWorld(area.minX + 0.4, area.minZ + 0.4, 0);
  const map = { cols: 1, rows: 1, grid: [[0]], heightmap: [[0]], tileMeta: [[{}]], objects: [
    { object: "Castle", buildPlan }, { id: "omitted-side-room-grass", object: "Grass", position: { x: point.x, y: 2.5, z: point.z },
      geometry: { method: "addBoxMatrix", args: ["grass", "earth", point.x, 2.5, point.z, 0, 0.02, 1, 0.02] } },
  ] };
  assert.ok(validateCastleGround(map).some((issue) => issue.terrainId === "omitted-side-room-grass" && issue.area === "castleGroundFloor" && issue.certainty === "confirmed"));
});
