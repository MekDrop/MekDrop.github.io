const fs = require("node:fs");
const path = require("node:path");

/**
 * Externalize the shared image and compact the remaining GLB buffer views.
 * Blender embeds images in GLB even when the .blend uses an external PNG.
 * @param {string} filename
 * @param {string} texturePath
 * @returns {boolean}
 */
function externalizeSharedWood(filename, texturePath) {
  const input = fs.readFileSync(filename);
  const jsonLength = input.readUInt32LE(12);
  const gltf = JSON.parse(input.toString("utf8", 20, 20 + jsonLength));
  const images = (gltf.images ?? []).filter((image) => image.name === "timber-grain");
  if (!images.length) {
    return false;
  }
  const candidates = new Set(images.map((image) => image.bufferView));
  const uri = path.relative(path.dirname(filename), texturePath).split(path.sep).join("/");
  for (const image of images) {
    delete image.bufferView;
    delete image.mimeType;
    image.uri = uri;
  }
  // Blender emits a texture entry per material even for the same image and
  // sampler. PlayCanvas clones those entries, so merge identical timber entries.
  const textureRemap = new Map();
  const sharedTextures = new Map();
  gltf.textures = (gltf.textures ?? []).filter((texture, index) => {
    const key = images.includes(gltf.images[texture.source]) ? JSON.stringify(texture) : null;
    if (key && sharedTextures.has(key)) {
      textureRemap.set(index, sharedTextures.get(key));
      return false;
    }
    const nextIndex = new Set(textureRemap.values()).size;
    textureRemap.set(index, nextIndex);
    if (key) {
      sharedTextures.set(key, nextIndex);
    }
    return true;
  });
  function remapMaterialTextures(value) {
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "index" && Number.isInteger(child)) {
        value.index = textureRemap.get(child);
      } else {
        remapMaterialTextures(child);
      }
    }
  }
  remapMaterialTextures(gltf.materials);
  // Keep a view if another accessor/image/extension references it too.
  function visit(value, callback) {
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "bufferView") {
        callback(value, child);
      } else {
        visit(child, callback);
      }
    }
  }
  visit(gltf, (_, index) => candidates.delete(index));
  const binaryStart = 28 + jsonLength;
  const chunks = [];
  const remap = new Map();
  let byteLength = 0;
  gltf.bufferViews = gltf.bufferViews.filter((view, index) => {
    if (candidates.has(index)) {
      return false;
    }
    const padding = (4 - byteLength % 4) % 4;
    chunks.push(Buffer.alloc(padding));
    byteLength += padding;
    const start = binaryStart + (view.byteOffset ?? 0);
    chunks.push(input.subarray(start, start + view.byteLength));
    view.byteOffset = byteLength;
    byteLength += view.byteLength;
    remap.set(index, remap.size);
    return true;
  });
  visit(gltf, (owner, index) => { owner.bufferView = remap.get(index); });
  gltf.buffers[0].byteLength = byteLength;
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
  const binaryPadding = Buffer.alloc((4 - byteLength % 4) % 4);
  const header = Buffer.alloc(20);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + jsonPadding.length + byteLength + binaryPadding.length, 8);
  header.writeUInt32LE(json.length + jsonPadding.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(byteLength + binaryPadding.length);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([header, json, jsonPadding, binaryHeader, ...chunks, binaryPadding]);
  if (output.equals(input)) {
    return false;
  }
  fs.writeFileSync(filename, output);
  return true;
}

module.exports = { externalizeSharedWood };
