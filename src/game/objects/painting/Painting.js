import { DynamicRenderBatch } from "../../rendering/DynamicRenderBatch.js";
import royalBedroomUrl from "../../models/castle/props/royal-bedroom-painting.glb?url";
import vestibuleUrl from "../../models/castle/props/vestibule-painting.glb?url";
import { addAuthoredMeshPhysics } from "../shared/AuthoredMeshPhysics.js";
import paintingUrl from "../../models/castle/residential/framed-map.glb?url";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { CastleResidentialLayout } from "../castle/CastleResidentialLayout.js";
import { findCastleMapMount } from "../castle/CastleResidence.js";

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
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [paintingUrl, royalBedroomUrl, vestibuleUrl]; }

  /**
   * Extract legacy castle artwork into ordinary map objects, preserving authored overrides.
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const castle of [...objects]) {
      if (castle.object !== "Castle" || !castle.buildPlan?.input?.position ||
        castle.buildPlan.metadata.runtime.residential?.version === 2) continue;
      const id = `${castle.id}-painting`;
      if (objects.some(/**
       * @param {import("../ObjectTypes.js").MapObjectDefinition} item
       */ (item) => item.id === id)) continue;
      const layout = new CastleResidentialLayout(castle.buildPlan);
      const work = layout.rooms.work;
      const desk = layout.reservations.find(/**
       * @param {{role: string}} item
       */ (item) => item.role === "workDesk");
      if (!desk) continue;
      const side = (desk.minX + desk.maxX) / 2 > (work.minX + work.maxX) / 2 ? 1 : -1;
      const mount = findCastleMapMount(castle.buildPlan, layout, side,
        work.minZ + (work.maxZ - work.minZ) * 0.45);
      if (!mount) continue;
      const position = layout.toWorld(mount.x, mount.z, work.floorY - layout.origin.y + 0.85);
      objects.push({ id, object: Painting.name, position, rotation: layout.yaw + mount.yaw,
        width: 0.8, height: 0.8, tile: castle.tile });
    }
  }

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
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
    const stretch = definition.stretch ?? { x: 1, y: 1, z: 1 };
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
