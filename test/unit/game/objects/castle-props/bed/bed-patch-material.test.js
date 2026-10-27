import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as pc from "playcanvas";

const sourceUrl = new URL("../../../../../../src/game/objects/castle-props/bed/BedPatchMaterial.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace('"playcanvas"', JSON.stringify(import.meta.resolve("playcanvas")))
  .replace('"../../../generator/map/GenerationRandom.js"', JSON.stringify(new URL("../../../generator/map/GenerationRandom.js", sourceUrl).href))
  .replace(/import diffuseShader from [^;]+;/, `const diffuseShader = ${JSON.stringify(readFileSync(new URL("BedPatches.frag", sourceUrl), "utf8"))};`)
  .replace(/import diffuseWgslShader from [^;]+;/, `const diffuseWgslShader = ${JSON.stringify(readFileSync(new URL("BedPatches.wgsl", sourceUrl), "utf8"))};`);
const { BedPatchMaterial } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const bedSource = readFileSync(new URL("Bed.js", sourceUrl), "utf8").replace(/^import .*;\r?\n/gm, "");
const Bed = new Function("AbstractCastleProp", "BedPatchMaterial",
  `${bedSource.replace("export class", "class")}\nreturn Bed;`)(class {}, BedPatchMaterial);

test("blanket repairs choose independently seeded cloth palettes", () => {
  const profiles = new Set();
  for (let seed = 0; seed < 30; seed++) {
    const colors = BedPatchMaterial.variation(seed);
    assert.equal(colors.length, 4);
    assert.deepEqual(BedPatchMaterial.variation(seed), colors);
    profiles.add(JSON.stringify(colors));
  }
  assert.ok(profiles.size > 20);
});

test("servant finishes own their materials, retain authored textures and support both shader languages", () => {
  const shared = new pc.StandardMaterial();
  const clones = [];
  const finish = seed => {
    const mesh = { material: shared };
    Bed.prototype.prepareModel.call({
      definition: {
        variant: "servant",
        seed,
      },
      cloneMaterial: material => {
        const clone = material.clone();
        clones.push(clone);

        return clone;
      },
    }, { findComponents: () => [{ meshInstances: [mesh] }] }, false);

    return mesh.material;
  };
  const first = finish(0), repeat = finish(0), other = finish(4);
  assert.notEqual(first, shared);
  for (const language of [pc.SHADERLANGUAGE_GLSL, pc.SHADERLANGUAGE_WGSL]) {
    assert.match(first.getShaderChunks(language).get("diffusePS"), /bedRepairColor/);
  }
  const parameters = material => Array.from({ length: 4 }, (_, index) => [...material.getParameter(`uBedRepair${index}`).data]);
  assert.deepEqual(parameters(first), parameters(repeat));
  assert.notDeepEqual(parameters(first), parameters(other));
  assert.ok(parameters(first).every(color => color.length === 3));
  assert.equal(shared.getShaderChunks(pc.SHADERLANGUAGE_GLSL).size, 0);
  assert.deepEqual(shared.diffuse.toArray(), [1, 1, 1, 1]);
  for (const material of clones) {
    material.destroy();
  }
  shared.destroy();
});

test("royal beds and collision-only preparation retain their original materials", () => {
  for (const [variant, collision] of [["royal", false], ["servant", true]]) {
    let touched = false;
    Bed.prototype.prepareModel.call({ definition: { variant } }, {
      findComponents: () => {
        touched = true;

        return [];
      },
    }, collision);
    assert.equal(touched, false);
  }
});
