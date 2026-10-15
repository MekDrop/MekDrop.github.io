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
const { FirewoodStack } = await import("../../../../../src/game/objects/firewood-stack/FirewoodStack.js");
hooks.deregister();

const app = {
  _entityIndex: {},
  systems: { list: [] },
};

function build(overrides = {}) {
  const models = [];
  const stack = new FirewoodStack({
    pc,
    modelLibrary: {
      instantiate() {
        const model = new pc.Entity("model", app);
        const log = new pc.Entity("Cut firewood log 1-1", app);
        model.addChild(log);
        models.push(model);
        return model;
      },
    },
    definition: {
      id: "pile",
      object: "FirewoodStack",
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
  const first = build({ firewoodSeed: 42 });
  const second = build({ firewoodSeed: 42 });
  const other = build({ firewoodSeed: 43 });
  assert.deepEqual(snapshot(first.models[0]), snapshot(first.models[1]));
  assert.deepEqual(snapshot(first.models[0]), snapshot(second.models[0]));
  assert.notDeepEqual(snapshot(first.models[0]), snapshot(other.models[0]));
  for (const result of [first, second, other]) { result.stack.destroy(); }
});

test("all authored log corners stay inside the supplied area", () => {
  for (const dimensions of [{
    width: 0.9,
    depth: 0.7,
    height: 0.35,
  },
  {
    width: 0.03,
    depth: 0.04,
    height: 0.02,
  }]) {
    const { stack, models } = build(dimensions);
    assert.ok(models[0].children.length > 0);
    for (const log of models[0].children) {
      for (const x of [-0.04431636, 0.04431636]) {
        for (const y of [-0.19, 0.19]) {
          for (const z of [-0.045, 0.04228617]) {
            const point = log.getLocalTransform().transformPoint(new pc.Vec3(x, y, z));
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

test("a hearth pile has three, two, then one log, each upper log cradled by two below", () => {
  const { stack, models } = build({
    width: 0.269,
    depth: 0.38,
    height: 0.2433,
  });
  const logs = models[0].children;
  const courses = [0, 1, 2].map(layer => logs.filter(log => log.name.startsWith(`Firewood log ${layer}-`)));
  assert.deepEqual(courses.map(course => course.length), [3, 2, 1]);
  for (let layer = 1; layer < courses.length; layer++) {
    for (let index = 0; index < courses[layer].length; index++) {
      const upper = courses[layer][index].getLocalPosition();
      const left = courses[layer - 1][index].getLocalPosition();
      const right = courses[layer - 1][index + 1].getLocalPosition();
      assert.ok(Math.abs(upper.x - (left.x + right.x) / 2) < 1e-6);
      assert.ok(Math.abs(Math.hypot(upper.x - left.x, upper.y - left.y) - 0.0872862) < 1e-6);
    }
  }
  stack.destroy();
});

test("empty, invalid and excessive areas do not allocate log piles", () => {
  for (const width of [0, -1, NaN, Infinity, 100000]) {
    const { stack, models } = build({ width });
    assert.equal(models[0].children.length, 0);
    stack.destroy();
  }
});
