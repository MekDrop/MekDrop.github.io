import assert from "node:assert/strict";
import { it } from "node:test";
import { readFileSync } from "node:fs";
import { SpiralStairStorage } from "../../../../../../../src/game/generator/castle/rooms/stairwell/SpiralStairStorage.js";
import { CastleGenerator } from "../../../../../../../src/game/generator/castle/CastleGenerator.js";
import { CastleAuthoredMapObjects } from "../../../../../../../src/game/objects/castle/structure/CastleAuthoredMapObjects.js";

const tower = {
  center: [8, 1.75],
  radius: 3.25,
  wallThickness: 0.5,
};
const dimensions = {
  Chest: [0.7, 0.55, 0.32914],
  Crate: [0.55, 0.55, 0.4702],
  Barrel: [0.554, 0.554, 0.65],
  PotteryJar: [0.229, 0.236, 0.3],
  WaterBucket: [0.3, 0.28, 0.4],
};

it("fills the open half below the upper spiral while preserving the doorway and lower flight", () => {
  const props = SpiralStairStorage.furnish(tower);
  const bounds = [];
  assert.deepEqual(props, SpiralStairStorage.furnish(tower));
  assert.deepEqual(new Set(props.map(prop => prop.object)), new Set(Object.keys(dimensions)));
  for (const prop of props) {
    const [width, depth, height] = dimensions[prop.object].map(value => value * prop.scale);
    const angle = prop.rotation * Math.PI / 180;
    const halfX = (width * Math.abs(Math.cos(angle)) + depth * Math.abs(Math.sin(angle))) / 2;
    const halfZ = (width * Math.abs(Math.sin(angle)) + depth * Math.abs(Math.cos(angle))) / 2;
    const box = {
      id: prop.id,
      minX: prop.position.x - halfX,
      maxX: prop.position.x + halfX,
      minZ: prop.position.z - halfZ,
      maxZ: prop.position.z + halfZ,
      minY: prop.position.y,
      maxY: prop.position.y + height,
    };
    for (const other of bounds) {
      const overlapX = Math.min(box.maxX, other.maxX) - Math.max(box.minX, other.minX);
      const overlapY = Math.min(box.maxY, other.maxY) - Math.max(box.minY, other.minY);
      const overlapZ = Math.min(box.maxZ, other.maxZ) - Math.max(box.minZ, other.minZ);
      assert.ok(Math.min(overlapX, overlapY, overlapZ) < 0.005, `${prop.id} intersects ${other.id}`);
    }
    bounds.push(box);
    for (const dx of [-width / 2, width / 2]) {
      for (const dz of [-depth / 2, depth / 2]) {
        const x = prop.position.x - tower.center[0] + dx * Math.cos(angle) + dz * Math.sin(angle);
        const z = prop.position.z - tower.center[1] - dx * Math.sin(angle) + dz * Math.cos(angle);
        assert.ok(Math.hypot(x, z) > 0.4, `${prop.id} intrudes into the central column`);
        assert.ok(Math.hypot(x, z) < 2.75, `${prop.id} intrudes into the wall`);
        assert.ok(x < -0.65, `${prop.id} obstructs the doorway and stair approach`);
        if (Math.hypot(x, z) <= 1.77) {
          const progress = (Math.atan2(x, z) * 180 / Math.PI - 90 + 360) % 360;
          const underside = progress < 240 ? Math.floor(progress / 12) * 0.2 : 3.75;
          assert.ok(prop.position.y + height + 0.15 <= underside, `${prop.id} intersects a tread`);
        }
      }
    }
    assert.ok(prop.position.y + height < 1.2);
    if (prop.position.y > 0.01) {
      const support = props.find(candidate => candidate !== prop &&
        candidate.position.x === prop.position.x && candidate.position.z === prop.position.z &&
        Math.abs(candidate.position.y + dimensions[candidate.object][2] * candidate.scale - prop.position.y) < 1e-6);
      assert.ok(support, `${prop.id} has no supporting prop`);
    }
  }
});

it("extends toward the foreground and retains its side beneath reflected spiral flights", () => {
  const props = SpiralStairStorage.furnish(tower);
  assert.ok(props.some(prop => prop.position.z > tower.center[1] + 1.5));
  assert.ok(props.some(prop => Math.hypot(prop.position.x - tower.center[0], prop.position.z - tower.center[1]) < 1.4));
  for (const axis of ["x", "z"]) {
    const reflected = SpiralStairStorage.furnish(tower, axis);
    for (const [index, prop] of reflected.entries()) {
      const center = tower.center[axis === "x" ? 0 : 1];
      assert.ok(Math.abs(prop.position[axis] - (2 * center - props[index].position[axis])) < 1e-6);
      assert.equal(prop.position.y, props[index].position.y);
    }
  }
});

it("leaves tight towers and plans without a round tower unfurnished", () => {
  assert.deepEqual(SpiralStairStorage.furnish(), []);
  assert.deepEqual(SpiralStairStorage.furnish({
    ...tower,
    radius: 2.25,
  }), []);
});

it("publishes spiral supplies as ordinary map objects without duplicates or upper-floor piles", async () => {
  const map = JSON.parse(readFileSync(new URL("../../../../../../../src/game/maps/tests/castle-rear-bell-tower.json", import.meta.url)));
  const castle = map.objects.find(item => item.object === "Castle");
  castle.buildPlan = await CastleGenerator.generate(castle);
  CastleAuthoredMapObjects.prepareMap(map);
  const props = map.objects.filter(item => item.id.includes("spiral-storage-"));
  assert.equal(props.length, SpiralStairStorage.furnish(tower).length);
  assert.ok(props.every(item => item.generated && item.authoredCastleFixture && item.sourceCastleId === castle.id));
  assert.ok(props.every(item => item.position.y < 3.2));
  CastleAuthoredMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.filter(item => item.id.includes("spiral-storage-")), props);
});
