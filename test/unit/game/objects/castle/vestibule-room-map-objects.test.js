import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { VestibuleRoomMapObjects } from "../../../../../src/game/objects/castle/VestibuleRoomMapObjects.js";

it("publishes floor-correct vestibule props once and replaces them after reflection", async () => {
  const options = { seed: 20, basePlanId: "castle-demo-compact",
    position: { x: 0, z: 0, width: 8, depth: 8, elevation: 3 },
    doors: [{ side: "SOUTH", offset: 1, width: 2 }] };
  const castle = { id: "arrival", object: "Castle", buildPlan: await CastleAuthoredBuildPlan.generate(options) };
  const map = { cols: 32, rows: 32, objects: [castle] };
  VestibuleRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.length >= 5);
  assert.ok(first.every(item => item.generated && item.sourceCastleId === castle.id));
  assert.ok(first.every(item => item.position.y >= 3 && item.position.y < 6));
  const runner = first.find(item => item.object === "VestibuleRug");
  assert.equal(first.filter(item => item.object === "VestibuleRug").length, 1);
  assert.ok(runner.stretch.z > 2, "one carpet spans both vestibule sections");
  const bench = first.find(item => item.object === "VestibuleBench");
  const cloaks = first.find(item => item.object === "VestibuleCloakRail");
  const facing = bench.rotation * Math.PI / 180;
  // The cloak rail sits behind the backrest, toward the supporting wall.
  assert.ok((bench.position.x - cloaks.position.x) * Math.sin(facing) +
    (bench.position.z - cloaks.position.z) * Math.cos(facing) > 0);
  VestibuleRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
  castle.buildPlan = await CastleAuthoredBuildPlan.generate({ ...options, seed: 21 });
  VestibuleRoomMapObjects.prepareMap(map);
  const expected = castle.buildPlan.metadata.runtime.residential.furniture.filter(item => item.role === "vestibuleProp");
  const rugCount = expected.filter(item => item.object === "VestibuleRug").length;
  assert.equal(map.objects.length, expected.length + 1 - (rugCount - 1));
  assert.equal(map.objects.filter(item => item.object === "VestibuleRug").length, 1);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
  assert.notDeepEqual(map.objects.slice(1), first);
});
