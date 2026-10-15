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
    if (specifier.endsWith("/Fire.js")) {
      return {
        url: 'data:text/javascript,export class Fire { static attach(pc, model, position) { model.flame = position; } }',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/LanternGlass.js")) {
      return {
        url: 'data:text/javascript,export class LanternGlass { static add() {} }',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith("/CastleFire.js")) {
      return {
        url: 'data:text/javascript,export class CastleFire {}',
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
const { Lantern } = await import("../../../../../src/game/objects/lantern/Lantern.js");
hooks.deregister();

test("type selects the same asset for the visual and authored collision", () => {
  for (const type of ["entrance", "wall", "table"]) {
    const urls = [];
    const lantern = new Lantern({
      pc: {
        ...pc,
        Entity: LanternEntity,
      },
      modelLibrary: { instantiate: url => { urls.push(url);

 return new LanternEntity("model"); } },
      definition: {
        id: type,
        object: "Lantern",
        type,
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
    });
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.endsWith(`${type}-lantern.glb?url`)));
    assert.equal(Boolean(lantern.visualRoots[0].children[0].flame), type !== "wall");
    lantern.destroy();
  }
});

test("old map names migrate into one Lantern object with preserved lighting", () => {
  const map = { objects: ["EntranceLantern", "WallLantern", "TableLantern", "ServantBedsideLantern", "VestibuleLantern"].map(object => ({ object })) };
  Lantern.prepareMap(map);
  assert.ok(map.objects.every(item => item.object === "Lantern"));
  assert.deepEqual(map.objects.map(item => item.type), ["entrance", "wall", "table", "entrance", "entrance"]);
  assert.equal(map.objects[3].lighting.position.y, 0.29);
  assert.equal(map.objects[4].lighting.position.y, 0.23);
  const first = structuredClone(map);
  Lantern.prepareMap(map);
  assert.deepEqual(map, first);
});

class LanternEntity extends pc.Entity {
  addComponent(type, options) {
    this[type] = options;
    if (type === "rigidbody") { this.rigidbody.syncEntityToBody = () => {}; }
  }
}

test("scaled collision stays on the unscaled semantic root and follows island offsets", () => {
  const lantern = new Lantern({
    pc: {
      ...pc,
      Entity: LanternEntity,
    },
    modelLibrary: { instantiate: () => new LanternEntity("model") },
    definition: {
      id: "test",
      position: {
        x: 2,
        y: 3,
        z: 4,
      },
      scale: 1.6,
      stretch: {
        x: 0.8633,
        y: 1,
        z: 0.8633,
      },
      tile: {
        col: 0,
        row: 0,
      },
      collisionBox: {
        halfExtents: {
          x: 0.1,
          y: 0.2,
          z: 0.3,
        },
        offset: {
          x: 0,
          y: 0.2,
          z: 0,
        },
      },
      lighting: {
        position: {
          x: 0,
          y: 0.17,
          z: 0.1,
        },
        modelSpace: true,
        color: [1, 0.38, 0.06],
        intensity: 0.85,
        range: 2.2,
      },
    },
    runtime: {
      mapData: {
        islandConnectorData: {
          nearIsland: ["0,0"],
          farIsland: ["1,0"],
        },
      },
    },
  });
  const root = lantern.visualRoots[0];
  assert.equal(root.getLocalScale().x, 1);
  assert.equal(root.collision.halfExtents.x, 0.1 * 1.6 * 0.8633);
  assert.equal(root.collision.linearOffset.y, 0.2 * 1.6);
  const model = root.children[0];
  assert.equal(model.flame.y, 0.102);
  const light = model.children[0];
  lantern.setIslandOffsets(2, 7);
  assert.equal(root.getPosition().y, 5);
  lantern.setIslandOffsets(4, 9);
  assert.equal(root.getPosition().y, 7);
  lantern.destroy();
  assert.equal(light.parent, null);
});

test("asset variants retain their distinct model-space and root-space light offsets", () => {
  for (const [type, modelSpace, y] of [["table", true, 0.15], ["entrance", false, 0.23]]) {
    const lantern = new Lantern({
      pc: {
        ...pc,
        Entity: LanternEntity,
      },
      modelLibrary: { instantiate: () => new LanternEntity("model") },
      definition: {
        id: "variant",
        type,
        lighting: modelSpace ? undefined : {
          position: {
            x: 0,
            y,
            z: 0.17,
          },
          intensity: 0.65,
          range: 3,
        },
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        scale: 2,
      },
    });
    const root = lantern.visualRoots[0];
    const light = root.findByName("variant warm light");
    assert.equal(light.parent, modelSpace ? root.children[0] : root);
    assert.ok(Math.abs(light.getLocalPosition().y - y) < 1e-6);
    lantern.destroy();
  }
});
