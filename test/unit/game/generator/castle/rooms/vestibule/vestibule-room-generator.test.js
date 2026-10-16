import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { VestibuleRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/vestibule/VestibuleRoomGenerator.js";

it("furnishes the arrival room while preserving circulation and window approaches in both mirrors", async () => {
  for (const seed of [20, 21]) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const items = plan.furniture.filter(item => item.role === "vestibuleProp");
    for (const object of ["Bench", "VestibuleCloakRail", "Banner", "Rug", "Lantern",
      "Painting", "StandingArmor", "Chest", "TravelKit", "Boots", "VestibuleStickStand"]) {
      assert.ok(items.some(item => item.object === object), `${object} seed ${seed}`);
    }
    for (const room of plan.spaces.filter(room => room.id.startsWith("vestibule"))) {
      assert.ok(items.some(item => item.roomId === room.id));
      for (const item of items.filter(item => item.roomId === room.id)) {
        const halfX = item.width * item.scale / 2;
        const halfZ = item.depth * item.scale / 2;
        assert.ok(item.x - halfX >= room.minX - 1e-6 && item.x + halfX <= room.maxX + 1e-6);
        assert.ok(item.z - halfZ >= room.minZ - 1e-6 && item.z + halfZ <= room.maxZ + 1e-6);
        if (["Bench", "VestibuleCloakRail", "Lantern"].includes(item.object)) {
          assert.ok(Math.abs(item.x - (room.minX + room.maxX) / 2) >= halfX + 0.6);
        }
        for (const opening of plan.openings.filter(opening => opening.floorY === room.floorY)) {
          if ((item.y ?? 0) + item.height * item.scale <= 0.05) {
            continue;
          }
          if (opening.kind === "window" && (item.y ?? 0) + item.height * item.scale <= opening.bottom - 0.1) {
            continue;
          }
          const perpendicular = opening.axis === "x" ? item.x : item.z;
          const along = opening.axis === "x" ? item.z : item.x;
          const halfPerpendicular = opening.axis === "x" ? halfX : halfZ;
          const halfAlong = opening.axis === "x" ? halfZ : halfX;
          assert.ok(Math.abs(perpendicular - opening.coordinate) >= halfPerpendicular + 0.85 ||
            Math.abs(along - opening.center) >= halfAlong + opening.width / 2 + 0.25);
        }
      }
    }
    const bench = items.find(item => item.object === "Bench" && item.variant === "wall");
    const cloaks = items.filter(item => item.object === "VestibuleCloakRail" && item.roomId === bench.roomId);
    assert.equal(cloaks.length, 2);
    assert.ok(cloaks.every(item => item.y > bench.y + bench.height && item.rotation === bench.rotation));
    assert.ok(Math.abs((cloaks[0].z + cloaks[1].z) / 2 - bench.z) < 1e-6);
    const painting = items.find(item => item.object === "Painting" && item.variant === "vestibule");
    const chest = items.find(item => item.object === "Chest");
    assert.equal(painting.z, chest.z);
    assert.ok(painting.y > chest.height * chest.scale);
    assert.ok(Math.abs(painting.x - bench.x) > 2);
    const armor = items.filter(item => item.object === "StandingArmor");
    assert.equal(armor.length, 1);
    assert.equal(armor[0].roomId, painting.roomId);
    assert.equal(armor[0].rotation, painting.rotation);
    assert.ok(armor[0].z > painting.z, "use the spacious side opposite the stairs door");
    assert.ok(Math.abs(armor[0].z - painting.z) >= (armor[0].depth + painting.depth) / 2 + 0.08);
    const runner = items.find(item => item.object === "Rug" && item.roomId === bench.roomId);
    assert.ok(runner.depth > 3 && runner.width === 1.3);
    const window = plan.openings.find(opening => opening.roomId === bench.roomId && opening.kind === "window");
    const windowBench = items.find(item => item.object === "Bench" && item.variant === "wall" && item.stretch?.x === 0.8);
    assert.ok(windowBench, `window bay furnished for seed ${seed}`);
    assert.ok(windowBench.y + windowBench.height * windowBench.scale < window.bottom);
    assert.equal(windowBench.height * windowBench.scale, bench.height * bench.scale);
    const arrivalRoom = plan.spaces.find(room => room.id === bench.roomId);
    assert.ok(runner.depth >= arrivalRoom.maxZ - arrivalRoom.minZ - 0.13);
    assert.ok(items.some(item => item.object === "Planter"));
  }
});

