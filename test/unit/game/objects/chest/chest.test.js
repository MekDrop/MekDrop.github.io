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
const { Chest } = await import("../../../../../src/game/objects/chest/Chest.js");
hooks.deregister();

test("saved chest names migrate idempotently without changing authored properties", () => {
  const definition = {
    id: "old-chest",
    object: "WoodenStorageChest",
    position: {
      x: 2,
      y: 3,
      z: 4,
    },
    rotation: 90,
    scale: 0.8,
    stretch: {
      x: 1,
      y: 0.82,
      z: 1,
    },
    weathering: 0.3,
  };
  const expected = {
    ...structuredClone(definition),
    object: "Chest",
  };
  const map = { objects: [definition] };
  Chest.prepareMap(map);
  Chest.prepareMap(map);
  assert.deepEqual(definition, expected);
});

test("chest retains the authored visual and collision asset and transforms", () => {
  const urls = [];
  const chest = new Chest({
    pc,
    modelLibrary: {
      instantiate: url => { urls.push(url);

        return new pc.Entity("model"); },
    },
    definition: {
      id: "chest",
      object: "Chest",
      position: {
        x: 2,
        y: 3,
        z: 4,
      },
      rotation: 90,
      scale: 0.8,
      stretch: {
        x: 1,
        y: 0.82,
        z: 1,
      },
    },
  });
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => url.endsWith("wooden-storage-chest.glb?url")));
  assert.deepEqual(chest.visualRoots[0].getPosition().toArray(), [2, 3, 4]);
  assert.ok(Math.abs(chest.visualRoots[0].children[0].getLocalScale().y - 0.656) < 1e-6);
  chest.destroy();
});
