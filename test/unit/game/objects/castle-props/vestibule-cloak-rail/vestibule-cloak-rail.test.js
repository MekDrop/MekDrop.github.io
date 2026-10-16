import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import * as pc from "playcanvas";

const sourceUrl = new URL("../../../../../../src/game/objects/castle-props/vestibule-cloak-rail/VestibuleCloakRail.js", import.meta.url);
const source = (await readFile(sourceUrl, "utf8"))
  .replace(/import modelUrl from [^;]+;/, 'const modelUrl = "cloak-rail.glb";')
  .replace('"../../shared/AbstractCastleProp.js"', JSON.stringify(new URL("../../shared/AbstractCastleProp.js", sourceUrl).href))
  .replace('"../../../generator/map/GenerationRandom.js"', JSON.stringify(new URL("../../../generator/map/GenerationRandom.js", sourceUrl).href));
const { VestibuleCloakRail } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

it("varies occupied hooks, garment count and separate colors while remaining stable on reload", () => {
  const profiles = new Set(), counts = new Set(), colors = new Set();
  for (let index = 0; index < 40; index++) {
    const seed = `arrival-rail-${index}`;
    const variation = VestibuleCloakRail.variation(seed);
    assert.deepEqual(VestibuleCloakRail.variation(seed), variation);
    assert.equal(new Set(variation.map(item => item.hookX)).size, variation.length);
    if (variation.length === 2) { assert.ok(Math.abs(variation[0].hookX - variation[1].hookX) >= 0.66); assert.notDeepEqual(variation[0].color, variation[1].color); }
    profiles.add(JSON.stringify(variation));
    counts.add(variation.length);
    for (const item of variation) { colors.add(JSON.stringify(item.color)); }
  }
  assert.deepEqual([...counts].sort(), [1, 2]);
  assert.ok(profiles.size > 20);
  assert.equal(colors.size, 6);
});

it("moves matching render and collision garments and clones cloth materials without tinting wood", () => {
  const graphs = [];
  const shared = new pc.StandardMaterial();
  class Entity extends pc.Entity {
    /**
     * @param {string} type
     * @param {Record<string, string|number>} data
     */
    addComponent(type, data) {}
  }
  const options = {
    pc: {
      ...pc,
      Entity,
    },
    definition: {
      id: "arrival-rail-6",
      position: {
        x: 0,
        y: 1.28,
        z: 0,
      },
    },
    modelLibrary: {
      instantiate: () => {
        const root = new pc.Entity("rail model");
        for (const name of ["Rail wood and pegs", "Cloak A", "Cloak B"]) {
          const node = new pc.Entity(name);
          node.testMesh = { material: shared };
          node.findComponents = () => [{ meshInstances: [node.testMesh] }];
          root.addChild(node);
        }
        graphs.push(root);

        return root;
      },
    },
  };
  const rail = new VestibuleCloakRail(options);
  for (const name of ["Cloak A", "Cloak B"]) {
    const render = graphs[0].findByName(name), collision = graphs[1].findByName(name);
    assert.equal(Boolean(render), Boolean(collision));
    if (!render) { continue; }
    assert.deepEqual(render.getLocalPosition(), collision.getLocalPosition());
    assert.notEqual(render.testMesh.material, shared);
    assert.equal(render.testMesh.material.diffuseTint, true);
  }
  assert.equal(graphs[0].findByName("Rail wood and pegs").testMesh.material, shared);
  assert.deepEqual([shared.diffuse.r, shared.diffuse.g, shared.diffuse.b], [1, 1, 1]);
  rail.destroy();
});
