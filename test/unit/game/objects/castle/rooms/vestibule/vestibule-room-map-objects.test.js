import assert from "node:assert/strict";
import { it } from "node:test";
import { CastleAuthoredBuildPlan } from "../../../../../../../src/game/generator/castle/CastleAuthoredBuildPlan.js";
import { VestibuleRoomMapObjects } from "../../../../../../../src/game/objects/castle/rooms/vestibule/VestibuleRoomMapObjects.js";

it("publishes independent Satchel objects with both authored finishes", async () => {
  const buildPlan = await CastleAuthoredBuildPlan.generate({
    seed: 4,
    basePlanId: "castle-compact-service-wing",
    position: {
      x: 0,
      z: 0,
      width: 16,
      depth: 12,
      elevation: 2,
    },
    doors: [{
      side: "NORTH",
      offset: 7,
      width: 2,
    }],
  });
  const map = {
    cols: 32,
    rows: 32,
    objects: [{
      id: "arrival-satchels",
      object: "Castle",
      buildPlan,
    }],
  };
  VestibuleRoomMapObjects.prepareMap(map);
  const bags = map.objects.filter(item => item.object === "Satchel");
  assert.equal(bags.length, 4);
  assert.deepEqual(bags.map(item => item.variant), ["brown", "olive", "brown", "olive"]);
  assert.ok(bags.every(item => item.sourceCastleId === "arrival-satchels" && Number.isFinite(item.position.y)));
  const first = structuredClone(bags);
  VestibuleRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.filter(item => item.object === "Satchel"), first);
});

it("publishes floor-correct vestibule props once and replaces them after reflection", async () => {
  const options = {
    seed: 20,
    basePlanId: "castle-demo-compact",
    position: {
      x: 0,
      z: 0,
      width: 8,
      depth: 8,
      elevation: 3,
    },
    doors: [{
      side: "SOUTH",
      offset: 1,
      width: 2,
    }],
  };
  const castle = {
    id: "arrival",
    object: "Castle",
    buildPlan: await CastleAuthoredBuildPlan.generate(options),
  };
  const map = {
    cols: 32,
    rows: 32,
    objects: [castle],
  };
  VestibuleRoomMapObjects.prepareMap(map);
  const first = structuredClone(map.objects.slice(1));
  assert.ok(first.length >= 5);
  assert.ok(first.every(item => item.generated && item.sourceCastleId === castle.id));
  assert.ok(first.every(item => item.position.y >= 3 && item.position.y < 6));
  const runner = first.find(item => item.object === "Rug");
  assert.equal(first.filter(item => item.object === "Rug").length, 1);
  assert.equal(runner.model, "vestibule-runner.glb");
  assert.ok(runner.stretch.z > 2, "one carpet spans both vestibule sections");
  const bench = first.find(item => item.object === "VestibuleBench");
  const cloaks = first.find(item => item.object === "VestibuleCloakRail");
  const facing = bench.rotation * Math.PI / 180;
  // The cloak rail sits behind the backrest, toward the supporting wall.
  assert.ok((bench.position.x - cloaks.position.x) * Math.sin(facing) +
    (bench.position.z - cloaks.position.z) * Math.cos(facing) > 0);
  VestibuleRoomMapObjects.prepareMap(map);
  assert.deepEqual(map.objects.slice(1), first);
  castle.buildPlan = await CastleAuthoredBuildPlan.generate({
    ...options,
    seed: 21,
  });
  VestibuleRoomMapObjects.prepareMap(map);
  const expected = castle.buildPlan.metadata.runtime.residential.furniture.filter(item => item.role === "vestibuleProp");
  const rugCount = expected.filter(item => item.object === "Rug").length;
  assert.equal(map.objects.length, expected.length + 1 - (rugCount - 1));
  assert.equal(map.objects.filter(item => item.object === "Rug").length, 1);
  assert.equal(new Set(map.objects.map(item => item.id)).size, map.objects.length);
  assert.notDeepEqual(map.objects.slice(1), first);
});

