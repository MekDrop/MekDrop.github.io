import { CloudShadowMask } from "./CloudShadowMask.js";
import glsl from "./CloudShadow.frag?raw";
import wgsl from "./CloudShadow.wgsl?raw";

const RESOLUTION = 512;
const SPAN = 256;

/**
 * Soft sunlight transmission from overhead clouds, shared by lit receivers.
 */
export class CloudShadows {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("playcanvas").CameraComponent}
   */
  #camera;
  /**
   * @type {import("playcanvas").LightComponent|null}
   */
  #sun = null;
  /**
   * @type {import("playcanvas").Texture|null}
   */
  #texture = null;
  /**
   * @type {import("playcanvas").Vec2}
   */
  #center;
  /**
   * @type {import("playcanvas").Vec2}
   */
  #slope;
  /**
   * @type {Array<{chunks: import("playcanvas").ShaderChunkMap, original: string}>}
   */
  #chunks = [];

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, camera: import("playcanvas").CameraComponent}} options
   */
  constructor({ pc, app, camera }) {
    this.#pc = pc;
    this.#app = app;
    this.#camera = camera;
    this.#center = new pc.Vec2(Infinity, Infinity);
    this.#slope = new pc.Vec2();
    this.#sun = app.root.findComponents("light").find(CloudShadows.#directional) ?? null;
    if (!this.#sun) {
      return;
    }
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: "Overhead cloud sunlight transmission",
      width: RESOLUTION,
      height: RESOLUTION,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const clear = this.#texture.lock();
    clear.fill(255);
    this.#texture.unlock();
    app.graphicsDevice.scope.resolve("uCloudShadowTexture").setValue(this.#texture);
    for (const [language, helper] of [[pc.SHADERLANGUAGE_GLSL, glsl], [pc.SHADERLANGUAGE_WGSL, wgsl]]) {
      const chunks = pc.ShaderChunks.get(app.graphicsDevice, language);
      const original = chunks.get("lightFunctionLightPS");
      chunks.set("lightFunctionLightPS", `${helper}\n${original.replace(
        "dAtten = 1.0;", "dAtten = cloudSunTransmission(vPositionW, dLightDirNormW);",
      )}`);
      this.#chunks.push({
        chunks,
        original,
      });
    }
    // Materials created before this scenery service must compile the new light hook.
    const materials = new Set();
    for (const render of app.root.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        if (mesh.material instanceof pc.StandardMaterial) {
          materials.add(mesh.material);
        }
      }
    }
    for (const material of materials) {
      material.update();
    }
  }

  /**
   * @param {import("playcanvas").LightComponent} light
   * @returns {boolean}
   */
  static #directional(light) {
    return light.type === "directional";
  }

  /**
   * @param {import("playcanvas").Vec2} travel
   */
  update(travel) {
    if (!this.#sun) {
      return;
    }
    const up = this.#sun.entity.up;
    const nextSlope = new this.#pc.Vec2(up.x / Math.max(up.y, 0.1), up.z / Math.max(up.y, 0.1));
    const position = this.#camera.entity.getPosition();
    const anchorX = position.x - travel.x * 12;
    const anchorZ = position.z - travel.y * 12;
    // Hysteresis avoids rebaking when eye motion straddles an atlas boundary.
    const center = Math.abs(anchorX - this.#center.x) > 64 || Math.abs(anchorZ - this.#center.y) > 64
      ? new this.#pc.Vec2(Math.round(anchorX / 64) * 64, Math.round(anchorZ / 64) * 64)
      : this.#center;
    if (!center.equals(this.#center) || !nextSlope.equals(this.#slope)) {
      this.#center.copy(center);
      this.#slope.copy(nextSlope);
      const pixels = CloudShadowMask.bake({
        minX: center.x - SPAN / 2,
        minZ: center.y - SPAN / 2,
        span: SPAN,
        resolution: RESOLUTION,
        slope: nextSlope,
      });
      this.#texture.lock().set(pixels);
      this.#texture.unlock();
    }
    const scope = this.#app.graphicsDevice.scope;
    scope.resolve("uCloudShadowBounds").setValue([center.x - SPAN / 2, center.y - SPAN / 2, 1 / SPAN, up.y > 0.1 ? 1 : 0]);
    scope.resolve("uCloudShadowProjection").setValue([nextSlope.x, nextSlope.y, travel.x * 12, travel.y * 12]);
    scope.resolve("uCloudSunDirection").setValue([-up.x, -up.y, -up.z]);
  }

  destroy() {
    for (const { chunks, original } of this.#chunks) {
      chunks.set("lightFunctionLightPS", original);
    }
    this.#app.graphicsDevice.scope.resolve("uCloudShadowBounds").setValue([0, 0, 1, 0]);
    this.#texture?.destroy();
  }
}
