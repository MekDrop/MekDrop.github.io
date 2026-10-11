import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import * as pc from "playcanvas";
import { AbstractCastleProp } from "../../../../../src/game/objects/castle-props/AbstractCastleProp.js";

it("separates the runner inset from its backing to prevent depth fighting", async () => {
  const buffer = await readFile(new URL("../../../../../src/game/models/castle/props/vestibule-runner.glb", import.meta.url));
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
  const primitives = gltf.meshes.flatMap(mesh => mesh.primitives);
  const bounds = name => {
    const primitive = primitives.find(item => gltf.materials[item.material].name === name);
    return gltf.accessors[primitive.attributes.POSITION];
  };
  const backing = bounds("Crimson fabric");
  const inset = bounds("Dark crimson woven inset");
  const embroidery = bounds("Muted gold woven thread");
  assert.ok(inset.min[1] - backing.max[1] >= 0.002,
    "the inset needs millimetres of clearance, not a nearly coplanar surface");
  assert.ok(embroidery.min[1] > inset.max[1], "gold stitching remains above the inset");
});

it("keeps the runner visible without a door-blocking body while solid props retain collision", async () => {
  const sourceUrl = new URL("../../../../../src/game/objects/castle-props/VestibuleRug.js", import.meta.url);
  const source = (await readFile(sourceUrl, "utf8"))
    .replace(/import modelUrl from [^;]+;/, 'const modelUrl = "runner.glb";')
    .replace('"./AbstractCastleProp.js"', JSON.stringify(new URL("AbstractCastleProp.js", sourceUrl).href));
  const { VestibuleRug } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const components = [];
  class Entity extends pc.Entity {
    /**
     * @param {string} type
     * @param {Record<string, string|number>} data
     */
    addComponent(type, data) { components.push({ type, data }); }
  }
  class SolidProp extends AbstractCastleProp {
    /**
     * @returns {string}
     */
    static get modelUrl() { return "solid.glb"; }
  }
  const options = { pc: { ...pc, Entity }, definition: { id: "arrival-rug",
    position: { x: 0, y: 2.002, z: 0 }, scale: 1, stretch: { x: 1, y: 1, z: 2 } },
  modelLibrary: { instantiate: () => new pc.Entity("imported model") } };
  const rug = new VestibuleRug(options);
  assert.equal(rug.visualRoots[0].children.length, 1, "the visible runner remains attached");
  assert.equal(rug.visualRoots[0].children[0].getLocalScale().z, 2);
  assert.deepEqual(components, [], "no collision surface enters door contact queries");
  rug.setIslandOffsets(0, 0);
  rug.destroy();
  const solid = new SolidProp(options);
  assert.deepEqual(components.map(component => component.type), ["collision", "rigidbody"]);
  solid.destroy();
});
