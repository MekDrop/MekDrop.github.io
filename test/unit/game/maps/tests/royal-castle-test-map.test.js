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
    assert.deepEqual(castle.buildPlan.input.position, castle.position);
    assert.deepEqual(castle.buildPlan.input.doors, castle.doors);
    assert.equal(castle.buildPlan.input.requestedStyle, castle.style);
  }
  for (const castle of map.objects.filter(
    ({ object }) => object === "Castle",
  )) {
    assert.deepEqual(castle.buildPlan.input.position, castle.position);
    assert.deepEqual(castle.buildPlan.input.doors, castle.doors);
    assert.equal(castle.buildPlan.input.requestedStyle, castle.style);
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
  assert.equal(southEdge, 10);
  assert.equal(trigger.position.x, 0);
});

it("starts the hero two tiles away from the middle activation tile", () => {
  const trigger = map.objects.find(({ object }) => object === "TriggerArea");
  assert.equal(map.heroSpawn.x, trigger.position.x);
  assert.equal(map.heroSpawn.z - trigger.position.z, 2);
});
