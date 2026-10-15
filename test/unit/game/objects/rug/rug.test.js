import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import * as pc from "playcanvas";
import { AbstractCastleProp } from "../../../../../src/game/objects/castle-props/AbstractCastleProp.js";

it("keeps the runner visible without a door-blocking body while solid props retain collision", async () => {
  const sourceUrl = new URL("../../../../../src/game/objects/rug/Rug.js", import.meta.url);
  const source = (await readFile(sourceUrl, "utf8"))
    .replace('import { rugModels } from "./RugModels.js";', 'const rugModels = { "../../models/rug/woven-rug.glb": "woven.glb", "../../models/rug/vestibule-runner.glb": "runner.glb", "../../models/rug/custom.glb": "custom.glb" };')
    .replace('"../castle-props/AbstractCastleProp.js"', JSON.stringify(new URL("../castle-props/AbstractCastleProp.js", sourceUrl).href));
  const { Rug } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const components = [];
  class Entity extends pc.Entity {
    /**
     * @param {string} type
     * @param {Record<string, string|number>} data
     */
    addComponent(type, data) { components.push({
      type,
      data,
    }); }
  }
  class SolidProp extends AbstractCastleProp {
    /**
     * @returns {string}
     */
    static get modelUrl() { return "solid.glb"; }
  }
  const options = {
    pc: {
      ...pc,
      Entity,
    },
    definition: {
      id: "arrival-rug",
      position: {
        x: 0,
        y: 2.002,
        z: 0,
      },
      scale: 1,
      stretch: {
        x: 1,
        y: 1,
        z: 2,
      },
    },
    modelLibrary: { instantiate: () => new pc.Entity("imported model") },
  };
  const rug = new Rug(options);
  assert.equal(rug.modelUrl, "woven.glb", "omitting texture keeps the default woven model");
  for (const model of ["vestibule-runner.glb", "custom.glb"]) {
    const authored = new Rug({
      ...options,
      definition: {
        ...options.definition,
        model,
        width: 50,
        depth: 50,
      },
    });
    assert.equal(authored.modelUrl, model === "custom.glb" ? "custom.glb" : "runner.glb");
    assert.equal(authored.visualRoots[0].children[0].getLocalScale().z, 2,
      "authored model stretch is preserved instead of reinterpreting its dimensions");
    authored.destroy();
  }
  assert.equal(rug.visualRoots[0].children.length, 1, "the visible runner remains attached");
  assert.equal(rug.visualRoots[0].children[0].getLocalScale().z, 2);
  assert.deepEqual(components, [], "no collision surface enters door contact queries");
  rug.setIslandOffsets(0, 0);
  rug.destroy();
  const solid = new SolidProp(options);
  assert.deepEqual(components.map(component => component.type), ["collision", "rigidbody"]);
  solid.destroy();
});


it("loads an arbitrary fabric URL on owned materials and releases the asset", async () => {
  const sourceUrl = new URL("../../../../../src/game/objects/rug/Rug.js", import.meta.url);
  const source = (await readFile(sourceUrl, "utf8"))
    .replace('import { rugModels } from "./RugModels.js";', 'const rugModels = { "../../models/rug/woven-rug.glb": "woven.glb", "../../models/rug/vestibule-runner.glb": "runner.glb", "../../models/rug/custom.glb": "custom.glb" };')
    .replace('"../castle-props/AbstractCastleProp.js"', JSON.stringify(new URL("../castle-props/AbstractCastleProp.js", sourceUrl).href));
  const { Rug } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const added = [], loaded = [], removed = [];
  const app = {
    assets: {
      add: asset => added.push(asset),
      load: asset => loaded.push(asset),
      remove: asset => removed.push(asset),
    },
  };
  const shared = new pc.StandardMaterial();
  const mesh = {
    device: {},
    aabb: new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(0.6, 0.025, 0.375)),
    getPositions: values => values.push(-0.6, 0, -0.375, 0.6, 0, 0.375),
    getNormals: values => values.push(0, 1, 0, 0, 1, 0),
    getVertexStream: () => 0,
    getUvs: (channel, values) => values.push(0, 0, 1, 1),
    getIndices: values => values.push(0, 1),
  };
  const render = {
    meshInstances: [{
      mesh,
      material: shared,
      node: null,
    }],
  };
  class RugEntity extends pc.Entity {
    findComponents() { return [render]; }
  }
  const geometry = [];
  class MeshInstance {
    /**
     * @param {Record<string, number[]>} mesh
     * @param {import("playcanvas").StandardMaterial} material
     */
    constructor(mesh, material) { this.mesh = mesh; this.material = material; }
  }
  const model = new pc.Entity("rug model");
  model.findComponents = () => [render];
  const options = {
    pc: {
      ...pc,
      Entity: RugEntity,
      Mesh: { fromGeometry: (device, data) => { geometry.push(data); return data; } },
      MeshInstance,
    },
    app,
    modelLibrary: { instantiate: () => model },
    definition: {
      id: "custom-rug",
      object: "Rug",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      texture: "/user/fabric-any-name.png",
      width: 2.4,
      depth: 3,
    },
  };
  const rug = new Rug(options);
  assert.equal(added[0].file.url, options.definition.texture);
  assert.deepEqual(loaded, added);
  assert.notEqual(render.meshInstances[0].material, shared);
  assert.equal(render.meshInstances[0].material.diffuseMapUv, 1);
  assert.deepEqual(geometry[0].uvs1, [0, 0, 1, 1]);
  assert.equal(model.getLocalScale().x, 2);
  assert.equal(model.getLocalScale().z, 4);
  const fabric = { name: "arbitrary fabric" };
  added[0].resource = fabric;
  added[0].fire("load", added[0]);
  assert.equal(render.meshInstances[0].material.diffuseMap, fabric);
  assert.equal(shared.diffuseMap, null, "shared/default fabric stays untouched");
  // Avoid asking a synthetic resource to free a real GPU texture.
  added[0].resources = [];
  rug.destroy();
  assert.deepEqual(removed, added);
  assert.equal(added[0].hasEvent("load"), false);
  shared.destroy();
});
