import { readFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import { GlbParser } from "playcanvas/build/playcanvas/src/framework/parsers/glb-parser.js";
import { GlbContainerResource } from "playcanvas/build/playcanvas/src/framework/parsers/glb-container-resource.js";
import { Asset } from "playcanvas";
import { sources } from "./asset-hooks.mjs";

/**
 * Uses the real Engine importer and hierarchy with a null graphics device.
 */
export class OfflineModelLibrary {
  #app;
  #resources = new Map();

  /**
   * @param {import("playcanvas").Application} app
   */
  constructor(app) {
    this.#app = app;
  }

  /**
   * @param {string[]} paths
   */
  async load(paths) {
    for (const path of new Set(paths)) {
      if (this.#resources.has(path)) {
        continue;
      }
      const original = await readFile(path);
      sources.add(relative(process.cwd(), path).replaceAll("\\", "/"));
      const jsonLength = original.readUInt32LE(12);
      const gltf = JSON.parse(original.subarray(20, 20 + jsonLength));
      // Texture pixels do not affect packing/collision. Keep geometry and node
      // transforms intact, and avoid browser-only image decoding in the CLI.
      delete gltf.images;
      delete gltf.textures;
      delete gltf.samplers;
      gltf.materials = (gltf.materials ?? []).map((material) => ({ name: material.name }));
      let json = Buffer.from(JSON.stringify(gltf));
      json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
      const tail = original.subarray(20 + jsonLength);
      const header = Buffer.alloc(20);
      header.writeUInt32LE(0x46546c67, 0);
      header.writeUInt32LE(2, 4);
      header.writeUInt32LE(20 + json.length + tail.length, 8);
      header.writeUInt32LE(json.length, 12);
      header.writeUInt32LE(0x4e4f534a, 16);
      const bytes = Buffer.concat([header, json, tail]);
      const data = await new Promise((resolve, reject) => {
        GlbParser.parse(basename(path), "", new Uint8Array(bytes).buffer,
          this.#app.graphicsDevice, this.#app.assets, {}, (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
      });
      const resource = new GlbContainerResource(data, new Asset(basename(path), "container"),
        this.#app.assets, GlbParser.createDefaultMaterial());
      this.#resources.set(path, resource);
    }
  }

  /**
   * @param {string} path
   * @returns {import("playcanvas").Entity}
   */
  instantiate(path) {
    return this.#resources.get(path).instantiateRenderEntity();
  }

  destroy() {
    for (const resource of this.#resources.values()) {
      resource.destroy();
    }
    this.#resources.clear();
  }
}
