import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
const map = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
it("keeps ten unique labelled seeds and reproduces original castle styles", async () => {
  const castles = map.objects.filter((object) => object.object === "Castle");
  assert.equal(castles.length, 10);
  assert.equal(new Set(castles.map((castle) => castle.seed)).size, 10);
  assert.ok(new Set(castles.map((castle) => castle.buildPlan.layout.style.id)).size > 1);
  for (const castle of castles) {
    const input = castle.buildPlan.input;
    assert.equal(input.seed, castle.seed);
    assert.deepEqual(await CastleGenerator.generate({ position: input.position, doors: input.doors, seed: castle.seed, style: input.requestedStyle }), castle.buildPlan);
    assert.ok(map.objects.some((object) => object.object === "WoodenSign" && object.text.includes(castle.seed)));
  }
});
it("keeps unseeded generation and explicit original styles deterministic", async () => {
  const options = { position: { x: 0, z: 0, width: 12, depth: 12, elevation: 2 }, doors: [{ side: "SOUTH", offset: 5, width: 2 }] };
  assert.deepEqual(await CastleGenerator.generate(options), await CastleGenerator.generate(options));
  const plan = await CastleGenerator.generate({ ...options, style: "single-tower", seed: "fixed-style" });
  assert.equal(plan.layout.style.id, "single-tower");
});
