import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

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
const { Table } = await import("../../../../../src/game/objects/table/Table.js");
hooks.deregister();

test("dimensions resize visible and collision models identically, retaining placement transforms", () => {
  const definition = Table.definitionFor({
    id: "wide-table",
    object: "Table",
    width: 2,
    height: 0.8,
    depth: 1,
    scale: 2,
    stretch: {
      x: 1,
      y: 1.5,
      z: 0.5,
    },
  });
  const visual = new pc.Entity();
  const collider = new pc.Entity();
  Table.prototype.prepareModel.call({ definition }, visual, false);
  Table.prototype.prepareModel.call({ definition }, collider, true);
  assert.deepEqual(visual.getLocalScale().toArray(), collider.getLocalScale().toArray());
  assert.ok(Math.abs(visual.getLocalScale().x * 0.6271365 - 4) < 1e-6);
  assert.ok(Math.abs(visual.getLocalScale().y * 0.56465894 - 2.4) < 1e-6);
  assert.ok(Math.abs(visual.getLocalScale().z * 1.25 - 1) < 1e-6);
  visual.destroy();
  collider.destroy();
});
