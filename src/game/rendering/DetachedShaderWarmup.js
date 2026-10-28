/**
 * Prepares first-use shader variants without submitting the template to the scene.
 * The caller supplies a detached template and retains ownership of its resources.
 */
export class DetachedShaderWarmup {
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #handle = null;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {number}
   */
  #attempts = 0;

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {import("playcanvas").Entity} root
   */
  constructor(pc, app, root) {
    this.#pc = pc;
    this.#app = app;
    this.#root = root;
    this.#schedule();
  }

  destroy() {
    this.#handle?.off();
    this.#handle = null;
  }

  #schedule() {
    this.#handle = this.#app.once("postrender", this.#prepare, this);
  }

  #prepare() {
    this.#handle = null;
    if (!this.#warm() && ++this.#attempts < 4) {
      this.#schedule();
    }
  }

  /**
   * Wait for the first real render to install clustered-light shader chunks.
   * @returns {boolean}
   */
  #warm() {
    const pc = this.#pc;
    const { graphicsDevice: device, scene, renderer } = this.#app;
    const layer = scene.layers.getLayerById(pc.LAYERID_WORLD);
    const camera = this.#app.root.findComponents("camera").find(this.#worldCamera)?.camera;
    if (!camera || !layer || !renderer) {
      return false;
    }
    const language = device.isWebGPU ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL;
    if (scene.clusteredLightingEnabled && !pc.ShaderChunks.get(device, language).get("lightBufferDefinesPS")) {
      return false;
    }
    const previous = device.shader;
    const lightHash = layer.getLightHash(scene.clusteredLightingEnabled);
    try {
      for (const render of this.#root.findComponents("render")) {
        for (const mesh of render.meshInstances) {
          mesh.material.updateUniforms?.(device, scene);
          const forward = mesh.getShaderInstance(pc.SHADER_FORWARD, lightHash, scene,
            camera.shaderParams, renderer.viewUniformFormat, layer.splitLights);
          device.setShader(forward.shader, false);
          if (device.activateShader?.() === false) {
            return false;
          }
          if (!mesh.castShadow || !render.castShadows) {
            continue;
          }
          for (const lights of layer.splitLights) {
            for (const light of lights) {
              if (!light.castShadows || !renderer.shadowRenderer) {
                continue;
              }
              const pass = renderer.shadowRenderer.getShadowPass(light);
              const shadow = mesh.getShaderInstance(pass, 0, scene, camera.shaderParams,
                renderer.shadowRenderer.viewUniformFormat);
              device.setShader(shadow.shader, false);
              if (device.activateShader?.() === false) {
                return false;
              }
            }
          }
        }
      }
    } finally {
      device.setShader(previous, false);
    }

    return true;
  }

  /**
   * @type {(camera: import("playcanvas").CameraComponent) => boolean}
   * @param {import("playcanvas").CameraComponent} camera
   * @returns {boolean}
   */
  #worldCamera = (camera) => camera.enabled && camera.entity.enabled && camera.layers.includes(this.#pc.LAYERID_WORLD);
}
