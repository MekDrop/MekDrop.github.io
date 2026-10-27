import { BridgeRailingKit } from "./BridgeRailingKit.js";
import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";

/**
 * @typedef {{pc:typeof import("playcanvas"), app:import("playcanvas").Application, materials:Map<string,import("playcanvas").Material>, modelLibrary?:import("../../models/GameModelLibrary.js").GameModelLibrary, material:string}} BridgeImpactResourceOptions
 * @typedef {{mesh:import("playcanvas").Mesh, material:import("playcanvas").Material, warm:import("playcanvas").MeshInstance}} BridgeChipTemplate
 * @typedef {{paving:BridgeChipTemplate[], timber:BridgeChipTemplate[]}} BridgeChipVariant
 * @typedef {{warmShaders:(camera:import("playcanvas").CameraComponent)=>boolean, createPaving:(root:import("playcanvas").Entity,size:import("playcanvas").Vec3)=>import("playcanvas").MeshInstance[], createTimber:(root:import("playcanvas").Entity,size:import("playcanvas").Vec3)=>import("playcanvas").MeshInstance[], release:()=>void}} BridgeImpactResourceLease
 */

/**
 * Map-loading geometry and shader preparation shared by bridges and live rubble.
 * Resource templates are detached from the scene; preparation never draws them.
 */
export class BridgeImpactResources {
  /**
   * @type {WeakMap<import("playcanvas").GraphicsDevice, WeakMap<Map<string,import("playcanvas").Material>,BridgeImpactResources>>}
   */
  static #devices = new WeakMap();
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {Map<string,import("playcanvas").Material>}
   */
  #materials;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {TerrainInstanceRenderer}
   */
  #renderer;
  /**
   * @type {Array<{mesh:import("playcanvas").Mesh,path:boolean}>}
   */
  #paving = [];
  /**
   * @type {import("playcanvas").VertexBuffer}
   */
  #identity;
  /**
   * @type {import("playcanvas").Mesh}
   */
  #woodMesh;
  /**
   * @type {import("playcanvas").Material}
   */
  #woodMaterial;
  /**
   * @type {Map<import("playcanvas").Material,import("playcanvas").Material>}
   */
  #prototypes = new Map();
  /**
   * @type {Map<string,BridgeChipVariant>}
   */
  #variants = new Map();
  /**
   * @type {import("playcanvas").MeshInstance[]}
   */
  #warmInstances = [];
  /**
   * @type {number}
   */
  #leases = 0;

  /**
   * @param {BridgeImpactResourceOptions} options
   * @returns {BridgeImpactResourceLease}
   */
  static acquire(options) {
    const device = options.app.graphicsDevice;
    let maps = BridgeImpactResources.#devices.get(device);
    if (!maps) {
      maps = new WeakMap();
      BridgeImpactResources.#devices.set(device, maps);
    }
    let resources = maps.get(options.materials);
    if (!resources) {
      resources = new BridgeImpactResources(options);
      maps.set(options.materials, resources);
    }
    const variant = resources.#variant(options.material);
    resources.#leases++;
    let released = false;

    return {
      /**
       * @param {import("playcanvas").CameraComponent} camera
       */
      warmShaders: (camera) => resources.#warmShaders(camera, variant),
      /**
       * @param {import("playcanvas").Entity} root
       * @param {import("playcanvas").Vec3} size
       */
      createPaving: (root, size) => resources.#createVisual(root, size, variant.paving),
      /**
       * @param {import("playcanvas").Entity} root
       * @param {import("playcanvas").Vec3} size
       */
      createTimber: (root, size) => resources.#createVisual(root, size, variant.timber),
      release: () => {
        if (released) {
          return;
        }
        released = true;
        resources.#leases--;
        if (resources.#leases === 0) {
          maps.delete(options.materials);
          resources.#destroy();
        }
      },
    };
  }

