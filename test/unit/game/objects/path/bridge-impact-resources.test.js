import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as pc from "playcanvas";

const sourceUrl = new URL("../../../../../src/game/objects/path/BridgeImpactResources.js", import.meta.url);
const source = readFileSync(sourceUrl, "utf8")
  .replace('import { BridgeRailingKit } from "./BridgeRailingKit.js";', 'class BridgeRailingKit { static modelUrls=["original-rail"]; }')
  .replace('import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";', `
    class TerrainInstanceRenderer {
      constructor({pc,app,root,materials}) { this.pc=pc;this.app=app;this.root=root;this.materials=materials;app.stats.templates++;this.meshes=[];this.buffer={numVertices:1,destroy:()=>app.stats.buffersDisposed++}; }
      addBoxMatrix() {}
      build() { for(const key of ["path","timber","timber","timber"]){const mesh=this.pc.createBox(this.app.graphicsDevice);mesh.incRefCount();this.meshes.push(mesh);const entity=new this.pc.Entity("Unit template face");const instance=new this.pc.MeshInstance(mesh,this.materials.get(key),entity);instance.setInstancing(this.buffer,false);entity.addComponent("render",{meshInstances:[instance]});this.root.addChild(entity);} }
      destroy() {this.app.stats.templatesDisposed++;for(const child of [...this.root.children])child.destroy();for(const mesh of this.meshes){mesh.decRefCount();if(mesh.refCount<1)mesh.destroy();}this.buffer.destroy();}
    }
  `);
const { BridgeImpactResources } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

class ComponentEntity extends pc.Entity {
  /**
   * @param {string} name
   * @param {Record<string,number|string>} options
   */
  addComponent(name, options) {
    this[name] = options;
  }

  /**
   * @param {string} name
   */
  findComponents(name) {
    const result = this[name] ? [this[name]] : [];
    for (const child of this.children) {
      result.push(...child.findComponents(name));
    }

    return result;
  }

  destroy() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const instance of this.render?.meshInstances ?? []) {
      instance.destroy();
    }
    super.destroy();
  }
}

function environment() {
  const stats = {
    templates: 0,
    templatesDisposed: 0,
    buffersDisposed: 0,
    meshesDisposed: 0,
    clones: 0,
    clonesDisposed: 0,
    updates: 0,
    compiled: 0,
  };
  class Mesh {
    refCount = 0;
    incRefCount() {
      this.refCount++;
    }
    decRefCount() {
      this.refCount--;
    }
    destroy() {
      assert.equal(this.disposed, undefined); this.disposed = true; stats.meshesDisposed++;
    }
  }
  class Material {
    shaders = new Map();
    opacity = 1;
    /**
     * @param {string} name
     */
    constructor(name) {
      this.name = name;
    }
    clone() {
      stats.clones++;

      return new Material(this.name);
    }
    update() {
      stats.updates++;
    }
    updateUniforms() {}
    destroy() {
      stats.clonesDisposed++;
    }
  }
  class MeshInstance {
    parameters = new Map();
    /**
     * @param {Mesh} mesh
     * @param {Material} material
     * @param {pc.GraphNode} node
     */
    constructor(mesh, material, node) {
      this.mesh = mesh;
      this.material = material;
      this.node = node;
      mesh.incRefCount();
    }
    /**
     * @param {{numVertices:number}} buffer
     */
    setInstancing(buffer) {
      this.instancingData = { vertexBuffer: buffer };
    }
    /**
     * @param {string} name
     * @param {number} value
     */
    setParameter(name, value) {
      this.parameters.set(name, value);
    }
    /**
     * @param {number} pass
     * @param {number} hash
     * @param {Record<string,number>} scene
     * @param {{hash:number}} camera
     */
    getShaderInstance(pass, hash, scene, camera) {
      const key = `${pass}:${hash}:${camera.hash}`;
      let shader = this.material.shaders.get(key);
      if (!shader) {
        shader = { ready: false };
        this.material.shaders.set(key, shader);
      }

      return { shader };
    }
    destroy() {
      this.mesh.decRefCount();
      if (this.mesh.refCount < 1) {
        this.mesh.destroy();
      }
    }
  }
  const device = {
    shader: { ready: true },
    setShader: (shader) => {
      device.shader = shader;
    },
    activateShader: () => {
      if (!device.shader.ready) {
        stats.compiled++; device.shader.ready = true;
      }
    },
    draw: () => assert.fail("Resource preparation must never draw geometry"),
  };
  const layer = {
    getLightHash: () => 7,
    splitLights: [[{ castShadows: true }, { castShadows: false }], [], []],
  };
  const app = {
    root: new ComponentEntity("Live scene"),
    stats,
    graphicsDevice: device,
    scene: {
      layers: { getLayerById: () => layer },
      clusteredLightingEnabled: false,
    },
    renderer: {
      viewUniformFormat: {},
      shadowRenderer: { getShadowPass: () => 5 },
    },
  };
  const materials = new Map([["path", new Material("path")], ["timber", new Material("timber")]]);
  const wood = new Material("authored rail wood");
  const options = {
    pc: {
      ...pc,
      Entity: ComponentEntity,
      MeshInstance,
      createBox: () => new Mesh(),
    },
    app,
    materials,
    material: "timber",
    modelLibrary: {
      instantiate: () => {
        const entity = new ComponentEntity("Material source");
        entity.addComponent("render", {
          meshInstances: [{
            material: wood,
            destroy: () => {},
          }],
        });

        return entity;
      },
    },
  };

  return {
    options,
    stats,
    device,
    camera: { shaderParams: { hash: 3 } },
  };
}

