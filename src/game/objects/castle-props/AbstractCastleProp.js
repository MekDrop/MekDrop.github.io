import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { addAuthoredMeshPhysics } from "../shared/AuthoredMeshPhysics.js";

/**
 * Lifecycle for imported static castle props with an authored bottom-center pivot.
 * @abstract
 */
export class AbstractCastleProp {
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
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} ${this.constructor.name}`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const { x, y, z } = definition.position;
    this.#visual.setLocalPosition(x, y, z);
    this.#visual.setLocalEulerAngles(0, definition.rotation ?? 0, 0);
    const model = modelLibrary.instantiate(this.constructor.modelUrl);
    const scale = definition.scale ?? 1;
    model.setLocalScale(scale, scale, scale);
    this.#visual.addChild(model);
    this.#collisionGraph = modelLibrary.instantiate(this.constructor.modelUrl);
    this.#collisionGraph.setLocalScale(scale, scale, scale);
    // Subclasses may replace baked details with separately authored map objects.
    for (const name of this.constructor.omittedModelNodes ?? []) {
      model.findByName(name)?.destroy();
      this.#collisionGraph.findByName(name)?.destroy();
    }
    addAuthoredMeshPhysics(pc, this.#visual, this.#collisionGraph);
  }

  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() { return [this.#visual]; }
  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    this.#islandRoots.setOffsets(near, far, offsets);
    this.#visual.rigidbody?.syncEntityToBody();
  }
  destroy() {
    this.#entity.destroy();
    this.#collisionGraph.destroy();
  }
}
