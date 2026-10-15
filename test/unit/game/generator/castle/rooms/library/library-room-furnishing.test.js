import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleBasePlanGenerator } from "../../../../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { LibraryRoomGenerator } from "../../../../../../../src/game/generator/castle/rooms/library/LibraryRoomGenerator.js";
import { LibraryRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/library/LibraryRoomMapObjects.js";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";

it("repeats study groups and preserves the end-wall bookcase row across seeds", async () => {
  const signatures = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const furniture = plan.furniture.filter(item => item.role === "libraryProp");
    const room = plan.spaces.find(room => room.purpose === "Library");
    const desk = furniture.find(item => item.object === "WritingDesk");
    assert.ok(desk);
    assert.ok(furniture.filter(item => item.object === "Chair").length >= 1);
    assert.ok(!furniture.some(item => item.object === "Throne"));
    assert.ok(!plan.furniture.some(item => item.roomId === room.id && item.object === "WallLantern"));
    assert.ok(furniture.some(item => item.object === "SingleCandleStand"), `seed ${seed} lights the reading furniture`);
    const chair = furniture.find(item => item.object === "Chair");
    const angle = chair.rotation * Math.PI / 180;
    // Native chair front is -X. It must face the desk on mirrored seeds too.
    assert.ok(-Math.cos(angle) * (desk.x - chair.x) + Math.sin(angle) * (desk.z - chair.z) > 0.6);
    assert.ok(furniture.some(item => item.object === "Bookshelf"));
    const endWallShelves = furniture.filter(item => item.object === "Bookshelf" && Math.abs(item.rotation % 180) === 90);
    assert.ok(endWallShelves.length >= 4, `seed ${seed} fills the solid end wall`);
    assert.ok(Math.abs(Math.abs(endWallShelves[0].z - endWallShelves[1].z) - 0.791) < 1e-6);
    for (const shelf of endWallShelves) {
      assert.ok(Math.abs(Math.min(Math.abs(shelf.x - room.wallBounds.minX), Math.abs(shelf.x - room.wallBounds.maxX)) - 0.18) < 1e-6);
    }
    assert.equal(furniture.filter(item => item.object === "WritingDesk").length, 1);
    assert.ok(!furniture.some(item => ["LibrarySideTable", "ClosedReadingBook"].includes(item.object)));
    for (const object of ["StepStool", "ParchmentBundle", "LibraryBookStack"]) {
      assert.ok(furniture.some(item => item.object === object), `seed ${seed} uses ${object}`);
    }
    const stool = furniture.find(item => item.object === "StepStool");
    const shaft = plan.stairs.find(item => item.to === room.level);
    const xGap = Math.abs(stool.x - (shaft.minX + shaft.maxX) / 2) - shaft.radius - shaft.flightShift - stool.width / 2;
    const zGap = room.wallBounds.maxZ - stool.z - stool.depth / 2;
    assert.ok(Math.abs(xGap - 0.01) < 1e-6 && Math.abs(zGap - 0.01) < 1e-6,
      `seed ${seed} tucks the stool against the window wall and stair guard`);
    if (seed === 48) {
      assert.equal(stool.rotation, 180, "preserves the original stool orientation");
    }
    for (const detail of furniture.filter(item => ["LibraryBookStack", "ParchmentBundle"].includes(item.object))) {
      const shelf = furniture.find(item => item.object === "Bookshelf" &&
        item.height === detail.y &&
        Math.abs(detail.x - item.x) + detail.width / 2 <= item.width / 2 + 1e-6 &&
        Math.abs(detail.z - item.z) + detail.depth / 2 <= item.depth / 2 + 1e-6);
      assert.ok(shelf, `seed ${seed} ${detail.object} shelf support`);
    }
    assert.ok(endWallShelves.every(item => item.height === 2.5));
    const bareShelf = furniture.find(item => item.object === "Bookshelf" && !furniture.some(detail =>
      ["LibraryBookStack", "ParchmentBundle"].includes(detail.object) &&
      Math.abs(detail.x - item.x) <= item.width / 2 && Math.abs(detail.z - item.z) <= item.depth / 2));
    assert.ok(bareShelf, `seed ${seed} leaves a shelf top bare`);
    const floorItems = furniture.filter(item => item.y === 0);
    for (let a = 0; a < floorItems.length; a++) {
      for (let b = a + 1; b < floorItems.length; b++) {
        const first = floorItems[a], second = floorItems[b];
        assert.ok(Math.abs(first.x - second.x) >= (first.width + second.width) / 2 ||
          Math.abs(first.z - second.z) >= (first.depth + second.depth) / 2);
      }
    }
    for (const stair of plan.stairs) {
      for (const item of furniture) {
        const clearance = item.object === "StepStool" ? 0 : 0.39;
        assert.ok(item.x + item.width / 2 <= stair.minX - clearance || item.x - item.width / 2 >= stair.maxX + clearance ||
          item.z + item.depth / 2 <= stair.minZ - clearance || item.z - item.depth / 2 >= stair.maxZ + clearance);
      }
    }
    assert.deepEqual((await CastleBasePlanGenerator.generate({ seed })).furniture.filter(item => item.role === "libraryProp"), furniture);
    for (const item of furniture) {
      assert.ok(item.x - item.width / 2 >= room.wallBounds.minX - 1e-6);
      assert.ok(item.x + item.width / 2 <= room.wallBounds.maxX + 1e-6);
      assert.ok(item.z - item.depth / 2 >= room.wallBounds.minZ - 1e-6);
      assert.ok(item.z + item.depth / 2 <= room.wallBounds.maxZ + 1e-6);
    }
    // Every tabletop detail is supported by the same desk after reflection.
    for (const detail of furniture.filter(item => item.y === 0.65)) {
      assert.ok(Math.abs(detail.x - desk.x) + detail.width / 2 <= desk.width / 2 + 1e-6);
      assert.ok(Math.abs(detail.z - desk.z) + detail.depth / 2 <= desk.depth / 2 + 1e-6);
    }
    signatures.add(JSON.stringify(furniture));
  }
  // Corner placement removes the stool's random wall-slot variation.
  assert.ok(signatures.size > 20);
});

