import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import * as pc from "playcanvas";
import { AbstractCastleProp } from "../../../../../src/game/objects/castle-props/AbstractCastleProp.js";

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
