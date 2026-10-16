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
const { FoldedLinens } = await import("../../../../../../src/game/objects/castle-props/folded-linens/FoldedLinens.js");
hooks.deregister();

const app = {
  _entityIndex: {},
  systems: { list: [] },
};

function build(overrides = {}) {
  const models = [];
  const stack = new FoldedLinens({
    pc,
    modelLibrary: {
      instantiate() {
        const model = new pc.Entity("model", app);
        const log = new pc.Entity("folded-linens", app);
        model.addChild(log);
        models.push(model);

        return model;
      },
    },
    definition: {
      id: "pile",
      object: "FoldedLinens",
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
  const first = build({ linenSeed: 42 });
  const second = build({ linenSeed: 42 });
  const other = build({ linenSeed: 43 });
  assert.deepEqual(snapshot(first.models[0]), snapshot(first.models[1]));
  assert.deepEqual(snapshot(first.models[0]), snapshot(second.models[0]));
  assert.notDeepEqual(snapshot(first.models[0]), snapshot(other.models[0]));
  for (const result of [first, second, other]) { result.stack.destroy(); }
});

test("all authored bundle corners stay inside the supplied area", () => {
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
      for (const x of [-0.15, 0.15]) {
        for (const y of [0, 0.16]) {
          for (const z of [-0.11, 0.11]) {
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

test("empty, invalid and excessive areas do not allocate linen piles", () => {
  for (const width of [0, -1, NaN, Infinity, 100000]) {
    const { stack, models } = build({ width });
    assert.equal(models[0].children.length, 0);
    stack.destroy();
  }
});

test("default area keeps one authored bundle and larger areas add supported courses", () => {
  for (const dimensions of [{
    width: 0.3,
    depth: 0.22,
    height: 0.16,
    count: 1,
  },
  {
    width: 0.7,
    depth: 0.5,
    height: 0.48,
    count: 12,
  }]) {
    const { stack, models } = build(dimensions);
    assert.equal(models[0].children.length, dimensions.count);
    for (const bundle of models[0].children) {
      const [layer, row, column] = bundle.name.split(" ")[2].split("-").map(Number);
      if (!layer) { continue; }
      const below = models[0].findByName(`Linen bundle ${layer - 1}-${row}-${column}`);
      const position = bundle.getLocalPosition();
      assert.equal(position.x, below.getLocalPosition().x);
      assert.equal(position.z, below.getLocalPosition().z);
      assert.ok(Math.abs(position.y - below.getLocalPosition().y - below.getLocalScale().y * 0.16) < 1e-6);
    }
    stack.destroy();
  }
});