it("publishes exactly one central island in each variant and reflected service-wing castle", async () => {
  for (const seed of [4, 5, 10, 11]) {
    const castle = {
      id: "wide-arrival",
      object: "Castle",
      buildPlan: await CastleAuthoredBuildPlan.generate({
        seed,
        basePlanId: "castle-compact-service-wing",
        position: {
          x: 0,
          z: 0,
          width: 16,
          depth: 12,
          elevation: 2,
        },
        doors: [{
          side: "NORTH",
          offset: 7,
          width: 2,
        }],
      }),
    };
    const map = {
      cols: 24,
      rows: 24,
      objects: [castle],
    };
    VestibuleRoomMapObjects.prepareMap(map);
    const first = structuredClone(map.objects.slice(1));
    const islands = first.filter(item => ["VestibuleIslandBench", "VestibuleMapTable"].includes(item.object));
    assert.equal(islands.length, 1);
    assert.equal(islands[0].object, seed < 6 ? "VestibuleIslandBench" : "VestibuleMapTable");
    assert.ok(islands.every(item => Math.abs(item.position.y - 2.033) < 1e-6 && item.scale === 1));
    const rug = first.find(item => item.object === "Rug");
    assert.ok(rug.stretch.x > 1 && rug.stretch.z < 1);
    const authored = castle.buildPlan.metadata.runtime.residential.furniture;
    const chest = authored.find(item => item.object === "WoodenStorageChest");
    assert.equal(chest.stretch.y, 0.82, "chest height is reduced by eighteen percent");
    assert.ok(chest.wallAttachment && !chest.placementIssue, "chest rear touches the wall");
    const chestBag = authored.find(item => item.object === "TravelKit" && item.supportId === chest.id);
    assert.ok(Math.abs(chestBag.y - (chest.y + chest.height * chest.scale)) < 1e-6, "luggage rests on the lowered lid");
    const console = authored.find(item => item.object === "WritingDesk");
    const room = castle.buildPlan.metadata.runtime.residential.spaces.find(item => item.id === console.roomId);
    assert.ok(console.wallAttachment, "console uses its measured rear mounting plane");
    assert.ok(Math.min(Math.abs(console.z - console.depth / 2 - room.minZ),
      Math.abs(console.z + console.depth / 2 - room.maxZ)) < 1e-6, "tabletop touches the wall face");
    const bench = authored.find(item => item.object === "VestibuleIslandBench");
    const bags = authored.filter(item => item.underSupport && item.supportId === bench?.id);
    assert.equal(bags.length, seed < 6 ? 4 : 0);
    for (const bag of bags) {
      assert.ok(!bag.placementIssue);
      assert.equal(bag.y, bench.y);
      assert.ok(Math.abs(bag.x - bench.x) + bag.width * bag.scale / 2 < bench.width / 2);
      assert.ok(Math.abs(bag.z - bench.z) + bag.depth * bag.scale / 2 < bench.depth / 2);
    }
    assert.equal(first.filter(item => item.object === "Satchel").length, bags.length);
    assert.deepEqual(first.filter(item => item.object === "Satchel").map(item => item.variant), bags.map(item => item.variant));
    assert.ok(!first.some(item => item.object === "VestibuleBench"));
    if (bench) { assert.equal(islands[0].stretch.x, 1.5); }
    assert.equal(first.filter(item => item.object === "WritingDesk").length, 1);
    assert.equal(first.filter(item => item.object === "TableLantern").length, 2);
    const arrivalStorage = authored.find(item => item.id.endsWith("arrival-storage"));
    assert.ok(arrivalStorage && !arrivalStorage.placementIssue, "storage fills the bay beneath the shield");
    assert.ok(authored.some(item => item.object === "FoldedLinens" && item.supportId === arrivalStorage.id));
    assert.ok(authored.filter(item => ["VestibuleIslandBench", "VestibuleMapTable"].includes(item.object))
      .every(item => !item.placementIssue));
    VestibuleRoomMapObjects.prepareMap(map);
    assert.deepEqual(map.objects.slice(1), first);
  }
});
