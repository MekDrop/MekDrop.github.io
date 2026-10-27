import { IslandCellOwnership } from "../shared/IslandCellOwnership.js";
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
 * @property {number} length
 * @property {Array<{col: number, row: number}>} cells
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
 * Assembles bridge railings from reusable authored timber modules.
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
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {Set<string>[]|null}
   */
  #islandCells = null;
  /**
   * @type {import("playcanvas").Entity[]|null}
   */
  #islandRoots = null;
  /**
   * @type {number}
   */
  #currentGroup = -1;
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
   * @type {Set<string>}
   */
  #postKeys = new Set();

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, root: import("playcanvas").Entity, mapData?: import("src/game/GameContracts.js").GameMapData}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("playcanvas").Entity} options.root
   * @param {import("src/game/GameContracts.js").GameMapData} [options.mapData]
   */
  constructor({ pc, modelLibrary, root, mapData = null }) {

    this.#pc = pc;

    this.#modelLibrary = modelLibrary;

    this.#root = root;
    if (mapData?.islandConnectorData) {
      this.#islandCells = new IslandCellOwnership(mapData).groups;
      this.#islandRoots = this.#islandCells.map(/**
       *
       * @param {Set<string>} cells
       * @param {number} index
       */
        (cells, index) => new pc.Entity(`Island ${index} bridge railings`));
      for (const islandRoot of this.#islandRoots) {
        root.addChild(islandRoot);
      }
    }
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
    this.#currentGroup = this.#groupForCell(
      span.horizontal ? span.start : span.crossCenter - 0.5,
      span.horizontal ? span.crossCenter - 0.5 : span.start,
    );
    const centerX =
      (span.horizontal ? span.center : span.crossCenter) - (cols - 1) / 2;
    const centerZ =
      (span.horizontal ? span.crossCenter : span.center) - (rows - 1) / 2;
    const postPositions = [span.start - 0.34, span.end + 0.34];
    const uniquePostPositions = [...new Set(postPositions)].sort(
      BridgeRailingKit.#sortLeft,
    );

    this.#addSpanSide(
      span,
      centerX,
      centerZ,
      uniquePostPositions,
      material,
      cols,
      height,
      rows,
      -1,
    );
    this.#addSpanSide(
      span,
      centerX,
      centerZ,
      uniquePostPositions,
      material,
      cols,
      height,
      rows,
      1,
    );
  }

  /**
   *
   * @param {PathOverpass} overpass
   * @param {string} material
   * @param {number} cols
   * @param {number} rows
   */
  addOverpass(overpass, material, cols, rows) {
    this.#currentGroup = this.#groupForCell(
      overpass.crossing.col,
      overpass.crossing.row,
    );
    const pathCells = [
      ...overpass.slopeCells,
      ...overpass.approachCells,
      ...overpass.crossingCells,
    ];
    const start = Math.min(...pathCells.map(BridgeRailingKit.#mapCell));
    const end = Math.max(...pathCells.map(BridgeRailingKit.#mapCell2));
    const postPositions = [start - 0.34, end + 0.34];
    for (let position = start + 0.5; position < end; position += 1) {
      postPositions.push(position);
    }
    postPositions.sort(BridgeRailingKit.#sortLeft2);

    const centerX =
      overpass.crossing.col +
      (overpass.crossing.width - 1) / 2 -
      (cols - 1) / 2;
    this.#addOverpassSide(
      centerX,
      postPositions,
      material,
      overpass,
      rows,
      -1,
    );
    this.#addOverpassSide(
      centerX,
      postPositions,
      material,
      overpass,
      rows,
      1,
    );
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
   * Assemble a timber railing from its deck-level start and world-space direction.
   * Length follows the direction, including any slope. Bays divide the run evenly.
   *
   * @param {{position: import("playcanvas").Vec3, length: number, direction: import("playcanvas").Vec3, postSpacing?: number, material?: string}} options
   * @param {import("playcanvas").Vec3} options.position
   * @param {number} options.length
   * @param {import("playcanvas").Vec3} options.direction
   * @param {number} [options.postSpacing]
   * @param {string} [options.material]
   * @param {boolean} [options.endPost] Leave a shared joint post attached to the next deck section.
   */
  addRailing({ position, length, direction, postSpacing = 1, material = "wood", endPost = true }) {
    const directionLength = direction.length();
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(postSpacing) || postSpacing <= 0 || !Number.isFinite(directionLength) || directionLength <= 0) {
      return;
    }
    const step = direction.clone().mulScalar(length / directionLength);
    const bays = Math.max(1, Math.ceil(length / postSpacing));
    let previous;
    for (let index = 0; index <= bays; index += 1) {
      const base = position.clone().add(step.clone().mulScalar(index / bays));
      if (index < bays || endPost) {
        this.#addPost(material, new this.#pc.Vec3(base.x, base.y + 0.17, base.z));
      }
      const rail = new this.#pc.Vec3(base.x, base.y + 0.34, base.z);
      if (previous) {
        this.#addSegment(material, previous, rail);
      }
      previous = rail;
    }
  }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    for (const [index, root] of (this.#islandRoots ?? []).entries()) {
      root.setLocalPosition(0, offsets[index] ?? 0, 0);
    }
  }

  /**
   * @param {number} col
   * @param {number} row
   */
  #groupForCell(col, row) {
    const key = `${col},${row}`;

    return this.#islandCells?.findIndex(/**
     * @param {Set<string>} cells
     */
      (cells) => cells.has(key)) ?? -1;
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
    const pitch = (-Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * 180) / Math.PI;
    const rotation = new this.#pc.Quat().setFromEulerAngles(
      pitch,
      (Math.atan2(direction.x, direction.z) * 180) / Math.PI,
      0,
    );
    const position = new this.#pc.Vec3().lerp(start, end, 0.5);
    this.#addMatrix(
      this.#segmentMatrices,
      material,
      position,
      rotation,
      // Meet over the post centerline so adjoining handrails read continuously.
      // A tiny inset avoids coincident end faces between adjacent modules.
      new this.#pc.Vec3(1, 1, Math.max(0.01, fullLength - 0.004)),
    );
  }

  /**
   *
   * @param {string} material
   * @param {{x: number, y: number, z: number}} position
   */
  #addPost(material, position) {
    const key = `${this.#currentGroup}|${material}|${position.x.toFixed(6)},${position.y.toFixed(6)},${position.z.toFixed(6)}`;
    if (this.#postKeys.has(key)) {
      return;
    }
    this.#postKeys.add(key);
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
    const batchKey = `${this.#currentGroup}|${material}`;
    const matrices = batches.get(batchKey) ?? [];
    for (const value of matrix.data) {
      matrices.push(value);
    }
    batches.set(batchKey, matrices);
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
    if (!batches.size) {
      return vertexBuffers;
    }
    const source = this.#modelLibrary.instantiate(modelUrl);
    const timberMaterial = source.findComponents("render")[0].meshInstances[0].material;
    source.destroy();
    for (const [batchKey, matrices] of batches.entries()) {
      const [group, materialName] = batchKey.split("|");
      const batch = this.#modelLibrary.instantiateMergedBatch(
        modelUrl,
        matrices,
        {
          name: `${name} (${materialName})`,
          material: timberMaterial,
          dynamic: true,
        },
      );
      if (!batch) {
        continue;
      }
      (this.#islandRoots?.[Number(group)] ?? this.#root).addChild(batch.entity);
      vertexBuffers.push(batch.vertexBuffer);
    }

    return vertexBuffers;
  }

  /**
   *
   * @param {number} left
   * @param {number} right
   */
  static #sortLeft(left, right) {
    return left - right;
  }

  /**
   *
   * @param {number} cell
   */
  static #mapCell(cell) {
    return cell.row;
  }

  /**
   *
   * @param {number} cell
   */
  static #mapCell2(cell) {
    return cell.row;
  }

  /**
   *
   * @param {number} left
   * @param {number} right
   */
  static #sortLeft2(left, right) {
    return left - right;
  }

  /**
   * @param {BridgeSpan} span
   * @param {number} centerX
   * @param {number} centerZ
   * @param {number[]} uniquePostPositions
   * @param {string} material
   * @param {number} cols
   * @param {number} height
   * @param {number} rows
   * @param {number} side
   */
  #addSpanSide(
    span,
    centerX,
    centerZ,
    uniquePostPositions,
    material,
    cols,
    height,
    rows,
    side,
  ) {
    const railX = span.horizontal ? centerX : centerX + side * 0.93;
    const railZ = span.horizontal ? centerZ + side * 0.93 : centerZ;
    const start = uniquePostPositions[0];
    const end = uniquePostPositions.at(-1);
    this.addRailing({
      position: new this.#pc.Vec3(
        span.horizontal ? start - (cols - 1) / 2 : railX,
        height,
        span.horizontal ? railZ : start - (rows - 1) / 2,
      ),
      length: end - start,
      direction: new this.#pc.Vec3(span.horizontal ? 1 : 0, 0, span.horizontal ? 0 : 1),
      material,
    });
  }

  /**
   * @param {number} centerX
   * @param {number[]} postPositions
   * @param {string} material
   * @param {PathOverpass} overpass
   * @param {number} rows
   * @param {number} side
   */
  #addOverpassSide(
    centerX,
    postPositions,
    material,
    overpass,
    rows,
    side,
  ) {
    const railX = centerX + side * 0.93;
    for (let index = 1; index < postPositions.length; index += 1) {
      const segmentStart = postPositions[index - 1];
      const segmentEnd = postPositions[index];
      const start = new this.#pc.Vec3(
        railX,
        this.#overpassHeightAt(overpass, segmentStart),
        segmentStart - (rows - 1) / 2,
      );
      const end = new this.#pc.Vec3(
        railX,
        this.#overpassHeightAt(overpass, segmentEnd),
        segmentEnd - (rows - 1) / 2,
      );
      const direction = end.sub(start);
      this.addRailing({
        position: start,
        length: direction.length(),
        direction,
        material,
      });
    }
  }
}
