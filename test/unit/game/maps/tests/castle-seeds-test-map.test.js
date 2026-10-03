import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
const map = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
it("keeps one reproducible castle with a seed sign and a nearby regeneration trigger", async () => {
  const castles = map.objects.filter((object) => object.object === "Castle");
  assert.equal(castles.length, 1);
  const castle = castles[0];
  assert.equal(typeof castle.seed, "number");
  assert.equal(castle.basePlanId, undefined);

  assert.equal(castle.buildPlan, undefined);
  assert.equal(map.objects.find((object) => object.id === castle.seedSignId).text, `Seed ${castle.seed}`);
  const trigger = map.objects.find((object) => object.object === "TriggerArea");
  assert.ok(trigger.position.z < castle.position.z);
  assert.match(trigger.script, /if \(active\)/);
  assert.match(trigger.script, /regenerateRandomSeed/);
  assert.deepEqual(await CastleGenerator.generate(castle), await CastleGenerator.generate(castle));
  const selected = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const plan = await CastleGenerator.generate({ ...castle, seed });
    selected.add(plan.layout.basePlanId);
    assert.equal(plan.input.basePlanId, undefined);

    assert.ok(plan.geometry.boxes.every((brick) => brick.sx <= 0.250001 && brick.sy <= 0.250001 && brick.sz <= 0.250001));
    for (const brick of plan.geometry.boxes) {
      assert.ok(brick.x >= -20 && brick.x <= 20 && brick.z >= -20 && brick.z <= 20, "castle stays on the fixture island");
    }
  }
  assert.deepEqual([...selected], ["castle-demo-compact"]);
});
it("uses seed-only generation without a mode flag or legacy style", async () => {
  const options = { position: { x: 0, z: 0, width: 28, depth: 16, elevation: 2 }, doors: [{ side: "SOUTH", offset: 5, width: 2 }] };
  assert.deepEqual(await CastleGenerator.generate(options), await CastleGenerator.generate(options));
  const plan = await CastleGenerator.generate({ ...options, style: "single-tower", seed: "fixed-style" });
  assert.equal(plan.layout.basePlanId, (await CastleGenerator.generate({ ...options, seed: "fixed-style" })).layout.basePlanId);
});

it("stores generation inputs rather than castle layouts in every test map", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const directory = new URL("../../../../../src/game/maps/tests/", import.meta.url);
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json")) continue;
    const data = JSON.parse(await readFile(new URL(name, directory), "utf8"));
    for (const castle of data.objects ?? []) {
      if (castle.object !== "Castle") continue;
      assert.equal(castle.buildPlan, undefined, name);
      assert.equal(castle.useBasePlans, undefined, name);
      assert.equal(castle.basePlanId, undefined, name);
      assert.ok(castle.seed !== undefined, name);
      assert.ok(castle.position && castle.doors, `${name}: generation inputs are required`);
    }
  }
});
