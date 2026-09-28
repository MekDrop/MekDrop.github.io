import bridgeRailingPostModelUrl from "../../models/bridge/bridge-railing-post.glb?url";
import bridgeRailingSegmentModelUrl from "../../models/bridge/bridge-railing-segment.glb?url";
import { SLOPE_DIRECTION } from "../../enum/SlopeDirection.js";

/**
 * @typedef {object} BridgeSpan
 * @property {boolean} horizontal
 * @property {number} center
 * @property {number} crossCenter
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} PathOverpass
 * @property {Array<{col: number, row: number, riseDirection: string, lowHeight: number, highHeight: number}>} slopeCells
 * @property {Array<{col: number, row: number}>} approachCells
 * @property {Array<{col: number, row: number}>} crossingCells
 * @property {{col: number, row: number, width: number}} crossing
 * @property {number} deckElevation
 */

/**
 * Builds flat bridge rails from reusable authored modules.
 */
export class BridgeRailingKit {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [bridgeRailingSegmentModelUrl, bridgeRailingPostModelUrl];
  }

  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
    * @type {Map<string, import("playcanvas").Material>}
   */
  #materials;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   *
    * @type {Map<string, Array<number>>}
   */
  #segmentMatrices = new Map();
  /**
   *
    * @type {Map<string, Array<number>>}
   */
  #postMatrices = new Map();

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, materials: Map<string, import("playcanvas").Material>, root: import("playcanvas").Entity}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {Map<string, import("playcanvas").Material>} options.materials
   * @param {import("playcanvas").Entity} options.root
   */
  constructor({ pc, modelLibrary, materials, root }) {

    this.#pc = pc;

    this.#modelLibrary = modelLibrary;

    this.#materials = materials;

    this.#root = root;
  }

  /**
   *
   * @param {BridgeSpan} span
   * @param {number} height
   * @param {string} material
   * @param {number} cols
   * @param {number} rows
   */
  addSpan(span, height, material, cols, rows) {
    const centerX =
      (span.horizontal ? span.center : span.crossCenter) - (cols - 1) / 2;
    const centerZ =
      (span.horizontal ? span.crossCenter : span.center) - (rows - 1) / 2;
    const postPositions = [span.start - 0.34, span.end + 0.34];
    for (let position = span.start + 0.5; position < span.end; position += 1) {
      postPositions.push(position);
    }
    const uniquePostPositions = [...new Set(postPositions)].sort(
      /**
       *
       * @param {number} left
       * @param {number} right
       */
      (left, right) => left - right,
    );

    for (const side of [-1, 1]) {
      const railX = span.horizontal ? centerX : centerX + side * 0.93;
      const railZ = span.horizontal ? centerZ + side * 0.93 : centerZ;
      for (let index = 1; index < uniquePostPositions.length; index += 1) {
        const segmentStart = uniquePostPositions[index - 1];
        const segmentEnd = uniquePostPositions[index];
        this.#addSegment(
          material,
          new this.#pc.Vec3(
            span.horizontal ? segmentStart - (cols - 1) / 2 : railX,
            height + 0.34,
            span.horizontal ? railZ : segmentStart - (rows - 1) / 2,
          ),
          new this.#pc.Vec3(
            span.horizontal ? segmentEnd - (cols - 1) / 2 : railX,
            height + 0.34,
            span.horizontal ? railZ : segmentEnd - (rows - 1) / 2,
          ),
        );
      }
      for (const position of uniquePostPositions) {
        this.#addPost(
          material,
          new this.#pc.Vec3(
            span.horizontal ? position - (cols - 1) / 2 : railX,
            height + 0.17,
            span.horizontal ? railZ : position - (rows - 1) / 2,
          ),
        );
      }
    }
  }

  /**
   *
   * @param {PathOverpass} overpass
   * @param {string} material
   * @param {number} cols
   * @param {number} rows
   */
  addOverpass(overpass, material, cols, rows) {
    const pathCells = [
      ...overpass.slopeCells,
      ...overpass.approachCells,
      ...overpass.crossingCells,
    ];
    const start = Math.min(...pathCells.map(/**
     *
     * @param {number} cell
     */
    (cell) => cell.row));
    const end = Math.max(...pathCells.map(/**
     *
     * @param {number} cell
     */
    (cell) => cell.row));
    const postPositions = [start - 0.34, end + 0.34];
    for (let position = start + 0.5; position < end; position += 1) {
      postPositions.push(position);
    }
    postPositions.sort(/**
     *
     * @param {number} left
     * @param {number} right
     */
    (left, right) => left - right);

    const centerX =
      overpass.crossing.col +
      (overpass.crossing.width - 1) / 2 -
      (cols - 1) / 2;
    for (const side of [-1, 1]) {
      const railX = centerX + side * 0.93;
      for (let index = 1; index < postPositions.length; index += 1) {
        const segmentStart = postPositions[index - 1];
        const segmentEnd = postPositions[index];
        this.#addSegment(
          material,
          new this.#pc.Vec3(
            railX,
            this.#overpassHeightAt(overpass, segmentStart) + 0.34,
            segmentStart - (rows - 1) / 2,
          ),
          new this.#pc.Vec3(
            railX,
            this.#overpassHeightAt(overpass, segmentEnd) + 0.34,
            segmentEnd - (rows - 1) / 2,
          ),
        );
      }
      for (const position of postPositions) {
        this.#addPost(
          material,
          new this.#pc.Vec3(
            railX,
            this.#overpassHeightAt(overpass, position) + 0.17,
            position - (rows - 1) / 2,
          ),
        );
      }
    }
  }

  build() {
    return [
      ...this.#buildModelBatches(
        bridgeRailingSegmentModelUrl,
        this.#segmentMatrices,
        "Bridge railing segments",
      ),
      ...this.#buildModelBatches(
        bridgeRailingPostModelUrl,
        this.#postMatrices,
        "Bridge railing posts",
      ),
    ];
  }

  /**
   *
   * @param {string} material
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   */
  #addSegment(material, start, end) {
    const direction = new this.#pc.Vec3().sub2(end, start);
    const fullLength = direction.length();
    const runsAcrossX = Math.abs(direction.x) > Math.abs(direction.z);
    const pitch = runsAcrossX
      ? 0
      : (-Math.atan2(direction.y, direction.z) * 180) / Math.PI;
    const rotation = new this.#pc.Quat().setFromEulerAngles(
      pitch,
      runsAcrossX ? 90 : 0,
      0,
    );
    const position = new this.#pc.Vec3().lerp(start, end, 0.5);
    this.#addMatrix(
      this.#segmentMatrices,
      material,
      position,
      rotation,
      new this.#pc.Vec3(1, 1, Math.max(0.01, fullLength - 0.124)),
    );
  }

  /**
   *
   * @param {string} material
   * @param {{x: number, y: number, z: number}} position
   */
  #addPost(material, position) {
    this.#addMatrix(
      this.#postMatrices,
      material,
      position,
      this.#pc.Quat.IDENTITY,
      this.#pc.Vec3.ONE,
    );
  }

  /**
   *
   * @param {Map<string, Array<number>>} batches
   * @param {string} material
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Quat} rotation
   * @param {import("playcanvas").Vec3} scale
   */
  #addMatrix(batches, material, position, rotation, scale) {
    const matrix = new this.#pc.Mat4();
    matrix.setTRS(position, rotation, scale);
    const matrices = batches.get(material) ?? [];
    for (const value of matrix.data) {
      matrices.push(value);
    }
    batches.set(material, matrices);
  }

  /**
   *
   * @param {PathOverpass} overpass
   * @param {number} position
   */
  #overpassHeightAt(overpass, position) {
    for (const slope of overpass.slopeCells) {
      if (position < slope.row - 0.5 || position > slope.row + 0.5) {
        continue;
      }
      const localPosition = position - slope.row + 0.5;
      const progress =
        slope.riseDirection === SLOPE_DIRECTION.NORTH
          ? 1 - localPosition
          : localPosition;
      return (
        slope.lowHeight +
        (slope.highHeight - slope.lowHeight) * progress
      );
    }
    return overpass.deckElevation;
  }

  /**
   *
   * @param {string} modelUrl
   * @param {Map<string, Array<number>>} batches
   * @param {string} name
   */
  #buildModelBatches(modelUrl, batches, name) {
    const vertexBuffers = [];
    for (const [materialName, matrices] of batches.entries()) {
      const batch = this.#modelLibrary.instantiateMergedBatch(
        modelUrl,
        matrices,
        {
          name: `${name} (${materialName})`,
          material: this.#materials.get(materialName),
          dynamic: true,
        },
      );
      if (!batch) {
        continue;
      }
      this.#root.addChild(batch.entity);
      vertexBuffers.push(batch.vertexBuffer);
    }
    return vertexBuffers;
  }
}
