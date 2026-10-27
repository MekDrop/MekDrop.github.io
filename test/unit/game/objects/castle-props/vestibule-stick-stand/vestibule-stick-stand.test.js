import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as pc from "playcanvas";

const sourceUrl = new URL("../../../../../../src/game/objects/castle-props/vestibule-stick-stand/VestibuleStickStand.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace(/import modelUrl from [^;]+;/, 'const modelUrl = "stand.glb";')
  .replace('"../../shared/AbstractCastleProp.js"', JSON.stringify(new URL("../../shared/AbstractCastleProp.js", sourceUrl).href))
  .replace('"../../../generator/map/GenerationRandom.js"', JSON.stringify(new URL("../../../generator/map/GenerationRandom.js", sourceUrl).href));
const { VestibuleStickStand } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const names = ["Open oak umbrella holder", "Tripo folded umbrella", "Tripo oak walking stick", "Tripo short walking stick"];

test("holder seeds vary umbrella presence, walking-stick combinations, facing and fabric", () => {
  const sets = new Set(), rotations = new Set(), colors = new Set();
  for (let seed = 0; seed < 80; seed++) {
    const profile = VestibuleStickStand.variation(seed);
    assert.deepEqual(VestibuleStickStand.variation(seed), profile);
    assert.ok(profile.names.length >= 2);
    sets.add(profile.names.join(","));
    rotations.add(profile.rotation);
    colors.add(JSON.stringify(profile.color));
  }
  assert.equal(sets.size, 4);
  assert.equal(rotations.size, 4);
  assert.equal(colors.size, 4);
});

test("the same authored contents rotate inside the holder in visual and collision graphs", () => {
  const shared = new pc.StandardMaterial();
  const clones = [];
  const owner = {
    definition: {
      id: "holder",
      seed: 4,
    },
    cloneMaterial: material => {
      const clone = material.clone();
      clones.push(clone);

      return clone;
    },
  };
  const graphs = [];
  for (const collision of [false, true]) {
    const model = new pc.Entity("model");
    for (const name of names) {
      const node = new pc.Entity(name);
      node.mesh = { material: shared };
      node.findComponents = () => [{ meshInstances: [node.mesh] }];
      model.addChild(node);
    }
    VestibuleStickStand.prototype.prepareModel.call(owner, model, collision);
    graphs.push(model);
  }
  const variation = VestibuleStickStand.variation(owner.definition.seed);
  for (const name of names) {
    const visual = graphs[0].findByName(name), collision = graphs[1].findByName(name);
    assert.equal(Boolean(visual), Boolean(collision));
    if (!visual) {
      continue;
    }
    assert.deepEqual(Array.from(visual.getLocalTransform().data), Array.from(collision.getLocalTransform().data));
    if (name === "Tripo folded umbrella") {
      assert.notEqual(visual.mesh.material, shared);
      assert.equal(collision.mesh.material, shared);
    } else {
      assert.equal(visual.mesh.material, shared);
    }
  }
  assert.equal(graphs[0].children.length, variation.names.length + 1);
  assert.deepEqual(shared.diffuse.toArray(), [1, 1, 1, 1]);
  for (const graph of graphs) {
    graph.destroy();
  }
  for (const material of clones) {
    material.destroy();
  }
  shared.destroy();
});
