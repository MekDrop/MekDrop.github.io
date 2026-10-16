import { DynamicRenderBatch } from "../../../rendering/DynamicRenderBatch.js";
import royalBedroomUrl from "../../../models/castle/props/royal-bedroom-painting.glb?url";
import vestibuleUrl from "../../../models/castle/props/vestibule-painting.glb?url";
import { addAuthoredMeshPhysics } from "../../shared/AuthoredMeshPhysics.js";
import paintingUrl from "../../../models/castle/residential/framed-map.glb?url";
import { IslandObjectRoots } from "../../shared/IslandObjectRoots.js";

/**
 * Thin framed artwork positioned at its bottom-center, with local +Z facing out.
 */
export class Painting {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity|undefined}
   */
  #collisionGraph;
  /**
   * @type {DynamicRenderBatch|null}
   */
  #renderBatch = null;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("../../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [paintingUrl, royalBedroomUrl, vestibuleUrl];
  }

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../../ObjectTypes.js").MapObjectDefinition, runtime?: import("../../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    this.#pc = pc;
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} painting`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const { x, y, z } = definition.position;
    this.#visual.setLocalPosition(x, y, z);
    this.#visual.setLocalEulerAngles(definition.tilt?.x ?? 0, definition.rotation ?? 0, definition.tilt?.z ?? 0);
    const modelUrl = definition.variant === "royal-bedroom" ? royalBedroomUrl :
      definition.variant === "vestibule" ? vestibuleUrl : paintingUrl;
    const model = modelLibrary.instantiate(modelUrl);
    // Compress only authored depth: the raised frame retains its relief.
    const scale = definition.scale ?? 1;
    const stretch = definition.stretch ?? {
      x: 1,
      y: 1,
      z: 1,
    };
    const authored = modelUrl !== paintingUrl;
    const xScale = scale * stretch.x * (definition.width ?? 1);
    const yScale = scale * stretch.y * (definition.height ?? 1);
    const zScale = scale * stretch.z * (authored ? 1 : 0.1);
    model.setLocalScale(xScale, yScale, zScale);
    if (authored && !definition.collisionBox) {
      this.#collisionGraph = modelLibrary.instantiate(modelUrl);
      this.#collisionGraph.setLocalScale(xScale, yScale, zScale);
      addAuthoredMeshPhysics(pc, this.#visual, this.#collisionGraph);
    }
    this.#visual.addChild(model);
  }

  get entity() {
    return this.#entity;
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
    if (this.#collisionGraph) {
      this.#renderBatch ??= new DynamicRenderBatch(
        this.#pc.Application.getApplication(), this.#visual, this.#pc.BUFFER_STATIC,
      );
    }
  }
  destroy() {
    this.#renderBatch?.destroy();
    this.#entity.destroy();
    this.#collisionGraph?.destroy();
  }

}
