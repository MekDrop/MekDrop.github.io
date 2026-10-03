import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

class FakeMesh {
  clear() {}
  setPositions(value) { this.positions = value; }
  setNormals() {}
  setUvs(channel, value) { this.uvs = value; }
  setIndices(value) { this.indices = value; }
  update() {}
  incRefCount() {}
}

for (const name of ["CastleBanner", "Flag"]) {
  it(`${name} clones authored topology and selects pins independent of vertex ordering`, () => {
    const source = readFileSync(new URL(`../../../../../src/game/objects/${name === "Flag" ? "flag" : "castle"}/${name}.js`, import.meta.url), "utf8");
    const start = source.indexOf("  #createMesh(");
    const end = source.indexOf("\n  /**", start);
    const method = source.slice(start, end).replace("#createMesh", "createMesh");
    const banner = name === "CastleBanner";
    const positions = banner ? [0, -1, 0, -0.5, 0, 0, 0.5, 0, 0] : [1, 0.1, 0, 0, -0.5, 0, 0, 0.5, 0];
    const indices = [2, 0, 1];
    let destroyed = false;
    const mesh = {
      getPositions: (output) => output.push(...positions),
      getUvs: (channel, output) => output.push(0.5, 0, 0, 1, 1, 1),
      getIndices: (output) => output.push(...indices),
    };
    const modelLibrary = { instantiate: () => ({ findComponents: () => [{ meshInstances: [{ mesh }] }], destroy: () => { destroyed = true; } }) };
    const Factory = new Function("library", "FakeMesh", `const clothModelUrl = "cloth"; const FLAG_TRAILING_EDGE_HEIGHT_RATIO = 0.2;
      return new class { #modelLibrary = library; #pc = { Mesh: FakeMesh, calculateNormals: () => [] }; #app = { graphicsDevice: null }; ${method} };`);
    const instance = Factory(modelLibrary, FakeMesh);
    const geometry = instance.createMesh(2, 3, 4);
    assert.deepEqual([...geometry.indices], indices);
    assert.deepEqual(geometry.pinnedIndices, [1, 2]);
    assert.equal(geometry.positions[0], banner ? 0 : 2);
    assert.ok(Math.abs(geometry.positions[4] - (banner ? 0 : 4 - 3 - 0.12)) < 1e-6);
    assert.equal(destroyed, true);
  });
}

