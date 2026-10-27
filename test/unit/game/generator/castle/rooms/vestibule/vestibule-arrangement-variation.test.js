import assert from "node:assert/strict";
import { test } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";

/**
 * Independently flood the walking floor, including neighboring rooms' doors.
 * @param {import("../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js").CompiledCastleSpace} room
 * @param {import("../../../../../../../src/game/generator/castle/rooms/AbstractCastleRoomGenerator.js").RoomItem[]} items
 * @param {import("../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js").CompiledCastleOpening[]} openings
 */
function assertConnectedDoorways(room, items, openings) {
  const step = 0.12, radius = 0.3;
  const columns = Math.ceil((room.maxX - room.minX) / step);
  const rows = Math.ceil((room.maxZ - room.minZ) / step);
  const obstacles = items.filter(item => !item.floorCovering && !item.supportId && !item.wallAttachment &&
    (item.y ?? 0) < 1.5 && (item.y ?? 0) + item.height * item.scale > 0.08);
  /**
   * @param {number} column
   * @param {number} row
   * @returns {boolean}
   */
  const free = (column, row) => {
    const x = room.minX + (column + 0.5) * step;
    const z = room.minZ + (row + 0.5) * step;

    return column >= 0 && column < columns && row >= 0 && row < rows &&
      x >= room.minX + radius && x <= room.maxX - radius &&
      z >= room.minZ + radius && z <= room.maxZ - radius &&
      !obstacles.some(item => Math.hypot(Math.max(Math.abs(x - item.x) - item.width * item.scale / 2, 0),
        Math.max(Math.abs(z - item.z) - item.depth * item.scale / 2, 0)) < radius);
  };
  const doors = openings.filter(opening => opening.kind === "door" && opening.floorY === room.floorY &&
    (opening.axis === "x" ? opening.coordinate >= room.minX - 0.3 && opening.coordinate <= room.maxX + 0.3 &&
      opening.center > room.minZ && opening.center < room.maxZ :
      opening.coordinate >= room.minZ - 0.3 && opening.coordinate <= room.maxZ + 0.3 &&
      opening.center > room.minX && opening.center < room.maxX));
  const approaches = doors.map(door => ({
    column: Math.floor((Math.max(room.minX + 0.55, Math.min(room.maxX - 0.55,
      door.axis === "x" ? door.coordinate : door.center)) - room.minX) / step),
    row: Math.floor((Math.max(room.minZ + 0.55, Math.min(room.maxZ - 0.55,
      door.axis === "z" ? door.coordinate : door.center)) - room.minZ) / step),
  }));
  assert.ok(approaches.length > 1);
  const visited = new Set(), queue = [approaches[0]];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { column, row } = queue[cursor];
    const key = `${column}:${row}`;
    if (visited.has(key) || !free(column, row)) {
      continue;
    }
    visited.add(key);
    queue.push({
      column: column - 1,
      row,
    }, {
      column: column + 1,
      row,
    },
    {
      column,
      row: row - 1,
    }, {
      column,
      row: row + 1,
    });
  }
  for (const point of approaches) {
    assert.ok(visited.has(`${point.column}:${point.row}`), `seed ${room.furnishingSeed}: every door retains a walking route`);
  }
}

test("wide vestibules move the console and lamp and sometimes use a spare standing bay without blocking doors", async () => {
  const consolePositions = new Set(), lampOffsets = new Set(), companions = new Set();
  for (let seed = 0; seed < 20; seed++) {
    const plan = await CastleBasePlanGenerator.generate({
      planId: "castle-compact-service-wing",
      seed,
    });
    const room = plan.spaces.find(space => space.id === "vestibule");
    const items = plan.furniture.filter(item => item.roomId === room.id);
    const console = items.find(item => item.id?.endsWith("arrival-console"));
    assert.ok(console, `seed ${seed} retains its arrival console`);
    const lamp = items.find(item => item.object === "Lantern" && item.supportId === console.id);
    assert.ok(lamp, `seed ${seed} retains its supported lamp`);
    assert.equal(items.filter(item => item.object === "Bench" && item.variant === "island" ||
      item.object === "Table" && item.properties?.height === 1).length, 1,
    `seed ${seed} retains its central arrival group`);
    consolePositions.add(console.x.toFixed(3));
    lampOffsets.add((lamp.x - console.x).toFixed(3));
    companions.add(items.find(item => item.id?.endsWith("companion"))?.object ?? "none");
    assert.ok(items.every(item => !item.placementIssue));
    assertConnectedDoorways(room, items, plan.openings);
  }
  assert.ok(consolePositions.size >= 3);
  assert.ok(lampOffsets.size >= 3);
  assert.ok(companions.has("none"));
  assert.ok(companions.size >= 3);
});
