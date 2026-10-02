import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { CastleGenerator } from "../../../../../src/game/generator/castle/CastleGenerator.js";
const map = JSON.parse(readFileSync(new URL("../../../../../src/game/maps/tests/castle-seeds.json", import.meta.url), "utf8"));
it("keeps ten unique labelled seeds and reproduces original castle styles", async () => {
  const castles = map.objects.filter((object) => object.object === "Castle");
  assert.equal(castles.length, 10);
  assert.equal(new Set(castles.map((castle) => castle.seed)).size, 10);
  const styles = new Set();
  for (const castle of castles) {
    assert.equal(castle.buildPlan, undefined);
    const plan = await CastleGenerator.generate(castle);
    styles.add(plan.layout.style.id);
    assert.deepEqual(await CastleGenerator.generate(castle), plan);
    assert.ok(map.objects.some((object) => object.object === "WoodenSign" && object.text.includes(castle.seed)));
  }
  assert.ok(styles.size > 1);
});
it("keeps unseeded generation and explicit original styles deterministic", async () => {
  const options = { position: { x: 0, z: 0, width: 12, depth: 12, elevation: 2 }, doors: [{ side: "SOUTH", offset: 5, width: 2 }] };
  assert.deepEqual(await CastleGenerator.generate(options), await CastleGenerator.generate(options));
  const plan = await CastleGenerator.generate({ ...options, style: "single-tower", seed: "fixed-style" });
  assert.equal(plan.layout.style.id, "single-tower");
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
      assert.ok(castle.position && castle.doors, `${name}: generation inputs are required`);
    }
  }
});
