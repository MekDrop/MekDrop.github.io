import assert from "node:assert/strict";
import { test } from "node:test";
import { SceneObjectRegistry } from "../../../../../src/game/rendering/scene/SceneObjectRegistry.js";

test("retired ground stays alive until replacement is ready without replacing the live registry", () => {
  const live = new SceneObjectRegistry();
  const consumer = live;
  let destroyed = 0;
  const ground = {
    destroy: () => {
      destroyed += 1;
    },
  };
  live.add("mapObject", ground);
  live.getWithMethod("destroy");
  const retired = live.detach();
  live.destroyType("mapObject");
  assert.equal(destroyed, 0, "clearing the staging scene must not destroy visible ground");
  assert.deepEqual(retired.getAll("mapObject"), [ground]);
  assert.deepEqual(live.getWithMethod("destroy"), []);
  const replacement = { destroy: () => {} };
  live.add("mapObject", replacement);
  assert.deepEqual(consumer.getAll("mapObject"), [replacement]);
  retired.destroyType("mapObject");
  assert.equal(destroyed, 1);
  assert.deepEqual(live.getAll("mapObject"), [replacement]);
});