it("uses both window bays in a long vestibule and keeps tall furniture away from their glass", () => {
  const room = {
    id: "vestibule",
    minX: 0,
    maxX: 3.5,
    minZ: 0,
    maxZ: 7,
    level: 0,
    floorY: 0,
  };
  const openings = [3.5, 5.8].map(center => ({
    roomId: room.id,
    kind: "window",
    axis: "x",
    coordinate: 0,
    center,
    width: 0.9,
    bottom: 1,
    height: 1.2,
    floorY: 0,
  }));
  const items = new VestibuleRoomGenerator().furnish(room, { openings });
  const benches = items.filter(item => item.object === "Bench" && item.variant === "wall" && item.stretch?.x === 0.8);
  assert.equal(benches.length, 2);
  assert.deepEqual(benches.map(item => item.z), openings.map(opening => opening.center));
  for (const opening of openings) {
    for (const item of items.filter(item => Math.abs(item.x - opening.coordinate) < item.width * item.scale / 2 + 0.85 &&
      Math.abs(item.z - opening.center) < item.depth * item.scale / 2 + opening.width / 2 + 0.25)) {
      if ((item.y ?? 0) + item.height * item.scale <= 0.05) {
        continue;
      }
      assert.ok((item.y ?? 0) + item.height * item.scale <= opening.bottom - 0.1, item.object);
    }
  }
});

it("leaves cramped and fully occupied stair rooms unfurnished", () => {
  const generator = new VestibuleRoomGenerator();
  const room = {
    id: "vestibule",
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    level: 0,
    floorY: 0,
  };
  assert.deepEqual(generator.furnish(room), []);
  assert.deepEqual(generator.furnish({
    ...room,
    maxX: 3,
    maxZ: 4,
  }, {
    stairs: [{
      from: 0,
      to: 1,
      minX: 0,
      maxX: 3,
      minZ: 0,
      maxZ: 4,
    }],
  }), []);
});

