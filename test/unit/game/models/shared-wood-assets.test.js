import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { externalizeSharedWood } = require("../../../../scripts/shared-wood-texture.cjs");

test("shared timber exports reference the canonical file without embedded copies", () => {
  const texturePath = path.resolve("src/game/textures/wood/timber-grain.png");
  const texture = fs.readFileSync(texturePath);
  let count = 0;
  for (const filename of fs.globSync("src/game/models/**/*.glb")) {
    const data = fs.readFileSync(filename);
    const gltf = JSON.parse(data.toString("utf8", 20, 20 + data.readUInt32LE(12)));
    for (const image of gltf.images ?? []) {
      assert.notEqual(image.name, "Dry timber grain", filename);
      if (image.name !== "timber-grain") {
        continue;
      }
      count++;
      assert.equal(image.bufferView, undefined, filename);
      assert.equal(path.resolve(path.dirname(filename), image.uri), texturePath);
      assert.equal(data.includes(texture), false, filename);
      assert.equal(data.readUInt32LE(8), data.length, filename);
      const imageIndex = gltf.images.indexOf(image);
      assert.equal(gltf.textures.filter((texture) => texture.source === imageIndex).length, 1, filename);
    }
  }
  assert.ok(count >= 47, `Expected shared timber in at least 47 models, got ${count}`);
});

test("shelters and animated doors use the common grain with authored timber UVs", () => {
  for (const name of ["garden/pergola", "garden/striped-canopy", "doors/castle-doors", "doors/interior-doors", "doors/entrance-pointed", "doors/entrance-rounded"]) {
    const data = fs.readFileSync(`src/game/models/castle/${name}.glb`);
    const gltf = JSON.parse(data.toString("utf8", 20, 20 + data.readUInt32LE(12)));
    assert.equal(gltf.images.length, 1, name);
    assert.equal(gltf.images[0].name, "timber-grain", name);
    const textured = new Map();
    for (const [index, material] of gltf.materials.entries()) {
      if (material.pbrMetallicRoughness?.baseColorTexture) {
        textured.set(index, material.pbrMetallicRoughness.baseColorTexture.texCoord ?? 0);
      }
    }
    assert.ok(textured.size, name);
    for (const mesh of gltf.meshes) {
      for (const primitive of mesh.primitives) {
        if (textured.has(primitive.material)) {
          assert.ok(Number.isInteger(primitive.attributes[`TEXCOORD_${textured.get(primitive.material)}`]), name);
        }
      }
    }
    if (name.startsWith("doors/")) {
      assert.ok(gltf.animations.some(animation => animation.name === "OpenWide"), name);
    }
  }
});

test("externalizing timber preserves geometry, remaining images, and shared buffer views", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shared-wood-"));
  try {
    const filename = path.join(directory, "model.glb");
    const gltf = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: 16 }],
      bufferViews: [0, 4, 8, 12].map((offset) => ({
        buffer: 0,
        byteOffset: offset,
        byteLength: 4,
      })),
      images: [
        {
          name: "timber-grain",
          bufferView: 0,
          mimeType: "image/png",
        },
        {
          name: "other",
          bufferView: 2,
          mimeType: "image/png",
        },
        {
          name: "timber-grain",
          bufferView: 3,
          mimeType: "image/png",
        },
      ],
      accessors: [{ bufferView: 1 }, { bufferView: 3 }],
      textures: [{ source: 0 }, { source: 1 }, { source: 0 }],
      materials: [{
        pbrMetallicRoughness: { baseColorTexture: { index: 2 } },
        normalTexture: { index: 1 },
      }],
    };
    const json = Buffer.from(JSON.stringify(gltf));
    const padding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
    const header = Buffer.alloc(20);
    header.write("glTF");
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + json.length + padding.length + 16, 8);
    header.writeUInt32LE(json.length + padding.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const binaryHeader = Buffer.alloc(8);
    binaryHeader.writeUInt32LE(16);
    binaryHeader.writeUInt32LE(0x004e4942, 4);
    fs.writeFileSync(filename, Buffer.concat([header, json, padding, binaryHeader, Buffer.from("WOODMESHTEX2KEEP")]));
    externalizeSharedWood(filename, path.join(directory, "timber-grain.png"));
    const result = fs.readFileSync(filename);
    const jsonLength = result.readUInt32LE(12);
    const output = JSON.parse(result.toString("utf8", 20, 20 + jsonLength));
    assert.equal(result.subarray(28 + jsonLength).toString(), "MESHTEX2KEEP");
    assert.deepEqual(output.accessors, [{ bufferView: 0 }, { bufferView: 2 }]);
    assert.equal(output.images[1].bufferView, 1);
    assert.equal(output.buffers[0].byteLength, 12);
    assert.equal(output.images[0].uri, "timber-grain.png");
    assert.equal(output.images[2].uri, "timber-grain.png");
    assert.equal(output.textures.length, 2);
    assert.equal(output.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
    assert.equal(output.materials[0].normalTexture.index, 1);
    assert.equal(externalizeSharedWood(filename, path.join(directory, "timber-grain.png")), false);
  } finally {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});
