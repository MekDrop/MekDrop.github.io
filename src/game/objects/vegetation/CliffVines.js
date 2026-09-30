import cliffVineModelUrl from "../../models/vegetation/cliff-vine.glb?url";
import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
import { createCliffVineLayout } from "./CliffVineLayout.js";

/**
 * Repeated authored vine modules fitted to generated exposed cliff faces.
 */
export class CliffVines {
  /**
   *
    * @type {Array<string>}
   */
  static modelUrls = [cliffVineModelUrl];

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #vertexBuffer = null;
  /**
   * @type {Float32Array}
   */
  #matrices;
  /**
   * @type {Array<{group: number, y: number}>}
   */
  #moduleOffsets = [];
  /**
   * @type {number[]}
   */
  #offsets = [0, 0];

  /**
   *
   * @param {{pc: typeof import("playcanvas"), mapData: import("src/game/objects/ObjectTypes.js").GameMapData, modelLibrary: string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {string} options.modelLibrary
   */
  constructor({ pc, mapData, modelLibrary }) {
    this.#entity = new pc.Entity("Cliff vines");
    const matrices = [];
    const groups = new IslandCellOwnership(mapData).groups;
    const position = new pc.Vec3();
    const rotation = new pc.Quat();
    const scale = new pc.Vec3();
    const matrix = new pc.Mat4();
    for (const module of createCliffVineLayout(mapData)) {
      position.set(module.x, module.y, module.z);
      rotation.setFromEulerAngles(0, module.yaw, 0);
      scale.set(module.scaleX, module.scaleY, module.scaleZ);
      matrix.setTRS(position, rotation, scale);
      matrices.push(...matrix.data);
      this.#moduleOffsets.push({
        group: groups.findIndex(
          /**
           * @param {Set<string>} cells
           */
          (cells) => cells.has(`${module.col},${module.row}`),
        ),
        y: module.y,
      });
    }
    if (!matrices.length) {
      return;
    }
    this.#matrices = new Float32Array(matrices);
    const batch = modelLibrary.instantiateMergedBatch(
      cliffVineModelUrl,
      matrices,
      { name: "Instanced cliff vine modules", dynamic: true },
    );
    if (batch) {
      this.#vertexBuffer = batch.vertexBuffer;
      this.#entity.addChild(batch.entity);
    }
  }

  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) {
    if (!this.#vertexBuffer || (near === this.#offsets[0] && far === this.#offsets[1])) {
      return;
    }
    this.#offsets = [near, far];
    for (const [index, { group, y }] of this.#moduleOffsets.entries()) {
      this.#matrices[index * 16 + 13] = y + (this.#offsets[group] ?? 0);
    }
    // Instancing matrices are world transforms, so parent motion alone is insufficient.
    this.#vertexBuffer.setData(this.#matrices);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#vertexBuffer?.destroy();
    this.#vertexBuffer = null;
  }
}