it("chooses either seating or a map table and keeps all door approaches connected in both mirrors", async () => {
  for (const seed of [4, 5, 10, 11]) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const room = plan.spaces.find(room => room.id === "vestibule");
    const items = plan.furniture.filter(item => item.roomId === room.id);
    const islands = items.filter(item => (item.object === "Bench" && item.variant === "island" || item.object === "Table" && item.properties?.height === 1));
    assert.equal(islands.length, 1);
    assert.equal(islands[0].object, seed < 6 ? "Bench" : "Table");
    const bags = items.filter(item => item.underSupport && item.supportId === islands[0].id);
    assert.equal(bags.length, seed < 6 ? 4 : 0);
    if (bags.length) {
      assert.equal(bags[0].x, bags[1].x, "the near end has a visible pair of bags");
      assert.ok(Math.abs(bags[0].z - bags[1].z) >= 0.55, "the near-end bags are separated");
      assert.equal(bags[2].rotation, islands[0].rotation, "additional bags fill the long-side bays");
      assert.notEqual(bags[0].variant, bags[1].variant, "brown and olive luggage retain their authored finishes");
    }
    for (const bag of bags) {
      assert.equal(bag.object, "Satchel");
      assert.ok(["brown", "olive"].includes(bag.variant));
      assert.equal(bag.y, islands[0].y);
      assert.ok(bag.y + bag.height * bag.scale < 0.44);
      assert.ok(Math.abs(bag.x - islands[0].x) + bag.width * bag.scale / 2 < islands[0].width / 2);
      assert.ok(Math.abs(bag.z - islands[0].z) + bag.depth * bag.scale / 2 < islands[0].depth / 2);
    }
    const console = items.find(item => item.object === "Table" && (item.variant ?? item.properties?.variant) === "writingDesk");
    assert.ok(console, `console for seed ${seed}`);
    assert.ok(!items.some(item => item.object === "Bench" && item.variant === "wall"));
    assert.ok(items.some(item => item.object === "Table" && item.id.endsWith("window-stand")));
    assert.ok(items.some(item => item.object === "Rug" && item.id?.endsWith("arrival-rug")),
      "arrival furniture has its own broad floor covering");
    assert.ok(items.some(item => item.object === "WarCouncilShield" && item.id.endsWith("arrival-shield")),
      "the entrance wall has a shield above the low furnishings");
    assert.ok(Math.abs(console.x - islands[0].x) < 0.85, "console sits beside the arrival end of the central group");
    if (seed < 6) {
      assert.equal(islands[0].width, 2.7);
      assert.equal(islands[0].depth, 1.2);
      assert.equal(islands[0].height, 1.2);
      const chest = items.find(item => item.object === "Chest");
      const endGap = Math.abs(chest.x - islands[0].x) - (chest.width * chest.scale + islands[0].width) / 2;
      assert.ok(endGap >= 0.7 && endGap <= 1.1, "seating groups with the far-wall chest instead of floating midway along the room");
      assert.ok(console.z - console.depth / 2 - (islands[0].z + islands[0].depth / 2) >= 0.7,
        "the console-side aisle remains comfortable");
    }
    assert.ok(items.some(item => item.object === "VestibuleCloakRail" && item.id === `${console.id}-hooks`));
    for (const object of ["Lantern", "Planter"]) {
      assert.ok(items.some(item => item.object === object && item.supportId === console.id));
    }
    assert.ok(islands.every(item => item.y === 0.033));
    const rug = items.find(item => item.object === "Rug");
    assert.ok(rug.width > 2 && rug.depth > 1.5);
    if (seed < 6) {
      assert.ok(rug.width >= 4 && rug.depth >= 2.49);
    }
    for (const island of islands) {
      assert.ok(Math.abs(island.x - rug.x) + island.width / 2 <= rug.width / 2);
      assert.ok(Math.abs(island.z - rug.z) + island.depth / 2 <= rug.depth / 2);
    }
    // Flood the usable floor with a hero-sized clearance, including neighboring
    // rooms' doors. A straight centreline is no longer the intended route.
    const step = 0.1, radius = 0.3;
    const cols = Math.ceil((room.maxX - room.minX) / step);
    const rows = Math.ceil((room.maxZ - room.minZ) / step);
    const blocked = items.filter(item => item.y + item.height * item.scale > 0.08 && item.y < 1.5);
    const free = (col, row) => {
      const x = room.minX + (col + 0.5) * step;
      const z = room.minZ + (row + 0.5) * step;

      return col >= 0 && col < cols && row >= 0 && row < rows &&
        x >= room.minX + radius && x <= room.maxX - radius &&
        z >= room.minZ + radius && z <= room.maxZ - radius &&
        !blocked.some(item => Math.hypot(Math.max(Math.abs(x - item.x) - item.width * item.scale / 2, 0),
          Math.max(Math.abs(z - item.z) - item.depth * item.scale / 2, 0)) < radius);
    };
    const doors = plan.openings.filter(opening => opening.floorY === room.floorY && opening.kind === "door" &&
      (opening.axis === "x" ? opening.coordinate >= room.minX - 0.3 && opening.coordinate <= room.maxX + 0.3 &&
        opening.center > room.minZ && opening.center < room.maxZ :
        opening.coordinate >= room.minZ - 0.3 && opening.coordinate <= room.maxZ + 0.3 &&
        opening.center > room.minX && opening.center < room.maxX));
    assert.equal(doors.length, 4);
    const approaches = doors.map(door => ({
      col: Math.floor((Math.max(room.minX + 0.5, Math.min(room.maxX - 0.5,
        door.axis === "x" ? door.coordinate : door.center)) - room.minX) / step),
      row: Math.floor((Math.max(room.minZ + 0.5, Math.min(room.maxZ - 0.5,
        door.axis === "z" ? door.coordinate : door.center)) - room.minZ) / step),
    }));
    assert.ok(approaches.every(point => free(point.col, point.row)), `door landings seed ${seed}`);
    const visited = new Set();
    const queue = [approaches[0]];
    for (let index = 0; index < queue.length; index++) {
      const { col, row } = queue[index];
      const key = `${col},${row}`;
      if (visited.has(key) || !free(col, row)) {
        continue;
      }
      visited.add(key);
      queue.push({
        col: col + 1,
        row,
      }, {
        col: col - 1,
        row,
      }, {
        col,
        row: row + 1,
      }, {
        col,
        row: row - 1,
      });
    }
    assert.ok(approaches.every(point => visited.has(`${point.col},${point.row}`)), `connected doors seed ${seed}`);
  }
});

it("rotates the selected island in long rooms and leaves narrow corridors clear", () => {
  const generator = new VestibuleRoomGenerator();
  const room = {
    id: "arrival",
    minX: 0,
    minZ: 0,
    maxX: 3.875,
    maxZ: 7.25,
    floorY: 0,
    level: 0,
  };
  const items = generator.furnish(room);
  const islands = items.filter(item => (item.object === "Bench" && item.variant === "island" || item.object === "Table" && item.properties?.height === 1));
  assert.equal(islands.length, 1);
  assert.ok(islands.every(item => item.rotation === 90 && item.depth === 2.7));
  const smaller = generator.furnish({
    ...room,
    maxX: 4,
    maxZ: 3.875,
  });
  assert.equal(smaller.filter(item => item.object === "Table" && item.properties?.height === 1).length, 0);
  assert.equal(smaller.filter(item => item.object === "Bench" && item.variant === "island").length, 1);
  const narrow = generator.furnish({
    ...room,
    maxX: 2.8,
  });
  assert.equal(narrow.filter(item => (item.object === "Bench" && item.variant === "island" || item.object === "Table" && item.properties?.height === 1)).length, 0);
});
