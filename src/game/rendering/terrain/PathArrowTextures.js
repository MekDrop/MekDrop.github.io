import pathSurfaceShader from "./PathSurface.frag?raw";
import routeShader from "./PathArrowTextures.frag?raw";
import routeWgslShader from "./PathArrowTextures.wgsl?raw";
import { PathArrowTextureLayout } from "./PathArrowTextureLayout.js";

/**
 * Paints navigation into the existing path surfaces, without arrow geometry.
 */
export class PathArrowTextures {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("playcanvas").Texture[]}
   */
  #textures = [];
  /**
   * @type {Map<import("playcanvas").Material, import("playcanvas").Material>}
   */
  #materials = new Map();
  /**
   * @type {Array<{mesh: import("playcanvas").MeshInstance, original: import("playcanvas").Material, inverse: import("playcanvas").Mat4}>}
   */
  #surfaces = [];
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #updateHandle;
  /**
   * @type {boolean}
   */
  #visible = false;
  /**
   * @type {number}
   */
  #time = 0;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   */
  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#updateHandle = app.on("update", /**
     * @param {number} deltaTime
     */
    (deltaTime) => {
      this.#time += deltaTime;
      for (const material of this.#materials.values()) {
        material.setParameter("uRouteTime", this.#time);
      }
      // Instance matrices are authored in map coordinates. Remove the owning
      // terrain node's transform so paint follows island motion and map rotation.
      for (const { mesh, inverse } of this.#surfaces) {
        inverse.copy(mesh.node.getWorldTransform()).invert();
        mesh.setParameter("uRouteWorldToMap", inverse.data);
      }
    });
  }

  get visible() {
    return this.#visible;
  }

  /**
   * @param {boolean} visible
   */
  set visible(visible) {
    this.#visible = visible;
    for (const material of this.#materials.values()) {
      material.setParameter("uRouteVisible", visible ? 1 : 0);
    }
  }

  /**
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   * @param {import("playcanvas").Entity} root
   */
  render(mapData, root) {
    this.clear();
    const markers = PathArrowTextureLayout.markers(mapData);
    if (!markers.length) {
      return;
    }
    // Different heights need separate atlas layers only where their footprints
    // overlap. A long ramp can otherwise share one layer with the flat road.
    const atlasLayers = [];
    let heightRange = 4;
    for (const marker of markers) {
      heightRange = Math.max(heightRange, marker.elevation + 4);
      let selected = -1;
      for (let index = 0; index < atlasLayers.length; index += 1) {
        let overlaps = false;
        for (const existing of atlasLayers[index]) {
          if (Math.abs(existing.col - marker.col) < 1.4 &&
              Math.abs(existing.row - marker.row) < 1.4) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) {
          selected = index;
          break;
        }
      }
      if (selected < 0) {
        selected = atlasLayers.length;
        atlasLayers.push([]);
      }
      atlasLayers[selected].push(marker);
    }
    const layers = atlasLayers.length;
    const resolution = Math.min(32, Math.floor(
      this.#app.graphicsDevice.maxTextureSize / Math.max(mapData.cols, mapData.rows * layers),
    ));
    const width = mapData.cols * resolution;
    const layerHeight = mapData.rows * resolution;
    const height = layerHeight * layers;
    const mask = new Uint8Array(width * height * 4);
    const heights = new Uint8Array(mask.length);
    for (let layer = 0; layer < layers; layer += 1) {
      for (const marker of atlasLayers[layer]) {
        const cosine = Math.cos(marker.pitch);
        const minX = Math.max(0, Math.floor((marker.col - 0.7 + 0.5) * resolution));
        const maxX = Math.min(width - 1, Math.ceil((marker.col + 0.7 + 0.5) * resolution));
        const minZ = Math.max(0, Math.floor((marker.row - 0.7 + 0.5) * resolution));
        const maxZ = Math.min(layerHeight - 1, Math.ceil((marker.row + 0.7 + 0.5) * resolution));
        for (let z = minZ; z <= maxZ; z += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const dc = (x + 0.5) / resolution - 0.5 - marker.col;
            const dr = (z + 0.5) / resolution - 0.5 - marker.row;
            const across = (dc * marker.dz - dr * marker.dx) / 0.86;
            const along = (dc * marker.dx + dr * marker.dz) / (0.9 * cosine);
            // Signed distance to the original shaft and triangular head. The
            // transition spans one texel to keep the silhouette legible at zoom.
            const shaft = Math.min(0.1 - Math.abs(across), along + 0.32, 0.04 - along);
            const head = Math.min(along + 0.01,
              (0.43 - along - Math.abs(across) * (0.44 / 0.34)) / 1.637);
            const core = Math.max(0, Math.min(1, 0.5 + Math.max(shaft, head) * resolution * 0.86));
            const radius = Math.hypot(across / 0.6, along / 0.54);
            const glow = Math.max(0, 1 - radius) ** 2 * 0.58;
            if (core + glow < 0.004) {
              continue;
            }
            const offset = ((z + layer * layerHeight) * width + x) * 4;
            if (mask[offset] > core * 255) {
              continue;
            }
            mask[offset] = Math.round(core * 255);
            mask[offset + 1] = Math.round(glow * 255);
            mask[offset + 2] = marker.palette;
            mask[offset + 3] = Math.round(Math.max(0, Math.min(1, (along + 0.32) / 0.75)) * 255);
            const surfaceHeight = marker.elevation + along * 0.9 * Math.sin(marker.pitch);
            const packedHeight = Math.round(surfaceHeight / heightRange * 65535);
            heights[offset] = packedHeight >> 8;
            heights[offset + 1] = packedHeight & 255;
            heights[offset + 2] = marker.palette;
            heights[offset + 3] = mask[offset + 3];
          }
        }
      }
    }
    const maskTexture = this.#texture("Path route paint", width, height, mask, true);
    const heightTexture = this.#texture("Path route elevations", width, height, heights, false);
    const paletteTexture = this.#palette(mapData.entries);
    const shader = `#define ROUTE_LAYER_COUNT ${layers}\n${routeShader}\n${pathSurfaceShader.replace(
      "void getAlbedo()", "void getPathAlbedo()",
    )}\nvoid getAlbedo() { getPathAlbedo(); dAlbedo *= 1.0 - routePaint().a; }`;
    for (const component of root.findComponents("render")) {
      for (const mesh of component.meshInstances) {
        const original = mesh.material;
        if (!/^path(?:-\d+)?$/.test(original.name)) {
          continue;
        }
        let material = this.#materials.get(original);
        if (!material) {
          material = original.clone();
          material.shaderChunksVersion = this.#pc.version.split(".").slice(0, 2).join(".");
          const chunks = material.getShaderChunks(this.#pc.SHADERLANGUAGE_GLSL);
          chunks.set("diffusePS", shader);
          chunks.set("emissivePS", "void getEmission() { dEmission = routePaint().rgb; }");
          const wgslChunks = material.getShaderChunks(this.#pc.SHADERLANGUAGE_WGSL);
          wgslChunks.set("diffusePS", routeWgslShader);
          wgslChunks.set("emissivePS", "fn getEmission() { dEmission = routePaint().rgb; }");
          material.setParameter("uRouteMask", maskTexture);
          material.setParameter("uRouteHeight", heightTexture);
          material.setParameter("uRoutePalette", paletteTexture);
          material.setParameter("uRouteMap", new Float32Array([
            mapData.cols / 2, mapData.rows / 2, mapData.cols, mapData.rows,
          ]));
          material.setParameter("uRouteLayers", layers);
          material.setParameter("uRouteHeightRange", heightRange);
          material.setParameter("uRouteVisible", this.#visible ? 1 : 0);
          material.setParameter("uRouteTime", this.#time);
          material.update();
          this.#materials.set(original, material);
        }
        const inverse = new this.#pc.Mat4().copy(mesh.node.getWorldTransform()).invert();
        mesh.material = material;
        mesh.setParameter("uRouteWorldToMap", inverse.data);
        this.#surfaces.push({ mesh, original, inverse });
      }
    }
  }

  /**
   * @param {import("src/game/GameContracts.js").GameCanvasPluginEntry[]} entries
   * @returns {import("playcanvas").Texture}
   */
  #palette(entries) {
    const pixels = new Uint8Array(128 * 16 * 4);
    for (let mask = 1; mask < 16; mask += 1) {
      const colors = [];
      for (let index = 0; index < entries.length; index += 1) {
        if (mask & (1 << index)) {
          colors.push(entries[index].color);
        }
      }
      if (!colors.length) {
        continue;
      }
      for (let x = 0; x < 128; x += 1) {
        const phase = x / 128 * colors.length;
        const index = Math.floor(phase);
        const blend = Math.max(0, (phase - index - 0.72) / 0.28);
        for (let channel = 0; channel < 3; channel += 1) {
          const shift = (2 - channel) * 8;
          const a = (colors[index] >> shift) & 255;
          const b = (colors[(index + 1) % colors.length] >> shift) & 255;
          pixels[(mask * 128 + x) * 4 + channel] = Math.round(a + (b - a) * blend);
        }
        pixels[(mask * 128 + x) * 4 + 3] = 255;
      }
    }
    const texture = this.#texture("Route colors", 128, 16, pixels, true);
    texture.addressU = this.#pc.ADDRESS_REPEAT;
    return texture;
  }

  /**
   * @param {string} name
   * @param {number} width
   * @param {number} height
   * @param {Uint8Array} pixels
   * @param {boolean} linear
   * @returns {import("playcanvas").Texture}
   */
  #texture(name, width, height, pixels, linear) {
    const pc = this.#pc;
    const texture = new pc.Texture(this.#app.graphicsDevice, {
      name, width, height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
      minFilter: linear ? pc.FILTER_LINEAR : pc.FILTER_NEAREST,
      magFilter: linear ? pc.FILTER_LINEAR : pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      levels: [pixels],
    });
    texture.upload();
    this.#textures.push(texture);
    return texture;
  }

  clear() {
    for (const { mesh, original } of this.#surfaces) {
      mesh.material = original;
      mesh.deleteParameter("uRouteWorldToMap");
    }
    this.#surfaces = [];
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
    for (const texture of this.#textures) {
      texture.destroy();
    }
    this.#textures = [];
  }

  destroy() {
    this.clear();
    this.#updateHandle.off();
  }
}