  /**
   * @param {BridgeImpactResourceOptions} options
   */
  constructor({ pc, app, materials, modelLibrary, material }) {
    this.#pc = pc;
    this.#app = app;
    this.#materials = materials;
    this.#root = new pc.Entity("Bridge chip resource templates");
    this.#root.enabled = false;
    // One unit template supplies the exact original paving faces and UVs.
    // It is never attached to app.root or submitted for rendering.
    this.#renderer = new TerrainInstanceRenderer({
      pc,
      app,
      root: this.#root,
      materials,
    });
    this.#renderer.addBoxMatrix("path", material, 0, 0, 0, 0, 1, 1, 1, "surfaceOnly", "none");
    this.#renderer.addBoxMatrix("path", material, 0, 0, 0, 0, 1, 1, 1, "bridgeHorizontalSidesOnly", material);
    this.#renderer.addBoxMatrix("none", material, 0, 0, 0, 0, 1, 1, 1, "bridgeVerticalSidesOnly", "none");
    this.#renderer.build();
    for (const render of this.#root.findComponents("render")) {
      for (const instance of render.meshInstances) {
        this.#identity ??= instance.instancingData.vertexBuffer;
        this.#paving.push({
          mesh: instance.mesh,
          path: instance.material === materials.get("path"),
        });
      }
    }
    this.#woodMesh = pc.createBox(app.graphicsDevice);
    this.#woodMesh.incRefCount();
    this.#woodMaterial = materials.get(material);
    if (modelLibrary?.instantiate) {
      const source = modelLibrary.instantiate(BridgeRailingKit.modelUrls[0]);
      this.#woodMaterial = source.findComponents("render")[0].meshInstances[0].material;
      source.destroy();
    }
  }

  /**
   * @param {string} material
   * @returns {BridgeChipVariant}
   */
  #variant(material) {
    let variant = this.#variants.get(material);
    if (!variant) {
      variant = {
        paving: this.#paving.map(/**
         *
         * @param {{mesh:import("playcanvas").Mesh,path:boolean}} face
         */
          (face) => this.#template(face.mesh,
            face.path ? this.#materials.get("path") : this.#materials.get(material))),
        timber: [this.#template(this.#woodMesh, this.#woodMaterial)],
      };
      this.#variants.set(material, variant);
    }

    return variant;
  }

  /**
   * @param {import("playcanvas").Mesh} mesh
   * @param {import("playcanvas").Material} original
   * @returns {BridgeChipTemplate}
   */
  #template(mesh, original) {
    let material = this.#prototypes.get(original);
    if (!material) {
      material = original.clone();
      material.name = `${original.name} bridge chip fade`;
      material.blendType = this.#pc.BLEND_NORMAL;
      material.depthWrite = false;
      material.opacity = 1;
      material.update();
      this.#prototypes.set(original, material);
    }
    const warm = new this.#pc.MeshInstance(mesh, material, new this.#pc.GraphNode("Bridge chip shader preparation"));
    warm.setInstancing(this.#identity, false);
    this.#warmInstances.push(warm);

    return {
      mesh,
      material,
      warm,
    };
  }

  /**
   * @param {import("playcanvas").Entity} root
   * @param {import("playcanvas").Vec3} size
   * @param {BridgeChipTemplate[]} templates
   * @returns {import("playcanvas").MeshInstance[]}
   */
  #createVisual(root, size, templates) {
    const pc = this.#pc;
    const visual = new pc.Entity("Original bridge chip materials");
    visual.setLocalScale(size);
    const instances = templates.map(/**
     *
     * @param {BridgeChipTemplate} template
     */
      (template) => {
        const instance = new pc.MeshInstance(template.mesh, template.material, visual);
        instance.setInstancing(this.#identity, false);
        instance.setParameter("material_opacity", 1);

        return instance;
      });
    visual.addComponent("render", {
      meshInstances: instances,
      castShadows: true,
      receiveShadows: true,
    });
    root.addChild(visual);

    return instances;
  }

  /**
   * Finalize the same forward and shadow programs used by actual chip instances.
   * This runs during normal map loading and issues no geometry draw commands.
   * @param {import("playcanvas").CameraComponent} camera
   * @param {BridgeChipVariant} variant
   * @returns {boolean}
   */
  #warmShaders(camera, variant) {
    const { graphicsDevice: device, scene, renderer } = this.#app;
    const layer = scene.layers.getLayerById(this.#pc.LAYERID_WORLD);
    if (!camera?.shaderParams || !layer || !renderer) {
      return false;
    }
    // LightsBuffer installs these device chunks during the first real clustered
    // render. Compiling earlier would cache an invalid shader in ProgramLibrary.
    if (scene.clusteredLightingEnabled && this.#pc.ShaderChunks) {
      const language = device.isWebGPU ? this.#pc.SHADERLANGUAGE_WGSL : this.#pc.SHADERLANGUAGE_GLSL;
      const chunks = this.#pc.ShaderChunks.get(device, language);
      if (!chunks.get("lightBufferDefinesPS")) {
        return false;
      }
    }
    const previous = device.shader;
    const lightHash = layer.getLightHash(scene.clusteredLightingEnabled);
    const templates = [...variant.paving, ...variant.timber];
    try {
      for (const template of templates) {
        template.material.updateUniforms?.(device, scene);
        const instance = template.warm.getShaderInstance(this.#pc.SHADER_FORWARD, lightHash, scene,
          camera.shaderParams, renderer.viewUniformFormat, layer.splitLights);
        device.setShader(instance.shader, false);
        if (device.activateShader?.() === false) {
          return false;
        }
        for (const lights of layer.splitLights) {
          for (const light of lights) {
            if (!light.castShadows || !renderer.shadowRenderer) {
              continue;
            }
            const pass = renderer.shadowRenderer.getShadowPass(light);
            const shadow = template.warm.getShaderInstance(pass, 0, scene, camera.shaderParams,
              renderer.shadowRenderer.viewUniformFormat);
            device.setShader(shadow.shader, false);
            if (device.activateShader?.() === false) {
              return false;
            }
          }
        }
      }
    } finally {
      device.setShader(previous, false);
    }

    return true;
  }

  #destroy() {
    for (const instance of this.#warmInstances) {
      instance.destroy();
    }
    this.#warmInstances = [];
    this.#renderer.destroy();
    this.#root.destroy();
    this.#woodMesh.decRefCount();
    if (this.#woodMesh.refCount < 1) {
      this.#woodMesh.destroy();
    }
    for (const material of this.#prototypes.values()) {
      material.destroy();
    }
    this.#prototypes.clear();
    this.#variants.clear();
  }
}
