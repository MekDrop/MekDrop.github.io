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
        url: 'data:text/javascript,export function addAuthoredMeshPhysics() {}',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/DynamicRenderBatch.js")) {
      return {
        url: 'data:text/javascript,export class DynamicRenderBatch { destroy() {} }',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { Satchel } = await import("../../../../../../src/game/objects/castle-props/satchel/Satchel.js");
hooks.deregister();

test("variant selects matching visual and collision assets without changing placement", () => {
  for (const variant of [undefined, "brown", "olive"]) {
    const urls = [];
    const satchel = new Satchel({
      pc,
      modelLibrary: {
        instantiate: url => {
          urls.push(url);

          return new pc.Entity("model");
        },
      },
      definition: {
        id: "bag",
        object: "Satchel",
        variant,
        position: {
          x: 2,
          y: 3,
          z: 4,
        },
        rotation: 90,
        scale: 0.8,
      },
    });
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.endsWith(`vestibule-${variant ?? "brown"}-satchel.glb?url`)));
    assert.ok(Satchel.modelUrls.includes(urls[0]));
    assert.deepEqual(satchel.visualRoots[0].getPosition().toArray(), [2, 3, 4]);
    assert.equal(satchel.visualRoots[0].children[0].getLocalScale().x, 0.8);
    satchel.destroy();
  }
});
