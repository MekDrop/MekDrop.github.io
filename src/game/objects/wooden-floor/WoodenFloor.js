import { InvalidWoodenFloorAreaError } from "../../errors/wooden-floor/index.js";
import floorUrl from "../../models/castle/residential/floor-panel.glb?url";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";
import { addGeneratedVoxelPhysics } from "../shared/GeneratedVoxelPhysics.js";

/**
 * Timber finish covering the rectangle between two level map corners.
 */
export class WoodenFloor {
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
   * @returns {string[]}
   */
  static get modelUrls() { return [floorUrl]; }

  /**
   * Returns the shared bottom-anchored, one-metre-square, 0.06-metre-thick panel.
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {boolean} thinFinish Keep backing clear of parquet in a compressed surface finish.
   * @param {number} width
   * @param {number} depth
   * @returns {import("playcanvas").Entity}
   */
  static createPanel(models, thinFinish = false, width = 1, depth = 1) {
    const panel = models.instantiate(floorUrl);
    for (const render of panel.findComponents("render")) {
      if (!render.entity?.name.startsWith("Oak plank")) { continue; }
      const mesh = render.meshInstances[0]?.mesh;
      if (!mesh?.getPositions) { continue; }
      const vertices = [];
      mesh.getPositions(vertices);
      const topY = mesh.aabb.center.y + mesh.aabb.halfExtents.y;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let index = 0; index < vertices.length; index += 3) {
        if (vertices[index + 1] < topY - 1e-5) { continue; }
        minX = Math.min(minX, vertices[index]); maxX = Math.max(maxX, vertices[index]);
        minZ = Math.min(minZ, vertices[index + 2]); maxZ = Math.max(maxZ, vertices[index + 2]);
      }
      // Keep the visible top seams six millimetres wide after the room stretches the panel.
      const nominalX = mesh.aabb.halfExtents.x * 2 + 0.003;
      const nominalZ = 0.125;
      render.entity.setLocalScale((nominalX - Math.min(0.006 / width, nominalX * 0.15)) / (maxX - minX), 1,
        (nominalZ - Math.min(0.006 / depth, nominalZ * 0.15)) / (maxZ - minZ));
    }
    if (thinFinish) {
      const backing = panel.findByName("Tile backing");
      backing.setLocalPosition(0, 0.003, 0);
      backing.setLocalScale(1, 0.1, 1);
    }
    return panel;
  }

  /**
   * Corner Y is the walking surface; the timber extends below it.
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    const { from, to } = definition;
    if (!from || !to || ![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite) ||
      from.y !== to.y || from.x === to.x || from.z === to.z) {
      throw new InvalidWoodenFloorAreaError(definition.id);
    }
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = WoodenFloor.createPanel(modelLibrary, false, Math.abs(to.x - from.x), Math.abs(to.z - from.z));
    this.#visual.name = `${definition.id} wooden floor`;
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    const width = Math.abs(to.x - from.x);
    const depth = Math.abs(to.z - from.z);
    const x = (from.x + to.x) / 2;
    const z = (from.z + to.z) / 2;
    this.#visual.setLocalPosition(x, from.y - 0.06, z);
    this.#visual.setLocalScale(width, 1, depth);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    const support = new pc.Entity(`${definition.id} support`);
    this.#islandRoots.addChild(support, definition.tile);
    addGeneratedVoxelPhysics({
      pc,
      parent: support,
      name: definition.id,
      voxels: [{
        x,
        y: from.y - 0.03,
        z,
        width,
        height: 0.06,
        depth,
      }],
      friction: 0.6,
    });
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
  setIslandOffsets(near, far, offsets = [near, far]) { this.#islandRoots.setOffsets(near, far, offsets); }
  destroy() { this.#entity.destroy(); }
}
