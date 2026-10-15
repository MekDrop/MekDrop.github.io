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
    return nextResolve(specifier, context);
  },
});
const { SpareTimberBundle } = await import("../../../../../src/game/objects/spare-timber-bundle/SpareTimberBundle.js");
hooks.deregister();

const app = {
  _entityIndex: {},
  systems: { list: [] },
};

function build(overrides = {}) {
  const models = [];
  const stack = new SpareTimberBundle({
    pc,
    modelLibrary: {
      instantiate() {
        const model = new pc.Entity("model", app);
        const log = new pc.Entity("Stored spare timber board", app);
        log.setLocalPosition(0, 0.36, 0);
        model.addChild(log);
        models.push(model);
        return model;
      },
    },
    definition: {
      id: "pile",
      object: "SpareTimberBundle",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      width: 0.9,
      depth: 0.7,
      height: 0.35,
      ...overrides,
    },
  });
  return {
    stack,
    models,
  };
}
function snapshot(model) {
  return model.children.map(log => [Array.from(log.getLocalTransform().data)]);
}

test("seed reproduces placement for rendering, collision and reload", () => {
  const first = build({ timberSeed: 42 });
  const second = build({ timberSeed: 42 });
  const other = build({ timberSeed: 43 });
  assert.deepEqual(snapshot(first.models[0]), snapshot(first.models[1]));
  assert.deepEqual(snapshot(first.models[0]), snapshot(second.models[0]));
  assert.notDeepEqual(snapshot(first.models[0]), snapshot(other.models[0]));
  for (const result of [first, second, other]) { result.stack.destroy(); }
});


test("boards stay grounded and inside the requested dimensions", () => {
  for (const dimensions of [{
    width: 0.24,
    depth: 0.127,
    height: 0.72,
  },
  {
    width: 0.02,
    depth: 0.01,
    height: 0.03,
  }]) {
    const { stack, models } = build(dimensions);
    assert.ok(models[0].children.length > 0);
    for (const board of models[0].children) {
      for (const x of [-0.04, 0.04]) {
        for (const y of [-0.36, 0.36]) {
          for (const z of [-0.0175, 0.0175]) {
            const point = board.getLocalTransform().transformPoint(new pc.Vec3(x, y, z));
            assert.ok(Math.abs(point.x) <= dimensions.width / 2 + 1e-6);
            assert.ok(Math.abs(point.z) <= dimensions.depth / 2 + 1e-6);
            assert.ok(point.y >= -1e-6 && point.y <= dimensions.height + 1e-6);
          }
        }
      }
    }
    stack.destroy();
  }
});

test("invalid and excessive dimensions produce no boards", () => {
  for (const width of [0, -1, NaN, Infinity, 100000]) {
    const { stack, models } = build({ width });
    assert.equal(models[0].children.length, 0);
    stack.destroy();
  }
});
