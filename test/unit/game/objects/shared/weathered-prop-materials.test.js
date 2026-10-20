import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as playCanvas from "playcanvas";

const hooks = registerHooks({
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

class DecorativeProp extends AbstractCastleProp {
  static get hasAuthoredCollision() {
    return false;
  }
}

/**
 * @param {playCanvas.StandardMaterial} source
 * @param {number} weathering
 * @param {playCanvas.StandardMaterial} secondSource
 */
function fixture(source, weathering, secondSource = source) {
  const app = {
    _entityIndex: {},
    systems: { list: [] },
  };
  const pc = {
    ...playCanvas,
    Entity: class extends playCanvas.Entity {
      /**
       * @param {string} name
       */
      constructor(name) {
        super(name, app);
      }
    },
  };
  const meshes = [{ material: source }, { material: secondSource }, { material: source }];
  const model = new pc.Entity("planks and nails");
  model.findComponents = () => meshes.map((mesh) => ({ meshInstances: [mesh] }));
  const prop = new DecorativeProp({
    pc,
    modelLibrary: { instantiate: () => model },
    definition: {
      id: "weathered-prop",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      weathering,
    },
  });

  return {
    prop,
    meshes,
  };
}

function material() {
  const source = new playCanvas.StandardMaterial();
  source.diffuse.set(0.8, 0.6, 0.4);
  source.gloss = 0.4;

  return source;
}

test("weathered parts share one instance material while other props and the asset remain independent", () => {
  const source = material();
  const first = fixture(source, 0.6);
  const second = fixture(source, 0.2);
  const worn = first.meshes[0].material;
  assert.ok(first.meshes.every((mesh) => mesh.material === worn));
  assert.notEqual(worn, source);
  assert.notEqual(worn, second.meshes[0].material);
  assert.deepEqual(worn.diffuse, new playCanvas.Color(0.8 * (1 - 0.6 * 0.48), 0.6 * (1 - 0.6 * 0.34), 0.4 * (1 - 0.6 * 0.18)));
  assert.equal(worn.gloss, 0.2 - 0.6 * 0.15);
  assert.deepEqual(source.diffuse, new playCanvas.Color(0.8, 0.6, 0.4));
  assert.equal(source.gloss, 0.4);
  let destroyed = 0;
  worn.destroy = () => destroyed++;
  first.prop.destroy();
  assert.equal(destroyed, 1);
  assert.equal(second.meshes[0].material.gloss, 0.2 - 0.2 * 0.15);
  second.prop.destroy();
  source.destroy();
});

test("textured roughness materials retain their tint, maps and inverted gloss convention", () => {
  const source = material();
  const texture = {};
  source.diffuseMap = texture;
  source.glossInvert = true;
  const { prop, meshes } = fixture(source, 0.6);
  assert.deepEqual(meshes[0].material.diffuse, source.diffuse);
  assert.equal(meshes[0].material.diffuseMap, texture);
  assert.equal(meshes[0].material.gloss, 0.8 + 0.6 * 0.15);
  prop.destroy();
  source.destroy();
});

test("distinct source materials stay separate even when they have the same name", () => {
  const first = material();
  const second = material();
  second.diffuse.set(0.1, 0.2, 0.3);
  const { prop, meshes } = fixture(first, 0.6, second);
  assert.equal(meshes[0].material, meshes[2].material);
  assert.notEqual(meshes[0].material, meshes[1].material);
  assert.notDeepEqual(meshes[0].material.diffuse, meshes[1].material.diffuse);
  prop.destroy();
  first.destroy();
  second.destroy();
});

test("identical finishes survive until their last owner is destroyed", () => {
  const source = material();
  const first = fixture(source, 0.6);
  const second = fixture(source, 0.6);
  const shared = first.meshes[0].material;
  assert.equal(second.meshes[0].material, shared);
  let destroyed = 0;
  shared.destroy = () => destroyed++;
  first.prop.destroy();
  assert.equal(destroyed, 0);
  assert.equal(second.meshes[0].material.gloss, 0.2 - 0.6 * 0.15);
  second.prop.destroy();
  assert.equal(destroyed, 1);
  const next = fixture(source, 0.6);
  assert.notEqual(next.meshes[0].material, shared);
  next.prop.destroy();
  source.destroy();
});
