import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { expandCastles } from "../../../../scripts/object-cache/expand-castles.mjs";

test("saved castle recipes retain ID-seeded variants and generated interiors", async () => {
  const map = JSON.parse(readFileSync(new URL("../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
  const castle = map.objects.find((definition) => definition.object === "Castle");
  const records = await expandCastles([castle, {
    ...castle,
    id: "duplicate",
  }]);
  const types = new Set(records.map((definition) => definition.object));
  assert.ok(types.has("Shelf"));
  assert.ok(types.has("Bowl"));
  assert.ok(types.has("StraightStaircase"));
  assert.ok(records.some((definition) => definition.sourceCastleId === "duplicate"));
  for (const definition of records) {
    assert.ok([castle.id, "duplicate"].includes(definition.sourceCastleId));
  }
});
