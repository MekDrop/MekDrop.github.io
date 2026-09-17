import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const map = JSON.parse(readFileSync(new URL(
  "../../src/game/maps/tests/royal-castles.json",
  import.meta.url,
)));

it("gives the king, queen, and princess independent castles and one shared trigger", () => {
  assert.equal(map.castles.length, 3);
  assert.deepEqual(map.castles.map(({ occupantSeed }) => occupantSeed), [0, 1, 2]);
  assert.equal(map.royalCastleTriggers.length, 1);
  const [trigger] = map.royalCastleTriggers;
  assert.equal(trigger.royal, "All royals");
  assert.deepEqual(trigger.castleIndexes, [0, 1, 2]);
  const middleCastle = map.castles[1];
  const southEdge = middleCastle.position.row + middleCastle.position.depth - 1;
  assert.equal(trigger.row - southEdge, 2);
  assert.ok(trigger.col >= middleCastle.position.col);
  assert.ok(trigger.col < middleCastle.position.col + middleCastle.position.width);
});

it("starts the hero two tiles away from the middle activation tile", () => {
  const [trigger] = map.royalCastleTriggers;
  const triggerX = trigger.col - (map.cols - 1) / 2;
  const triggerZ = trigger.row - (map.rows - 1) / 2;
  assert.equal(map.heroSpawn.x, triggerX);
  assert.equal(map.heroSpawn.z - triggerZ, 2);
});
