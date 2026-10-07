import crownUrl from "../../models/vegetation/cliff-vine-crown.glb?url";
import leafUrl from "../../models/vegetation/cliff-vine-leaf.glb?url";
import stemUrl from "../../models/vegetation/cliff-vine-stem.glb?url";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
import { createCliffVineLayout } from "./CliffVineLayout.js";
import { createCliffVineGrowth } from "./CliffVineGrowth.js";

/**
 * A cliff-owned ivy patch with height-dependent stems and undistorted leaves.
 */
export class CliffVine {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {Array<{buffer: import("playcanvas").VertexBuffer, matrices: Float32Array, heights: number[]}>}
   */
  #batches = [];
  /**
   * @type {number}
   */
  #group;
  /**
   * @type {import("playcanvas").Material[]}
   */
  #materials = [];
  /**
   * @type {number}
   */
  #offset = 0;

  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [crownUrl, leafUrl, stemUrl]; }

  /**
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    const objects = mapData.objects ??= [];
    for (const [index, face] of createCliffVineLayout(mapData).entries()) {
      const id = `cliff-vine-${index}`;
      const existing = objects.find(/**
                        * @param {import("../ObjectTypes.js").MapObjectDefinition} item
                        */ (item) => item.id === id);
      if (existing) {
        if (existing.generated) {
          existing.height = face.topY - face.bottomY;
          existing.position = { x: face.x, y: face.y, z: face.z };
        }
        continue;
      }
      objects.push({ id, object: CliffVine.name, tile: { col: face.col, row: face.row },
        position: { x: face.x, y: face.y, z: face.z }, rotation: face.yaw,
        height: face.topY - face.bottomY, seed: `${mapData.mapName}:${face.col}:${face.row}:${face.yaw}`, generated: true });
    }
  }

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(definition.id);
    this.#group = new IslandCellOwnership(runtime.mapData).groups.findIndex(
      /**
       * @param {Set<string>} cells
       */ (cells) => cells.has(`${definition.tile.col},${definition.tile.row}`));
    const growth = createCliffVineGrowth({ height: definition.height, seed: definition.seed });
    const yaw = new pc.Quat().setFromEulerAngles(0, definition.rotation, 0);
    const origin = new pc.Vec3(definition.position.x, definition.position.y, definition.position.z);
    const leafMatrices = [[], [], []];
    const stemMatrices = [];
    const crownMatrices = [];
    /**
     * @param {number[]} matrices
     * @param {{x: number, y: number, z: number}} point
     * @param {import("playcanvas").Quat} rotation
     * @param {import("playcanvas").Vec3} scale
     */
    const append = (matrices, point, rotation, scale) => {
      const position = yaw.transformVector(new pc.Vec3(point.x, point.y, point.z)).add(origin);
      const worldRotation = yaw.clone().mul(rotation);
      matrices.push(...new pc.Mat4().setTRS(position, worldRotation, scale).data);
    };
    append(crownMatrices, { x: 0, y: 0, z: 0 }, pc.Quat.IDENTITY, new pc.Vec3(growth.crownScale, growth.crownScale, growth.crownScale));
    for (const leaf of growth.leaves) {
      append(leafMatrices[leaf.shade], leaf, new pc.Quat().setFromEulerAngles(leaf.pitch, leaf.yaw, leaf.roll), new pc.Vec3(leaf.scale, leaf.scale, leaf.scale));
    }
    for (const { start, end } of growth.stems) {
      const delta = new pc.Vec3(end.x - start.x, end.y - start.y, end.z - start.z);
      const length = delta.length();
      delta.normalize();
      const rotation = new pc.Quat(-delta.z, 0, delta.x, 1 - delta.y).normalize();
      append(stemMatrices, start, rotation, new pc.Vec3(1, length, 1));
    }
    for (const [url, matrices, shade] of [[crownUrl, crownMatrices], [leafUrl, leafMatrices[0], 0], [leafUrl, leafMatrices[1], 1], [leafUrl, leafMatrices[2], 2], [stemUrl, stemMatrices]]) {
      const batch = modelLibrary.instantiateMergedBatch(url, matrices, { dynamic: true, linearVertexColors: true, name: `${definition.id} growth` });
      if (!batch) continue;
      if (shade !== undefined) {
        const tint = [[0.68, 0.86, 0.62], [0.88, 0.98, 0.8], [1, 1, 0.95]][shade];
        for (const instance of batch.entity.render?.meshInstances ?? []) {
          const material = instance.material.clone();
          material.diffuse = new pc.Color(...tint);
          material.update();
          instance.material = material;
          this.#materials.push(material);
        }
      }
      this.#entity.addChild(batch.entity);
      const values = new Float32Array(matrices);
      const heights = Array.from({ length: matrices.length / 16 }, /**
                                                                    * @param {number} unused
                                                                    * @param {number} index
                                                                    */ (unused, index) => values[index * 16 + 13]);
      this.#batches.push({ buffer: batch.vertexBuffer, matrices: values, heights });
    }
  }

  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() { return []; }
  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    const offset = [near, far][this.#group] ?? 0;
    if (offset === this.#offset) {
      return;
    }
    this.#offset = offset;
    for (const batch of this.#batches) {
      for (let index = 0; index < batch.heights.length; index++) batch.matrices[index * 16 + 13] = batch.heights[index] + offset;
      batch.buffer.setData(batch.matrices);
    }
  }
  destroy() {
    this.#entity.destroy();
    for (const batch of this.#batches) batch.buffer.destroy();
    for (const material of this.#materials) material.destroy();
  }
}
