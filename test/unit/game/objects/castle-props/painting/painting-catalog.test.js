import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { PaintingCatalog } from "../../../../../../src/game/objects/castle-props/painting/PaintingCatalog.js";

test("twenty distinct subjects have editable models and matching exports", () => {
  assert.equal(PaintingCatalog.subjects.length, 20);
  assert.equal(new Set(PaintingCatalog.subjects).size, 20);
  for (const subject of PaintingCatalog.subjects) {
    for (const extension of ["blend", "glb"]) {
      const url = new URL(`../../../../../../src/game/models/castle/props/${subject}-painting.${extension}`, import.meta.url);
      assert.ok(existsSync(url), `${subject}.${extension}`);
      if (extension === "glb") {
        const bytes = readFileSync(url);
        const length = bytes.readUInt32LE(12);
        const gltf = JSON.parse(bytes.subarray(20, 20 + length).toString());
        assert.ok(gltf.meshes.length > 0, subject);
      }
    }
  }
});

test("placement seeds cover each content pool reproducibly", () => {
  for (const [context, subjects] of [["vestibule", PaintingCatalog.arrivalSubjects],
    ["royal-bedroom", PaintingCatalog.bedroomSubjects]]) {
    const selected = new Set();
    for (let seed = 0; seed < 500; seed++) {
      const subject = PaintingCatalog.select(context, `${seed}:room:0:4:2`);
      assert.ok(subjects.includes(subject));
      assert.equal(PaintingCatalog.select(context, `${seed}:room:0:4:2`), subject);
      selected.add(subject);
    }
    assert.equal(selected.size, subjects.length);
  }
});
