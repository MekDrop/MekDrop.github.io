import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { RoomLayoutCache } from "../../../../src/game/cache/RoomLayoutCache.js";
import { ObjectDataCache } from "../../../../src/game/cache/ObjectDataCache.js";
import { CastleBasePlanGenerator } from "../../../../src/game/generator/castle/CastleBasePlanGenerator.js";
import { ServiceRoomGenerator } from "../../../../src/game/generator/castle/rooms/service/ServiceRoomGenerator.js";

const original = ObjectDataCache.data;
afterEach(() => {
  ObjectDataCache.finishRecording();
  ObjectDataCache.data = original;
  RoomLayoutCache.enabled = true;
});

test("room recipes bypass generation, isolate consumers, and respect the toggle and context", () => {
  const generator = new ServiceRoomGenerator();
  const room = {
    id: "service",
    minX: 0,
    maxX: 8,
    minZ: 0,
    maxZ: 8,
    floorY: 3,
    level: 0,
    height: 3,
    purpose: "Service",
  };
  const context = { seed: 12 };
  ObjectDataCache.beginRecording();
  const expected = RoomLayoutCache.resolve(generator, room, context);
  ObjectDataCache.data = JSON.parse(JSON.stringify(ObjectDataCache.finishRecording()));
  let calls = 0;
  const furnish = ServiceRoomGenerator.prototype.furnish;
  ServiceRoomGenerator.prototype.furnish = () => {
    calls++;

    return [];
  };
  try {
    const actual = RoomLayoutCache.resolve(generator, room, context);
    assert.deepEqual(actual, expected);
    actual.push({ role: "mutated" });
    assert.deepEqual(RoomLayoutCache.resolve(generator, room, context), expected);
    assert.equal(calls, 0);
    RoomLayoutCache.enabled = false;
    assert.deepEqual(RoomLayoutCache.resolve(generator, room, context), []);
    assert.equal(calls, 1);
    RoomLayoutCache.enabled = true;
    RoomLayoutCache.resolve(generator, room, { seed: 13 });
    RoomLayoutCache.resolve(generator, {
      ...room,
      maxX: 9,
    }, context);
    RoomLayoutCache.resolve(generator, room, {
      ...context,
      chimneys: [{ minX: 1 }],
    });
    assert.equal(calls, 4);
  } finally {
    ServiceRoomGenerator.prototype.furnish = furnish;
  }
});

test("baked authored room layouts preserve the complete plan through validation and mirroring", async () => {
  for (const seed of [12, 13]) {
    ObjectDataCache.beginRecording();
    const expected = await CastleBasePlanGenerator.generate({ seed });
    const cache = ObjectDataCache.finishRecording();
    assert.ok(Object.keys(cache.entries["room-layouts"]).length > 0);
    ObjectDataCache.data = JSON.parse(JSON.stringify(cache));
    assert.deepEqual(JSON.parse(JSON.stringify(await CastleBasePlanGenerator.generate({ seed }))),
      JSON.parse(JSON.stringify(expected)));
    RoomLayoutCache.enabled = false;
    assert.deepEqual(await CastleBasePlanGenerator.generate({ seed }), expected);
    RoomLayoutCache.enabled = true;
  }
});
