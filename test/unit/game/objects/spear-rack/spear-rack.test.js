import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const { SpearRack } = await import("../../../../../src/game/objects/spear-rack/SpearRack.js");
hooks.deregister();
const app = {
  _entityIndex: {},
  systems: { list: [] },
};

function build(overrides = {}) {
  const models = [];
  const rack = new SpearRack({
    pc,
    modelLibrary: {
      instantiate() {
        const model = new pc.Entity("model", app);
        for (const name of ["Rack rail", "Rack base", "Rack upright", "Rack foot", "Rack crossbeam", "Rack brace", "Rack guide", "Rack socket", "Rack spear"]) { model.addChild(new pc.Entity(name, app)); }
        models.push(model);

        return model;
      },
    },
    definition: {
      id: "rack",
      object: "SpearRack",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      ...overrides,
    },
  });

  return {
    rack,
    models,
  };
}
function snapshot(model) {
  return model.children.map(section => Array.from(section.getLocalTransform().data));
}

test("one frame supports all three rows without per-row feet", () => {
  const { rack, models } = build({
    length: 1.6,
    width: 0.75,
  });
  const parts = models[0].children;
  const count = prefix => parts.filter(part => part.name.startsWith(prefix)).length;
  assert.equal(count("Rack upright "), 4);
  assert.equal(count("Rack foot "), 4);
  assert.equal(count("Rack crossbeam "), 4);
  assert.equal(count("Rack end brace "), 2);
  assert.equal(count("Rack guide rail "), 3);
  assert.equal(count("Rack row base "), 3);
  assert.equal(count("Rack spear "), 24);
  assert.equal(count("Rack socket "), 24);
  const posts = parts.filter(part => part.name.startsWith("Rack upright "));
  assert.equal(new Set(posts.map(post => post.getLocalPosition().x)).size, 2);
  assert.equal(new Set(posts.map(post => post.getLocalPosition().z)).size, 2);
  rack.destroy();
});

test("seed reproduces render, collision and reload, varying only spear heights", () => {
  const dimensions = {
    length: 1.6,
    width: 0.75,
    height: 1.4,
  };
  const first = build({
    ...dimensions,
    spearSeed: 42,
  });
  const second = build({
    ...dimensions,
    spearSeed: 42,
  });
  const other = build({
    ...dimensions,
    spearSeed: 43,
  });
  assert.deepEqual(snapshot(first.models[0]), snapshot(first.models[1]));
  assert.deepEqual(snapshot(first.models[0]), snapshot(second.models[0]));
  assert.notDeepEqual(snapshot(first.models[0]), snapshot(other.models[0]));
  const frame = model => snapshot({ children: model.children.filter(part => !part.name.startsWith("Rack spear ")) });
  assert.deepEqual(frame(first.models[0]), frame(other.models[0]));
  for (const result of [first, second, other]) { result.rack.destroy(); }
});

test("more length adds spears along continuous guide rails", () => {
  const short = build({
    length: 0.5,
    width: 0.25,
  });
  const long = build({
    length: 1.6,
    width: 0.25,
  });
  const spears = model => model.children.filter(part => part.name.startsWith("Rack spear "));
  assert.ok(spears(long.models[0]).length > spears(short.models[0]).length);
  assert.equal(new Set(spears(long.models[0]).map(part => part.getLocalPosition().z)).size, 1);
  assert.equal(long.models[0].children.filter(part => part.name.startsWith("Rack guide rail ")).length, 1);
  short.rack.destroy(); long.rack.destroy();
});

test("width adds rows only when they fit while retaining shared corner supports", () => {
  for (const [width, rows] of [[0.25, 1], [0.49, 1], [0.5, 2], [0.75, 3]]) {
    const { rack, models } = build({
      length: 1.6,
      width,
    });
    assert.equal(models[0].children.filter(part => part.name.startsWith("Rack guide rail ")).length, rows);
    assert.equal(models[0].children.filter(part => part.name.startsWith("Rack foot ")).length, 4);
    rack.destroy();
  }
});

const buffer = readFileSync(new URL("../../../../../src/game/models/spear-rack/spear-rack.glb", import.meta.url));
const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
const assetBounds = new Map(gltf.nodes.map(node => {
  assert.equal(node.matrix, undefined);
  assert.equal(node.rotation, undefined);
  assert.equal(node.translation, undefined);
  const accessors = gltf.meshes[node.mesh].primitives.map(primitive => gltf.accessors[primitive.attributes.POSITION]);

  return [node.name, {
    min: [0, 1, 2].map(axis => Math.min(...accessors.map(accessor => accessor.min[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...accessors.map(accessor => accessor.max[axis]))),
  }];
}));
function sourceName(name) {
  if (name.startsWith("Rack guide rail")) { return "Rack rail"; }
  if (name.startsWith("Rack end crossbeam")) { return "Rack crossbeam"; }
  if (name.startsWith("Rack end brace")) { return "Rack brace"; }
  if (/^Rack (row|perimeter) base/.test(name)) { return "Rack base"; }
  return name.split(" ").slice(0, 2).join(" ");
}

test("actual exported part bounds fit the requested area, including braces", () => {
  for (const dimensions of [{
    length: 1.6,
    width: 0.75,
    height: 1.2,
  },
  {
    length: 0.5,
    width: 0.25,
    height: 1.2,
  },
  {
    length: 0.04,
    width: 0.03,
    height: 0.02,
  },
  {
    length: 3.8,
    width: 0.5,
    height: 1.7,
  }]) {
    const { rack, models } = build(dimensions);
    for (const part of models[0].children) {
      const bounds = assetBounds.get(sourceName(part.name));
      assert.ok(bounds, part.name);
      for (const x of [bounds.min[0], bounds.max[0]]) {
        for (const y of [bounds.min[1], bounds.max[1]]) {
          for (const z of [bounds.min[2], bounds.max[2]]) {
            const point = part.getLocalTransform().transformPoint(new pc.Vec3(x, y, z));
            assert.ok(Math.abs(point.x) <= dimensions.length / 2 + 1e-5, `${part.name} x=${point.x}`);
            assert.ok(Math.abs(point.z) <= dimensions.width / 2 + 1e-5, `${part.name} z=${point.z}`);
            assert.ok(point.y >= -1e-5 && point.y <= dimensions.height + 1e-5, `${part.name} y=${point.y}`);
          }
        }
      }
    }
    rack.destroy();
  }
});

test("invalid and excessive dimensions allocate no parts", () => {
  for (const dimension of ["length", "width", "height"]) {
    for (const value of [0, -1, NaN, Infinity]) {
      const { rack, models } = build({ [dimension]: value });
      assert.equal(models[0].children.length, 0);
      rack.destroy();
    }
  }
  const { rack, models } = build({ length: 10000 });
  assert.equal(models[0].children.length, 0);
  rack.destroy();
});
