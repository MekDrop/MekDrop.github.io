import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const map = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../src/game/maps/tests/royal-castles.json",
      import.meta.url,
    ),
  ),
);

it("gives the king, queen, and princess independent castles and one shared trigger", () => {
  assert.equal(map.castles.length, 3);
  assert.equal(
    map.objects.filter(({ object }) => object === "Castle").length,
    3,
  );
  for (const castle of map.objects.filter(
    ({ object }) => object === "Castle",
  )) {
    assert.equal(castle.buildPlan, undefined);
    assert.ok(castle.seed);
    assert.equal(castle.position.width, 28);
    assert.equal(castle.position.depth, 16);
  }
  for (const castle of map.objects.filter(
    ({ object }) => object === "Castle",
  )) {
    assert.equal(castle.buildPlan, undefined);
    assert.ok(castle.seed);
    assert.equal(castle.position.width, 28);
    assert.equal(castle.position.depth, 16);
  }
  const residents = map.objects.filter(({ object }) =>
    ["King", "Queen", "Princess", "Servant"].includes(object),
  );
  assert.deepEqual(
    residents.map(({ object, castleIndex }) => [object, castleIndex]),
    [
      ["King", 0],
      ["Servant", 0],
      ["Queen", 1],
      ["Servant", 1],
      ["Princess", 2],
      ["Servant", 2],
    ],
  );
  const triggers = map.objects.filter(({ object }) => object === "TriggerArea");
  assert.equal(triggers.length, 1);
  const [trigger] = triggers;
  assert.equal(trigger.color, "#d8aa3d");
  assert.match(trigger.script, /setRoyalActivityTriggered/);
  const middleCastle = map.castles[1];
  const southEdge = middleCastle.position.row + middleCastle.position.depth - 1;
  assert.equal(trigger.position.z, 4);
  assert.ok(southEdge < map.rows - 1);
  assert.equal(trigger.position.x, 0);
});

it("starts the hero outside the middle activation tile", () => {
  const trigger = map.objects.find(({ object }) => object === "TriggerArea");
  assert.ok(Math.abs(map.heroSpawn.x - trigger.position.x) <= 0.5);
  assert.ok(map.heroSpawn.z - trigger.position.z >= 2);
});