it("small studies omit groups that cannot preserve their approaches", () => {
  const room = {
    id: "tiny-library",
    minX: 0,
    maxX: 1.75,
    minZ: 0,
    maxZ: 2,
    floorY: 3,
    level: 1,
    height: 2.75,
    floorSpan: 1,
    purpose: "Library",
  };
  const items = new LibraryRoomGenerator().furnish(room, { seed: 42 });
  assert.ok(!items.some(item => item.object === "WritingDesk"));
  assert.ok(!items.some(item => ["OpenReadingBook", "ClosedReadingBook", "WallLantern"].includes(item.object)));
  assert.ok(items.some(item => item.object === "Bookshelf"));
});

it("keeps a connected player-width route from the door to desk and shelf approaches", async () => {
  for (let seed = 0; seed < 60; seed++) {
    const plan = await CastleBasePlanGenerator.generate({ seed });
    const room = plan.spaces.find(room => room.purpose === "Library");
    const furniture = plan.furniture.filter(item => item.role === "libraryProp" && item.y === 0);
    const door = plan.openings.find(item => item.roomId === room.id && item.kind === "door");
    const radius = 0.27, step = 0.1;
    const width = Math.floor((room.maxX - room.minX) / step);
    const depth = Math.floor((room.maxZ - room.minZ) / step);
    const queue = [], visited = new Set();
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const px = room.minX + (x + 0.5) * step, pz = room.minZ + (z + 0.5) * step;
        if (px < room.minX + radius || px > room.maxX - radius || pz < room.minZ + radius || pz > room.maxZ - radius) { continue; }
        const blocksFurnitureClearance = item => Math.hypot(Math.max(0, Math.abs(px - item.x) - item.width / 2),
          Math.max(0, Math.abs(pz - item.z) - item.depth / 2)) < radius;
        if (furniture.some(blocksFurnitureClearance)) { continue; }
        const blocksStairClearance = stair => px > stair.minX - radius && px < stair.maxX + radius &&
          pz > stair.minZ - radius && pz < stair.maxZ + radius;
        if (plan.stairs.some(blocksStairClearance)) { continue; }
        visited.add(`${x},${z}`);
        if (Math.abs(px - door.center) < 0.2 && Math.abs(pz - (door.coordinate - 0.4)) < 0.15) { queue.push([x, z]); }
      }
    }
    const reached = new Set(queue.map(point => point.join(",")));
    for (let index = 0; index < queue.length; index++) {
      const [x, z] = queue[index];
      for (const [a, b] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
        const key = `${a},${b}`;
        if (visited.has(key) && !reached.has(key)) { reached.add(key); queue.push([a, b]); }
      }
    }
    assert.ok(reached.size > 50, `seed ${seed} door route`);
    for (const item of furniture.filter(item => ["Chair", "Bookshelf", "Throne"].includes(item.object))) {
      const angle = item.rotation * Math.PI / 180;
      const chair = item.object !== "Bookshelf";
      // Approach the desk chair from behind; bookcases and armchairs from front.
      const direction = item === furniture.find(prop => prop.object === "Chair") ? 1 : -1;
      const tx = item.x + (chair ? direction * Math.cos(angle) : Math.sin(angle)) * 0.75;
      const tz = item.z + (chair ? -direction * Math.sin(angle) : Math.cos(angle)) * 0.75;
      assert.ok(queue.some(([x, z]) => Math.hypot(room.minX + (x + 0.5) * step - tx,
        room.minZ + (z + 0.5) * step - tz) < 0.25), `seed ${seed} ${item.object} approach`);
    }
  }
});

it("publishes registered room objects once through the active authored plan", async () => {
  const plan = await CastleAuthoredBuildPlan.generate({
    position: {
      x: 0,
      z: 0,
      width: 9,
      depth: 10,
      elevation: 3,
    },
    doors: [{
      side: "NORTH",
      offset: 3,
      width: 2,
    }],
    seed: 48,
  });
  const map = {
    cols: 42,
    rows: 42,
    objects: [{
      id: "castle-test",
      object: "Castle",
      buildPlan: plan,
    }],
  };
  LibraryRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.some(item => item.object === "WritingDesk"));
  assert.ok(first.some(item => item.object === "DeskGlobe"));
  const shelf = first.find(item => item.object === "Bookshelf");
  assert.notEqual(shelf.from.x === shelf.to.x, shelf.from.z === shelf.to.z);
  for (const section of first.filter(item => item.object === "Bookshelf")) {
    const angle = section.rotation * Math.PI / 180;
    const neighbours = first.filter(item => item !== section && item.object === "Bookshelf" && item.rotation === section.rotation);
    for (const [flag, sign] of [["joinStart", -1], ["joinEnd", 1]]) {
      if (!section[flag]) { continue; }
      assert.ok(neighbours.some(item => {
        const dx = item.position.x - section.position.x, dz = item.position.z - section.position.z;

        return sign * (dx * Math.cos(angle) - dz * Math.sin(angle)) > 0 &&
          Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle)) < 0.01;
      }), `${flag} has a neighbour on the model's corresponding side`);
    }
  }
  LibraryRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
});