it("shares one unit template and identity buffer across bridge and live-rubble leases", () => {
  const { options, stats } = environment();
  const bridge = BridgeImpactResources.acquire(options);
  const otherBridge = BridgeImpactResources.acquire(options);
  const rubble = BridgeImpactResources.acquire(options);
  assert.equal(stats.templates, 1);
  assert.equal(stats.clones, 3);
  assert.equal(options.app.root.children.length, 0);
  const first = new ComponentEntity("First actual chip");
  const second = new ComponentEntity("Second actual chip");
  const a = bridge.createPaving(first, new pc.Vec3(0.3, 0.12, 0.5));
  const b = rubble.createPaving(second, new pc.Vec3(0.4, 0.1, 0.6));
  assert.equal(a.length, 4);
  for (let index = 0; index < a.length; index++) {
    assert.equal(a[index].mesh, b[index].mesh);
    assert.equal(a[index].material, b[index].material);
    assert.equal(a[index].instancingData.vertexBuffer, b[index].instancingData.vertexBuffer);
  }
  bridge.release();
  otherBridge.release();
  assert.equal(stats.templatesDisposed, 0);
  first.destroy();
  second.destroy();
  rubble.release();
  assert.equal(stats.templatesDisposed, 1);
  assert.equal(stats.buffersDisposed, 1);
  assert.equal(stats.meshesDisposed, 5);
  assert.equal(stats.clonesDisposed, 3);
  rubble.release();
  assert.equal(stats.templatesDisposed, 1);
  const replacement = BridgeImpactResources.acquire(options);
  assert.equal(stats.templates, 2);
  replacement.release();
});

it("finalizes actual forward/shadow programs without drawing and fades with per-instance uniforms only", () => {
  const { options, stats, camera, device } = environment();
  const bridge = BridgeImpactResources.acquire(options);
  const previousShader = device.shader;
  assert.equal(bridge.warmShaders(camera), true);
  assert.equal(device.shader, previousShader);
  assert.equal(options.app.root.children.length, 0);
  assert.equal(stats.compiled, 6);
  const clones = stats.clones;
  const updates = stats.updates;
  const root = new ComponentEntity("Live chip");
  const instances = bridge.createPaving(root, new pc.Vec3(0.3, 0.12, 0.5));
  for (const instance of instances) {
    assert.equal(instance.material.blendType, pc.BLEND_NORMAL);
    assert.equal(instance.material.depthWrite, false);
    assert.equal(instance.material.opacity, 1);
    instance.setParameter("material_opacity", 0.25);
    assert.equal(instance.parameters.get("material_opacity"), 0.25);
    assert.equal(instance.material.opacity, 1);
    device.setShader(instance.getShaderInstance(pc.SHADER_FORWARD, 7, options.app.scene, camera.shaderParams).shader);
    device.activateShader();
  }
  assert.equal(stats.compiled, 6);
  assert.equal(stats.clones, clones);
  assert.equal(stats.updates, updates);
  assert.equal(options.materials.get("path").opacity, 1);
  root.destroy();
  bridge.release();
});

it("waits for real clustered-light chunk initialization before compiling any program", () => {
  for (const webgpu of [false, true]) {
    const { options, stats, camera, device } = environment();
    options.app.scene.clusteredLightingEnabled = true;
    device.isWebGPU = webgpu;
    const chunks = new Map();
    let actualLanguage;
    options.pc.ShaderChunks = {
      get: (_device, language) => {
        actualLanguage = language;

        return chunks;
      },
    };
    const bridge = BridgeImpactResources.acquire(options);
    const previous = device.shader;
    assert.equal(bridge.warmShaders(camera), false);
    assert.equal(stats.compiled, 0);
    assert.equal(device.shader, previous);
    assert.equal(actualLanguage, webgpu ? pc.SHADERLANGUAGE_WGSL : pc.SHADERLANGUAGE_GLSL);
    chunks.set("lightBufferDefinesPS", "engine-initialized light buffer definitions");
    assert.equal(bridge.warmShaders(camera), true);
    assert.equal(stats.compiled, 6);
    bridge.release();
  }
});
