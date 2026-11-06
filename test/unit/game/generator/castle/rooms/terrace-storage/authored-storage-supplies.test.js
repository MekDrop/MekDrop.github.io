import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AuthoredStorageSupplies } from "../../../../../../../src/game/generator/castle/rooms/terrace-storage/AuthoredStorageSupplies.js";
import { CastleAuthoredMapObjects } from "../../../../../../../src/game/objects/castle/structure/CastleAuthoredMapObjects.js";

test("authored linens vary between exposed crates and stay fully supported", async () => {
  for (const name of ["castle-tower-bridge", "castle-rear-bell-tower"]) {
    const plan = JSON.parse(await readFile(new URL(
      `../../../../../../../src/game/generator/castle/plans/${name}.json`, import.meta.url), "utf8"));
    const original = structuredClone(plan.objects);
    const supports = new Set();
    const rotations = new Set();
    const walls = new Set();
    for (let seed = 0; seed < 24; seed++) {
      const objects = AuthoredStorageSupplies.furnish(original, seed);
      const racks = objects.filter(item => item.object === "Shelf");
      walls.add(racks[0].rotation);
      for (const rack of racks) {
        const front = rack.rotation === 180 ? -1 : 1;
        const nearZ = rack.position.z + front * 0.225;
        const farZ = nearZ + front;
        for (const item of objects) {
          if (!["Crate", "Barrel", "PotteryJar"].includes(item.object)) {
            continue;
          }
          const half = (item.object === "PotteryJar" ? 0.236 : 0.554) * (item.scale ?? 1) / 2;
          const overlaps = Math.abs(item.position.x - rack.position.x) < 0.6 + half &&
            item.position.z + half > Math.min(nearZ, farZ) &&
            item.position.z - half < Math.max(nearZ, farZ);
          assert.equal(overlaps, false, `${name}/${seed}: ${item.id} clears the rack aisle`);
        }
      }
      assert.deepEqual(objects, AuthoredStorageSupplies.furnish(original, seed));
      const linens = objects.find(item => item.id === "store-reserve-linens");
      const support = objects.find(item => item.object === "Crate" &&
        Math.abs(item.position.y + 0.4702 * item.scale - linens.position.y) < 1e-6 &&
        Math.abs(item.position.x - linens.position.x) < 0.1);
      assert.ok(support);
      const map = {
        cols: 40,
        rows: 40,
        objects: [
          {
            id: "castle",
            object: "Castle",
            position: {
              x: 0,
              z: 0,
            },
            buildPlan: { metadata: { runtime: { authoredObjects: objects } } },
          },
          structuredClone(original.find(item => item.id === linens.id)),
        ],
      };
      CastleAuthoredMapObjects.prepareMap(map);
      const first = structuredClone(map.objects);
      CastleAuthoredMapObjects.prepareMap(map);
      assert.deepEqual(map.objects, first);
      assert.equal(map.objects.filter(item => item.object === "FoldedLinens").length,
        objects.filter(item => item.object === "FoldedLinens").length);
      assert.deepEqual(map.objects.find(item => item.id === `castle-authored-${linens.id}`).position,
        linens.position);
      const half = 0.55 * support.scale / 2;
      assert.ok(Math.abs(linens.position.x - support.position.x) + 0.3 * linens.scale / 2 <= half);
      assert.ok(Math.abs(linens.position.z - support.position.z) + 0.3 * linens.scale / 2 <= half);
      supports.add(support.id);
      rotations.add(linens.rotation);
    }
    assert.equal(supports.size, 2);
    assert.equal(rotations.size, 4);
    assert.equal(walls.size, 2);
    assert.deepEqual(plan.objects, original);
  }
});
