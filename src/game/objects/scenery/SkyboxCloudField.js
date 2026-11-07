import { PROJECTION_PERSPECTIVE } from "playcanvas";
import { getAmbientWind } from "../shared/AmbientWind.js";
import fragmentGLSL from "./SkyboxCloud.frag?raw";
import vertexGLSL from "./SkyboxCloud.vert?raw";
import cloudVoxels from "./CloudVoxelVariants.json";
import { CloudShadows } from "./CloudShadows.js";
import skySettings from "./CloudSkySettings.json";

/**
 * Direction-sampled procedural skybox shared by both gameplay cameras.
 */
export class SkyboxCloudField {
  /**
   * @type {import("playcanvas").CameraComponent}
   */
  #camera;
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").ShaderMaterial}
   */
  #material;
  /**
   * @type {import("playcanvas").Texture}
   */
  #voxels;
  /**
   * @type {CloudShadows}
   */
  #shadows;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #prerender;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {import("playcanvas").Vec2}
   */
  #travel;
  /**
   * @type {ReturnType<typeof getAmbientWind>}
   */
  #wind = getAmbientWind(0);

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, camera: import("playcanvas").CameraComponent, layerId: number}} options
   */
  constructor({ pc, app, camera, layerId }) {
    this.#camera = camera;
    this.#shadows = new CloudShadows({
      pc,
      app,
      camera,
    });
    this.#travel = new pc.Vec2(9.7, 3.1);
    this.#entity = new pc.Entity("Cloud skybox");
    this.#material = new pc.ShaderMaterial({
      uniqueName: "procedural-cloud-skybox",
      vertexGLSL,
      fragmentGLSL,
      attributes: { vertex_position: pc.SEMANTIC_POSITION },
    });
    this.#material.depthWrite = false;
    this.#material.depthTest = false;
    this.#material.cull = pc.CULLFACE_FRONT;
    this.#material.setParameter("uUpperCloudBank", [skySettings.upper.height, skySettings.upper.spacing, skySettings.upper.scale, skySettings.upper.coverage]);
    this.#material.setParameter("uLowerCloudBank", [skySettings.lower.height, skySettings.lower.spacing, skySettings.lower.scale, skySettings.lower.coverage]);
    this.#material.setParameter("uLowerCloudSeed", skySettings.lower.seed);
    this.#material.setParameter("uSkyZenith", skySettings.zenith);
    this.#material.setParameter("uSkyHorizon", skySettings.horizon);
    this.#material.setParameter("uSkyBelow", skySettings.below);
    this.#voxels = new pc.Texture(app.graphicsDevice, {
      name: "Original cloud voxel variants",
      width: 32,
      height: 20,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const pixels = this.#voxels.lock();
    for (const [variant, voxels] of cloudVoxels.variants.entries()) {
      for (const [index, voxel] of voxels.entries()) {
        const offset = (variant * 32 + index) * 4;
        pixels[offset] = voxel[0] + 8;
        pixels[offset + 1] = voxel[1] + 8;
        pixels[offset + 2] = voxel[2] + 8;
        pixels[offset + 3] = 255;
      }
    }
    this.#voxels.unlock();
    this.#material.setParameter("uCloudVoxels", this.#voxels);
    this.#material.setParameter("uCloudCube", [cloudVoxels.cubeStep, cloudVoxels.cubeSize]);
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.BoxGeometry());
    const instance = new pc.MeshInstance(mesh, this.#material, this.#entity);
    instance.cull = false;
    instance.castShadow = false;
    instance.receiveShadow = false;
    instance.pick = false;
    this.#entity.addComponent("render", {
      meshInstances: [instance],
      layers: [layerId],
    });
    // Register after the gameplay camera's eye-attachment refresh.
    this.#prerender = app.on("prerender", this.#syncCamera, this);
    this.#syncCamera();
  }

  get entity() {
    return this.#entity;
  }

  /**
   * @returns {number}
   */
  get windSpeed() {
    return this.#wind.speed;
  }

  /**
   * @returns {ReturnType<typeof getAmbientWind>}
   */
  get wind() {
    return {
      direction: { ...this.#wind.direction },
      speed: this.#wind.speed,
    };
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.1);
    this.#elapsed += dt;
    this.#wind = getAmbientWind(this.#elapsed);
    this.#travel.x += this.#wind.direction.x * this.#wind.speed * dt * 0.08;
    this.#travel.y += this.#wind.direction.z * this.#wind.speed * dt * 0.08;
  }

  #syncCamera() {
    const camera = this.#camera;
    // Orthographic scenery still needs a spread of sky directions. Use a fixed
    // virtual lens so map zoom never stretches the sky or changes cloud size.
    const tangent = Math.tan(
      ((camera.projection === PROJECTION_PERSPECTIVE ? camera.fov : 60) * Math.PI) / 360,
    );
    const aspect = camera.aspectRatio;
    this.#material.setParameter(
      "uSkyLens",
      camera.horizontalFov
        ? [tangent, tangent / aspect]
        : [tangent * aspect, tangent],
    );
    this.#material.setParameter("uCloudTravel", [this.#travel.x, this.#travel.y]);
    this.#shadows.update(this.#travel);
  }

  destroy() {
    this.#prerender.off();
    this.#shadows.destroy();
    this.#entity.destroy();
    this.#material.destroy();
    this.#voxels.destroy();
  }
}
