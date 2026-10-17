import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { ThroneRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/throne/ThroneRoomGenerator.js";
import { roomPropHeight } from "../../../../../../../src/game/generator/castle/rooms/RoomPropHeights.js";
import { MapTestControls } from "../../../../../../../src/game/debug/MapTestControls.js";
import { ThroneRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/throne/ThroneRoomMapObjects.js";
import { CastleResidentialLayout } from "../../../../../../../src/game/objects/castle/residents/CastleResidentialLayout.js";
import { ShelfLayout } from "../../../../../../../src/game/objects/castle-props/shelf/ShelfLayout.js";

const definition = JSON.parse(readFileSync("src/game/maps/tests/castle-rear-bell-tower.json")).objects[0];

it("sets the inspection direction before entering the first-person camera", () => {
  const map = JSON.parse(readFileSync("src/game/maps/tests/castle-rear-bell-tower.json"));
  const hero = {
    teleport: () => {},
    firstPersonCameraEnabled: false,
    firstPersonFacingYaw: 0,
  };
  const directions = [];
  const controls = new MapTestControls({
    getObjects: () => ({ getOne: () => hero }),
    getMap: () => map,
    setViewport: () => {},
    setFirstPerson: enabled => {
      if (enabled) {
        directions.push(hero.firstPersonFacingYaw);
      }
    },
  });
  for (const label of ["Throne room", "Council table"]) {
    controls.execute(map.testControls.panels[0].buttons.find(button => button.label === label));
  }
  assert.deepEqual(directions, [180, 270]);
});

it("keeps a complete supported council table in the rear bell tower castle across mirrored seeds", async () => {
  for (const seed of [0, 1, 42, 43]) {
    const plan = await CastleAuthoredBuildPlan.generate({
      ...definition,
      seed,
    });
    const items = plan.metadata.runtime.residential.furniture.filter(item => item.role === "courtProp");
    const table = items.find(item => item.object === "Table");
    assert.ok(table, `${seed}: council table survives the compiled doorway checks`);
    const children = items.filter(item => item.supportId === table.id);
    assert.deepEqual(children.map(item => item.object).sort(),
      ["WarMapDrawing", "DeskGlobe", "CandleStand", "ParchmentBundle", "Book", "WritingSet", "Teacup"].sort());
    for (const child of children) {
      assert.ok(child.elevation >= table.elevation + table.properties.height - 0.001);
      assert.ok(child.elevation <= table.elevation + table.properties.height + 0.005);
      assert.ok(Math.abs(child.x - table.x) + child.width * child.scale / 2 <= table.width / 2 + 0.001, child.object);
      assert.ok(Math.abs(child.z - table.z) + child.depth * child.scale / 2 <= table.depth / 2 + 0.001, child.object);
    }
    assert.equal(items.filter(item => item.object === "CandleStand" && item.properties.variant === "court").length, 2);
    const benches = items.filter(item => item.object === "Bench").sort((a, b) => a.z - b.z);
    assert.equal(benches.length, 2);
    assert.ok(benches[1].z - benches[0].z - (benches[0].depth + benches[1].depth) / 2 >= 0.9,
      `${seed}: visitors can walk between the bench rows`);
    const shelf = items.find(item => item.object === "Shelf");
    assert.ok(shelf, `${seed}: accessible bookcase survives placement`);
    const room = plan.metadata.runtime.residential.spaces.find(space => space.id === "throne-hall");
    const center = (room.minX + room.maxX) / 2;
    const map = {
      cols: 42,
      rows: 42,
      objects: [{
        ...definition,
        buildPlan: plan,
      }],
    };
    ThroneRoomMapObjects.prepareMap(map);
    const cabinet = map.objects.find(item => item.object === "Shelf");
    const cabinetBounds = ShelfLayout.bounds(cabinet);
    const layout = new CastleResidentialLayout(plan);
    const roomCenter = layout.toWorld(center, (room.minZ + room.maxZ) / 2, 0);
    const yaw = cabinetBounds.rotation * Math.PI / 180;
    assert.ok(Math.sin(yaw) * (roomCenter.x - cabinet.position.x) +
      Math.cos(yaw) * (roomCenter.z - cabinet.position.z) > 0,
    `${seed}: book spines face into the room rather than the wall`);
    const approachX = shelf.x - Math.sign(shelf.x - center) * (shelf.width / 2 + 0.5);
    for (const other of items) {
      if (other === shelf || other.elevation >= 1.8 || other.supportId) {
        continue;
      }
      assert.ok(Math.abs(other.x - approachX) >= other.width * other.scale / 2 + 0.5 - 0.001 ||
        Math.abs(other.z - shelf.z) >= other.depth * other.scale / 2 + 0.525 - 0.001,
      `${seed}: ${other.object} leaves a metre of standing room in front of the books`);
    }
    assert.equal(items.filter(item => item.object === "Chair").length, 2);
    assert.ok(items.every(item => !item.placementIssue), `${seed}: furniture has a clear position`);
  }
});

it("keeps the audience aisle and door approaches clear and omits a blocked table with its details", () => {
  const room = {
    id: "throne-hall",
    level: 0,
    floorY: 2,
    minX: 1,
    maxX: 6.5,
    minZ: 7.25,
    maxZ: 13,
  };
  const generator = new ThroneRoomGenerator();
  const items = generator.furnish(room);
  const center = (room.minX + room.maxX) / 2;
  for (const item of items.filter(item => item.elevation < 0.2 && item.object !== "ThroneDais")) {
    assert.ok(Math.abs(item.x - center) - item.width * item.scale / 2 >= 0.6, item.object);
  }
  const blocked = generator.furnish(room, {
    stairs: [{
      minX: 4,
      maxX: 6.5,
      minZ: 9,
      maxZ: 12,
      from: 0,
      to: 1,
    }],
  });
  assert.ok(!blocked.some(item => item.object === "Table"));
  assert.ok(!blocked.some(item => item.supportId));
  const candle = items.find(item => item.properties.variant === "court");
  assert.equal(roomPropHeight(candle, 0), 1.615);
});
