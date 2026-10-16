import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith(".glb?url")) {
      return {
        url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/AuthoredMeshPhysics.js")) {
      return {
        url: 'data:text/javascript,export function addAuthoredMeshPhysics(pc, root, graph) { root.contactGraph = graph; }',
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
const { Brazier } = await import("../../../../../../src/game/objects/castle-props/brazier/Brazier.js");
hooks.deregister();

class BrazierEntity extends pc.Entity {
  /**
   * @param {string} type
   * @param {Record<string, number>} options
   */
  addComponent(type, options) {
    this[type] = options;
  }
}

test("bowl and tower retain distinct model transforms, contact and effect defaults with owned cleanup", () => {
  for (const variant of ["bowl", "tower", "lit-tower"]) {
    const app = new pc.EventHandler();
    app.assets = { find: () => ({ resource: {} }) };
    const urls = [];
    const brazier = new Brazier({
      pc: {
        ...pc,
        Entity: BrazierEntity,
      },
      app,
      runtime: {
        mapData: {
          islandConnectorData: {
            nearIsland: ["0,0"],
            farIsland: ["1,0"],
          },
        },
      },
      modelLibrary: {
        instantiate: (url) => {
          urls.push(url);

          return new BrazierEntity("model");
        },
      },
      definition: {
        id: variant,
        object: "Brazier",
        variant: variant === "bowl" ? "bowl" : "tower",
        flame: variant === "lit-tower" ? true : undefined,
        position: {
          x: 4,
          y: 3,
          z: 2,
        },
        rotation: 90,
        tile: {
          col: 0,
          row: 0,
        },
        scale: variant === "bowl" ? 0.25 : 2,
      },
    });
    const root = brazier.visualRoots[0];
    const tower = variant !== "bowl";
    assert.equal(urls.length, tower ? 2 : 1);
    assert.equal(Boolean(root.contactGraph), tower);
    assert.ok(urls.every(url => url.endsWith(tower ? "tower-brazier.glb?url" : "residential/brazier.glb?url")));
    assert.deepEqual(root.children[0].getLocalScale().toArray(), tower ? [2, 2, 2] : [0.375, 0.06, 0.375]);
    assert.equal(root.findByName("Fire glow") !== null, variant !== "tower");
    if (variant !== "tower") {
      assert.ok(root.findByName("Fire sparks"));
      const before = root.findByName("Fire glow").light.intensity;
      app.fire("update", 0.3);
      assert.notEqual(root.findByName("Fire glow").light.intensity, before);
    }
    brazier.setIslandOffsets(5, 9);
    assert.equal(root.getPosition().y, 8);
    if (variant !== "tower") {
      assert.ok(Math.abs(root.findByName("Fire effect").getPosition().y - (variant === "bowl" ? 8 : 9.4)) < 0.000001);
    }
    brazier.destroy();
    assert.equal(app.hasEvent("update"), false);
  }
});
