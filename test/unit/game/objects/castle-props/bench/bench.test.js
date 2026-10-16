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
    if (specifier.endsWith("/AuthoredMeshPhysics.js")) {
      return {
        url: "data:text/javascript,export function addAuthoredMeshPhysics(pc, root, graph) { root.authoredCollider = graph; }",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { Bench } = await import("../../../../../../src/game/objects/castle-props/bench/Bench.js");
hooks.deregister();

test("both models preserve authored visual and collision transforms", () => {
  for (const [object, variant] of [["Bench", "wall"], ["Bench", "island"]]) {
    const models = [];
    const definition = {
      id: "seating",
      object,
      variant,
      position: {
        x: 2,
        y: 3.033,
        z: -4,
      },
      rotation: 90,
      scale: 0.8,
      stretch: {
        x: 1.5,
        y: 1.2,
        z: 0.9,
      },
    };
    const bench = new Bench({
      pc,
      definition,
      modelLibrary: {
        instantiate(url) {
          const entity = new pc.Entity(url);
          models.push(entity);

          return entity;
        },
      },
    });
    assert.equal(bench.definition.object, "Bench");
    assert.equal(bench.definition.variant, variant);
    assert.equal(models.length, 2);
    assert.equal(models[0].name, Bench.modelUrls[variant === "island" ? 1 : 0]);
    assert.equal(models[0].name, models[1].name);
    assert.deepEqual(models[0].getLocalScale().toArray(), models[1].getLocalScale().toArray());
    assert.deepEqual(models[0].getLocalScale().toArray(), [1.2000000000000002, 0.96, 0.7200000000000001]);
    const root = bench.visualRoots[0];
    assert.equal(root.authoredCollider, models[1]);
    assert.deepEqual(root.getLocalPosition().toArray(), [2, 3.033, -4]);
    assert.ok(Math.abs(root.getLocalEulerAngles().y - 90) < 1e-5);
    bench.destroy();
  }
});
