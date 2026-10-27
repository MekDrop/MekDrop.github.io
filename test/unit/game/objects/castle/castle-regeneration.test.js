import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../../../../src/game/objects/castle/Castle.js", import.meta.url), "utf8");
const start = source.indexOf("  async regenerate(seed) {");
const end = source.indexOf("\n  get definition()", start);
const methods = source.slice(start, end).replaceAll("#", "_");

test("generates during the mist and waits for both before replacing", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let completeGeneration;
  let generated = false;
  let replaced = false;
  const plan = { input: {} };
  const generator = {
    generate: () => {
      generated = true;

      return new Promise((resolve) => {
        completeGeneration = resolve;
      });
    },
  };
  class Effect {
    finish() {}
    destroy() {}
  }
  const Driver = new Function("CastleGenerator", "CastleSwapEffect", "SCENE_OBJECT_TYPE", `return class Castle { ${methods} }`)(generator, Effect, { MAP_OBJECT: "mapObject" });
  const castle = new Driver();
  castle.entity = {};
  castle._definition = { buildPlan: { input: { position: {} } } };
  castle._runtime = {
    objects: { getAll: () => [] },
    replaceObjectDefinition: async (definition) => {
      assert.equal(definition.buildPlan, plan);
      replaced = true;

      return true;
    },
  };
  castle._findObject = () => false;
  const pending = castle.regenerate(42);
  assert.equal(generated, true);
  assert.equal(await castle.regenerate(43), null);
  completeGeneration(plan);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(replaced, false);
  t.mock.timers.tick(1200);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(replaced, true);
  t.mock.timers.tick(1700);
  assert.equal(await pending, 42);
  assert.equal(castle._regenerating, false);
});
