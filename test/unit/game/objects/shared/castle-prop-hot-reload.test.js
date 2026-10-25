import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as pc from "playcanvas";

const hooks = registerHooks({
  load: (url, context, nextLoad) => {
    const loaded = nextLoad(url, context);
    if (url.endsWith("/AbstractCastleProp.js")) {
      return {
        ...loaded,
        source: loaded.source.toString().replaceAll("import.meta.env?.DEV", "true"),
      };
    }
    return loaded;
  },
  resolve: (specifier, context, nextResolve) => {
    if (specifier.endsWith("/AuthoredMeshPhysics.js")) {
      return {
        url: "data:text/javascript,export function addAuthoredMeshPhysics() {}",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { AbstractCastleProp } = await import("../../../../../src/game/objects/shared/AbstractCastleProp.js");
hooks.deregister();

class Chair extends AbstractCastleProp {
  static developmentVisualOnly = true;
  static get modelUrl() {
    return "old.glb";
  }
}

test("repeated visual replacement preserves the root, definition and lifecycle ownership", () => {
  const definition = {
    id: "seat",
    object: "Chair",
    position: {
      x: 1,
      y: 2,
      z: 3,
    },
    rotation: 90,
  };
  const chair = new Chair({
    pc: {
      ...pc,
      Application: { getApplication: () => ({}) },
    },
    definition,
    modelLibrary: { instantiate: url => new pc.Entity(url) },
  });
  const root = chair.entity;
  const parent = new pc.Entity("map");
  parent.addChild(root);
  chair.setIslandOffsets(1, 2);
  const Updated = class Chair extends AbstractCastleProp {
    static developmentVisualOnly = true;
    static get modelUrl() {
      return "updated.glb";
    }
  };
  assert.equal(chair.canReloadDevelopment(Updated), true);
  for (let pass = 0; pass < 3; pass++) {
    const previousVisual = chair.visualRoots[0];
    let retired = 0;
    previousVisual.on("destroy", () => retired++);
    chair.reloadDevelopment(Updated);
    assert.equal(retired, 1);
    assert.equal(chair.entity, root);
    assert.equal(chair.entity.parent, parent);
    assert.equal(chair.entity.children.length, 1);
    assert.equal(chair.definition, definition);
    assert.equal(chair.modelUrl, "updated.glb");
    assert.deepEqual(chair.visualRoots[0].getLocalPosition().toArray(), [1, 2, 3]);
    assert.equal(chair.visualRoots[0].children[0].name, "updated.glb");
  }
  chair.destroy();
  assert.equal(parent.children.length, 0);
});

test("stateful or changed-base classes require the map lifecycle", () => {
  const chair = new Chair({
    pc,
    definition: {
      id: "seat",
      object: "Chair",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
    },
    modelLibrary: { instantiate: () => new pc.Entity("model") },
  });
  class Stateful extends AbstractCastleProp {}
  class Derived extends Chair {}
  assert.equal(chair.canReloadDevelopment(Stateful), false);
  assert.equal(chair.canReloadDevelopment(Derived), false);
  assert.equal(chair.canReloadDevelopment(undefined), false);
  chair.destroy();
});
