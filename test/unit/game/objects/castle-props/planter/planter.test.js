import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Entity } from "playcanvas";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".glb?url")) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { Planter } = await import("../../../../../../src/game/objects/castle-props/planter/Planter.js");
hooks.deregister();

test("uses identical seeded foliage transforms for the visual and collision models", () => {
  const visual = new Entity();
  const collision = new Entity();
  for (let index = 0; index < 5; index++) {
    const name = index === 0 ? "Boxwood foliage" : `Boxwood foliage.${String(index).padStart(3, "0")}`;
    for (const root of [visual, collision]) {
      const foliage = new Entity(name);
      foliage.setLocalPosition(index * 0.1, index * 0.2, index * 0.05);
      root.addChild(foliage);
    }
  }
  const planter = { definition: { id: "saved-planter" } };
  Planter.prototype.prepareModel.call(planter, visual, false);
  Planter.prototype.prepareModel.call(planter, collision, true);
  for (let index = 0; index < 5; index++) {
    assert.deepEqual(visual.children[index].getLocalPosition(), collision.children[index].getLocalPosition());
  }
  visual.destroy();
  collision.destroy();
});
