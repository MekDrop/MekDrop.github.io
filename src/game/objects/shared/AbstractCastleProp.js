import { IslandObjectRoots } from "./IslandObjectRoots.js";
import { addAuthoredMeshPhysics } from "./AuthoredMeshPhysics.js";
import { RigidModelBatch } from "../../rendering/RigidModelBatch.js";
import { DynamicRenderBatch } from "../../rendering/DynamicRenderBatch.js";

/**
 * Lifecycle for imported static castle props with an authored bottom-center pivot.
 * @abstract
 */
export class AbstractCastleProp {
  /**
   * @type {WeakMap<import("playcanvas").Material, Map<string, {material: import("playcanvas").Material, owners: number}>>}
   */
  static #weatheredMaterials = new WeakMap();
  /**
   * @type {Array<function(): void>}
   */
  #releaseWeatheredMaterials = [];
  /**
   * Decorative floor coverings rely on the castle floor for physical support.
   * @returns {boolean}
   */
  static get hasAuthoredCollision() {
    return true;
  }
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   * @type {import("playcanvas").Entity}
   */
  #collisionGraph;
  /**
   * @type {import("playcanvas").Material[]}
   */
  #instanceMaterials = [];
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {DynamicRenderBatch|null}
   */
  #renderBatch = null;

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    this.#pc = pc;
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} ${this.constructor.name}`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const { x, y, z } = definition.position;
    this.#visual.setLocalPosition(x, y, z);
    this.#visual.setLocalEulerAngles(definition.tilt?.x ?? 0, definition.rotation ?? 0, definition.tilt?.z ?? 0);
    const model = modelLibrary.instantiate(this.modelUrl);
    const scale = definition.scale ?? 1;
    const stretch = definition.stretch ?? {
      x: 1,
      y: 1,
      z: 1,
    };
    model.setLocalScale(scale * stretch.x, scale * stretch.y, scale * stretch.z);
    this.prepareModel(model, false);
    this.#visual.addChild(model);
    if (definition.weathering) {
      // Share immutable finishes; customized props explicitly clone their material.
      /**
       * @type {Map<import("playcanvas").Material, import("playcanvas").Material>}
       */
      const weatheredMaterials = new Map();
      for (const render of model.findComponents("render")) {
        for (const mesh of render.meshInstances) {
          const source = mesh.material;
          const existing = weatheredMaterials.get(source);
          if (existing) {
            mesh.material = existing;
            continue;
          }
          const wear = Math.min(1, Math.max(0, definition.weathering));
          const gloss = source.glossInvert
            ? Math.max(source.gloss, 0.8 + wear * 0.15)
            : Math.min(source.gloss, 0.2 - wear * 0.15);
          // Textured finishes only change roughness. Saturated roughness values
          // can be identical even when authored wear differs.
          const key = JSON.stringify([source.diffuseMap ? 0 : wear, gloss]);
          let finishes = AbstractCastleProp.#weatheredMaterials.get(source);
          if (!finishes) {
            finishes = new Map();
            AbstractCastleProp.#weatheredMaterials.set(source, finishes);
          }
          let entry = finishes.get(key);
          if (!entry) {
            const material = source.clone();
            if (material.diffuse && !material.diffuseMap) {
              material.diffuse.set(material.diffuse.r * (1 - wear * 0.48),
                material.diffuse.g * (1 - wear * 0.34), material.diffuse.b * (1 - wear * 0.18));
            }
            material.gloss = gloss;
            material.update();
            entry = {
              material,
              owners: 0,
            };
            finishes.set(key, entry);
          }
          entry.owners++;
          this.#releaseWeatheredMaterials.push(() => {
            if (--entry.owners === 0) {
              finishes.delete(key);
              entry.material.destroy();
            }
          });
          mesh.material = entry.material;
          weatheredMaterials.set(source, entry.material);
        }
      }
    }
    if (this.hasAuthoredCollision && !definition.collisionBox) {
      this.#collisionGraph = modelLibrary.instantiate(this.modelUrl);
      this.#collisionGraph.setLocalScale(scale * stretch.x, scale * stretch.y, scale * stretch.z);
      this.prepareModel(this.#collisionGraph, true);
    }
    // Subclasses may replace baked details with separately authored map objects.
    for (const name of this.constructor.omittedModelNodes ?? []) {
      model.findByName(name)?.destroy();
      this.#collisionGraph?.findByName(name)?.destroy();
    }
    if (this.#collisionGraph) {
      addAuthoredMeshPhysics(pc, this.#visual, this.#collisionGraph);
    }
  }

  /**
   * @returns {boolean}
   */
  get hasAuthoredCollision() {
    return this.constructor.hasAuthoredCollision;
  }

  get entity() {
    return this.#entity;
  }
  /**
   * Instance-selected model used by both rendering and collision.
   * @returns {string}
   */
  get modelUrl() {
    return this.constructor.modelUrl;
  }
  /**
   * Apply instance-specific authored part placement before creating its collider.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {}

  /**
   * @param {import("playcanvas").Material} material
   * @returns {import("playcanvas").Material}
   */
  cloneMaterial(material) {
    const clone = material.clone();
    this.#instanceMaterials.push(clone);

    return clone;
  }
  get definition() {
    return this.#definition;
  }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() {
    return [this.#visual];
  }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandRoots.setOffsets(near, far, offsets);
    this.#visual.rigidbody?.syncEntityToBody();
  }
  onSceneReady() {
    if (this.#renderBatch) {
      return;
    }
    const app = this.#pc.Application.getApplication();
    RigidModelBatch.merge(this.#pc, app, this.#visual.children[0]);
    // Batch after parenting and subclass material/part customization. Dynamic
    // batches retain the transforms used when islands move vertically.
    this.#renderBatch ??= new DynamicRenderBatch(
      app,
      this.#visual,
      this.#pc.BUFFER_STATIC,
    );
  }
  destroy() {
    this.#renderBatch?.destroy();
    this.#renderBatch = null;
    this.#entity.destroy();
    this.#collisionGraph?.destroy();
    for (const release of this.#releaseWeatheredMaterials) {
      release();
    }
    this.#releaseWeatheredMaterials = [];
    for (const material of this.#instanceMaterials) {
      material.destroy();
    }
  }
}
