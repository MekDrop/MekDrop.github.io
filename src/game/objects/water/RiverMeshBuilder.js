import { RIVER_KIND } from '../../enum/RiverKind.js';
import { RiverSurfaceHeights } from './RiverSurfaceHeights.js';
import { WaterfallGeometry } from './WaterfallGeometry.js';

/**
 * @typedef {object} RiverGeometryGroup
 * @property {Array<number>} positions
 * @property {Array<number>} normals
 * @property {Array<number>} colors
 * @property {Array<number>} uvs
 * @property {Array<number>} uvs1
 * @property {Array<number>} sourceUvs
 * @property {Array<number>} indices
 * @property {Map<string, number>} weldedVertices
 */

export class RiverMeshBuilder {
  /**
   *
    * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
    * @type {import("playcanvas").GraphicsDevice}
   */
  #device;
  /**
   *
    * @type {import("src/game/objects/ObjectTypes.js").GameMapData}
   */
  #mapData;
  /**
   *
    * @type {number}
   */
  #riverKind;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {Array<import("playcanvas").Mesh>}
   */
  #meshes = [];

  /**
   *
   * @param {{pc: typeof import("playcanvas"), device: import("playcanvas").GraphicsDevice, mapData: import("src/game/objects/ObjectTypes.js").GameMapData, riverKind: number, entity: import("playcanvas").Entity}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").GraphicsDevice} options.device
   * @param {import("src/game/objects/ObjectTypes.js").GameMapData} options.mapData
   * @param {number} options.riverKind
   * @param {import("playcanvas").Entity} options.entity
   */
  constructor({ pc, device, mapData, riverKind, entity }) {

    this.#pc = pc;

    this.#device = device;

    this.#mapData = mapData;

    this.#riverKind = riverKind;

    this.#entity = entity;
  }

  /**
   *
   * @param {{createSourceProfile: (cells: Array<import("src/game/objects/ObjectTypes.js").RiverCell>) => RiverSourceProfile, isSpringSource: (cellIndex: number, cascadeLanding: boolean) => boolean, surfaceCorners: (heights: RiverSurfaceHeights, cell: import("src/game/objects/ObjectTypes.js").RiverCell) => Array<number>, appendCascade: (options: {group: RiverGeometryGroup, cascade: import("src/game/objects/ObjectTypes.js").RiverCascade, cols: number, rows: number, routeDistance: number, join: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}) => void, appendTerminal: (options: {riverGroup: RiverGeometryGroup, terminalGroup: RiverGeometryGroup, waterfall: import("src/game/objects/ObjectTypes.js").WaterfallDefinition, cols: number, rows: number, routeDistance: number, join: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}) => void, createMaterial: (terminal: boolean) => import("playcanvas").Material}} options
   * @param {(cells: Array<import("src/game/objects/ObjectTypes.js").RiverCell>) => RiverSourceProfile} options.createSourceProfile
   * @param {(cellIndex: number, cascadeLanding: boolean) => boolean} options.isSpringSource
   * @param {(heights: RiverSurfaceHeights, cell: import("src/game/objects/ObjectTypes.js").RiverCell) => Array<number>} options.surfaceCorners
   * @param {(options: {group: RiverGeometryGroup, cascade: import("src/game/objects/ObjectTypes.js").RiverCascade, cols: number, rows: number, routeDistance: number, join: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}) => void} options.appendCascade
   * @param {(options: {riverGroup: RiverGeometryGroup, terminalGroup: RiverGeometryGroup, waterfall: import("src/game/objects/ObjectTypes.js").WaterfallDefinition, cols: number, rows: number, routeDistance: number, join: import("src/game/objects/ObjectTypes.js").WaterfallJoin|null}) => void} options.appendTerminal
   * @param {(terminal: boolean) => import("playcanvas").Material} options.createMaterial
   */
  build({
    createSourceProfile,
    isSpringSource,
    surfaceCorners,
    appendCascade,
    appendTerminal,
    createMaterial,
  }) {
    const groups = new Map();
    const { cols, rows, riverData = [] } = this.#mapData;
    const rivers = riverData.filter(
      /**
       *
       * @param {number} river
       */
      (river) => (river.kind ?? RIVER_KIND.WATER) === this.#riverKind,
    );
    for (const [riverIndex, river] of rivers.entries()) {
      const riverGroup = this.#group(
        groups,
        `river|${river.id ?? riverIndex}`,
      );
      const terminalGroup = this.#group(
        groups,
        `terminal|${river.id ?? riverIndex}`,
      );
      const surfaceHeights = new RiverSurfaceHeights(river.cells);
      const sourceProfile = createSourceProfile(river.cells);
      const riverCellKeys = new Set(
        river.cells.map(/**
         *
         * @param {number} cell
         */
        (cell) => `${cell.col},${cell.row}`),
      );
      const spillDirections = new Map(
        river.cascades.map(/**
         *
         * @param {number} cascade
         */
        (cascade) => [
          `${cascade.from.col},${cascade.from.row}`,
          cascade.direction,
        ]),
      );
      spillDirections.set(
        `${river.waterfall.col},${river.waterfall.row}`,
        river.waterfall.direction,
      );
      const spillJoins = new Map();
      for (const [cellIndex, cell] of river.cells.entries()) {
        const cellKey = `${cell.col},${cell.row}`;
        const spillDirection = spillDirections.get(cellKey) ?? null;
        const cascadeLanding = river.cascades.some(
          /**
           *
           * @param {number} cascade
           */
          (cascade) => cascade.to.col === cell.col && cascade.to.row === cell.row,
        );
        const spillJoin = this.#addWaterVolume(
          riverGroup,
          cell,
          cols,
          rows,
          spillDirection,
          riverCellKeys,
          isSpringSource(cellIndex, cascadeLanding),
          river.cells[cellIndex - 1]?.direction ?? cell.direction,
          cellIndex,
          surfaceCorners(surfaceHeights, cell),
          sourceProfile,
        );
        if (spillJoin) {
          spillJoins.set(cellKey, spillJoin);
        }
      }
      for (const cascade of river.cascades) {
        appendCascade({
          group: riverGroup,
          cascade,
          cols,
          rows,
          routeDistance: river.cells.findIndex(
            /**
             *
             * @param {number} cell
             */
            (cell) => cell.col === cascade.from.col && cell.row === cascade.from.row,
          ) + 1,
          join: spillJoins.get(`${cascade.from.col},${cascade.from.row}`),
        });
      }
      appendTerminal({
        riverGroup,
        terminalGroup,
        waterfall: river.waterfall,
        cols,
        rows,
        routeDistance: river.cells.length,
        join: spillJoins.get(`${river.waterfall.col},${river.waterfall.row}`),
      });
    }

    for (const [key, geometryData] of groups.entries()) {
      if (geometryData.indices.length === 0) {
        continue;
      }
      // Populate every stream before allocating the vertex format; adding the
      // source stream after fromGeometry() leaves it out of the GPU buffer.
      const mesh = new this.#pc.Mesh(this.#device);
      mesh.setPositions(geometryData.positions);
      mesh.setNormals(geometryData.normals);
      mesh.setColors32(geometryData.colors);
      mesh.setUvs(0, geometryData.uvs);
      mesh.setUvs(1, geometryData.uvs1);
      mesh.setUvs(2, geometryData.sourceUvs);
      mesh.setIndices(geometryData.indices);
      mesh.update();
      this.#meshes.push(mesh);

      const [surfaceType] = key.split("|");
      const meshInstance = new this.#pc.MeshInstance(
        mesh,
        createMaterial(surfaceType === "terminal"),
      );
      const entity = new this.#pc.Entity(
        `River ${this.#riverKind.toLowerCase()} ${key}`,
      );
      entity.addComponent('render', {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: false,
      });
      this.#entity.addChild(entity);
    }
  }

  destroy() {
    for (const mesh of this.#meshes) {
      mesh.destroy();
    }
    this.#meshes = [];
  }

  /**
   *
   * @param {Map<string, RiverGeometryGroup>} groups
   * @param {string} key
   */
  #group(groups, key) {
    if (!groups.has(key)) {
      groups.set(key, {
        positions: [],
        normals: [],
        colors: [],
        uvs: [],
        uvs1: [],
        sourceUvs: [],
        indices: [],
        weldedVertices: new Map(),
      });
    }
    return groups.get(key);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {{x: number, y: number, z: number}} point
   * @param {{x: number, y: number, z: number}} normal
   * @param {import("playcanvas").Color|number} color
   * @param {Array<number>} uv
   * @param {boolean} weld
   * @param {Array<number>} metadata
   * @param {{x: number, y: number, z: number}} source
   */
  #addVertex(group, point, normal, color, uv, weld, metadata = [0, 0], source = [0, 0]) {
    // A bend's inside corner belongs to both ends of its route interval.
    // Keep distinct UVs there instead of stretching one tile's paint into the next.
    const key = weld
      ? `${point[0].toFixed(6)},${point[1].toFixed(6)},${point[2].toFixed(6)}|${uv[0].toFixed(6)},${uv[1].toFixed(6)}|${metadata[0].toFixed(6)},${metadata[1].toFixed(6)}`
      : null;
    if (key && group.weldedVertices.has(key)) {
      return group.weldedVertices.get(key);
    }

    const index = group.positions.length / 3;
    group.positions.push(...point);
    group.normals.push(...normal);
    group.colors.push(...color);
    group.uvs.push(...uv);
    group.uvs1.push(...metadata);
    group.sourceUvs.push(...source);
    if (key) {
      group.weldedVertices.set(key, index);
    }
    return index;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {Array<{x: number, y: number, z: number}>} points
   * @param {{x: number, y: number, z: number}} normal
   * @param {number} colors
   * @param {boolean} weld
   * @param {Array<number>} metadata
   */
  #addQuad(
    group,
    points,
    normal,
    colors = null,
    weld = false,
    metadata = [0, 0],
  ) {
    const indices = [];
    for (let index = 0; index < points.length; index++) {
      indices.push(
        this.#addVertex(
          group,
          points[index],
          normal,
          colors?.[index] ?? [0, 0, 0, 0],
          [index === 1 || index === 2 ? 1 : 0, index >= 2 ? 1 : 0],
          weld,
          metadata,
        ),
      );
    }
    group.indices.push(
      indices[0],
      indices[1],
      indices[2],
      indices[0],
      indices[2],
      indices[3],
    );
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {number} cell
   * @param {number} cols
   * @param {number} rows
   * @param {{x: number, y: number, z: number}} waterfallDirection
   * @param {number} riverCellKeys
   * @param {boolean} springSource
   * @param {{x: number, y: number, z: number}} incomingDirection
   * @param {number} cellIndex
   * @param {Array<{x: number, y: number, z: number}>} surfaceCorners
   * @param {RiverSourceProfile} sourceProfile
   */
  #addWaterVolume(
    group,
    cell,
    cols,
    rows,
    waterfallDirection,
    riverCellKeys,
    springSource,
    incomingDirection,
    cellIndex,
    surfaceCorners,
    sourceProfile,
  ) {
    const x = cell.col - (cols - 1) / 2;
    const z = cell.row - (rows - 1) / 2;
    const top = cell.elevation + 0.012;
    const bottom = top - 0.5;
    const half = 0.5;
    // Adjacent grids have the same subdivision count and their shared corner
    // heights are reconciled by RiverSurfaceHeights. Keep their boundaries
    // coincident: extending both patches through the join makes their planes
    // cross at bends and small bridge-clearance height changes, which causes
    // depth flicker and apparent holes.
    const minimumX = x - half;
    const maximumX = x + half;
    const minimumZ = z - half;
    const maximumZ = z + half;
    const surfaceSegments = 12;
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const surfaceHeightAt = (row, column) => {
      if (!surfaceCorners) {
        return top;
      }
      const u = column / surfaceSegments;
      const v = row / surfaceSegments;
      const north = surfaceCorners[0] * (1 - u) + surfaceCorners[1] * u;
      const south = surfaceCorners[2] * (1 - u) + surfaceCorners[3] * u;
      return north * (1 - v) + south * v;
    };
    const outgoing = this.#directionVector(cell.direction);
    const surfaceMetadata = [outgoing.col, outgoing.row];
    const incoming = this.#directionVector(incomingDirection);
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const flowUvAt = (row, column) => {
      const px = column / surfaceSegments - 0.5;
      const pz = row / surfaceSegments - 0.5;
      const turn = incoming.col * outgoing.row - incoming.row * outgoing.col;
      if (turn === 0) {
        return [
          0.5 - px * outgoing.row + pz * outgoing.col,
          cellIndex + 0.5 + px * outgoing.col + pz * outgoing.row,
        ];
      }
      const dx = px - (outgoing.col - incoming.col) * 0.5;
      const dz = pz - (outgoing.row - incoming.row) * 0.5;
      const along = Math.max(0, dx * incoming.col + dz * incoming.row);
      const before = Math.max(0, -dx * outgoing.col - dz * outgoing.row);
      const progress = Math.atan2(along, before) / (Math.PI / 2);
      const radius = Math.hypot(dx, dz);
      return [0.5 + turn * (0.5 - radius), cellIndex + progress];
    };
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const sourceSampleAt = (row, column) => sourceProfile.sample(
      cell.col + column / surfaceSegments - 0.5,
      cell.row + row / surfaceSegments - 0.5,
    );
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const sourceStrengthAt = (row, column) => {
      if (!springSource) {
        return 0;
      }
      const progress = Math.max(
        0,
        Math.min(1, flowUvAt(row, column)[1] - cellIndex),
      );
      if (sourceProfile) {
        return sourceSampleAt(row, column)[0];
      }
      const normalized = cellIndex === 0
        ? progress
        : 1 - Math.max(0, Math.min(1, progress / 0.86));
      return normalized * normalized * (3 - 2 * normalized);
    };
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const sourceProgressAt = (row, column) => {
      if (!springSource) {
        return 0;
      }
      const progress = Math.max(
        0,
        Math.min(1, flowUvAt(row, column)[1] - cellIndex),
      );
      if (sourceProfile) {
        return sourceSampleAt(row, column)[1];
      }
      return cellIndex === 0
        ? progress * 0.42
        : 0.42 + progress * 0.58;
    };
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const sourceAt = (row, column) => [
      sourceStrengthAt(row, column),
      sourceProgressAt(row, column),
    ];
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const flowInteriorStrengthAt = (row, column) => {
      const edgeDistance = Math.min(
        row,
        column,
        surfaceSegments - row,
        surfaceSegments - column,
      );
      return Math.min(1, edgeDistance / 2);
    };
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const surfacePointAt = (row, column) => [
      minimumX +
        (maximumX - minimumX) * (column / surfaceSegments),
      surfaceHeightAt(row, column),
      minimumZ +
        (maximumZ - minimumZ) * (row / surfaceSegments),
    ];
    /**
     *
     * @param {number} row
     * @param {number} column
     */
    const bottomPointAt = (row, column) => [
      minimumX +
        (maximumX - minimumX) * (column / surfaceSegments),
      bottom,
      minimumZ +
        (maximumZ - minimumZ) * (row / surfaceSegments),
    ];
    this.#addGrid(
      group,
      surfaceSegments,
      surfaceSegments,
      surfacePointAt,
      [0, 1, 0],
      /**
       *
       * @param {number} row
       * @param {number} column
       */
      (row, column) => [
        0,
        Math.round(sourceStrengthAt(row, column) * 255),
        Math.round(springSource
          ? sourceProgressAt(row, column) * 96
          : flowInteriorStrengthAt(row, column) * 96),
        255,
      ],
      false,
      true,
      flowUvAt,
      () => surfaceMetadata,
      sourceAt,
    );
    this.#addGrid(
      group,
      surfaceSegments,
      surfaceSegments,
      bottomPointAt,
      [0, -1, 0],
      /**
       *
       * @param {number} row
       * @param {number} column
       */
      (row, column) => [
        255,
        Math.round(sourceStrengthAt(row, column) * 255),
        0,
        255,
      ],
      true,
      true,
      flowUvAt,
      () => surfaceMetadata,
    );

    const topColor = [0, 0, 0, 255];
    /**
     *
     * @param {number} neighborCol
     * @param {number} neighborRow
     */
    const exposedBottomAt = (neighborCol, neighborRow) => {
      if (riverCellKeys.has(`${neighborCol},${neighborRow}`)) {
        return null;
      }

      const neighborIsTerrain =
        neighborCol >= 0 &&
        neighborCol < cols &&
        neighborRow >= 0 &&
        neighborRow < rows;
      if (neighborIsTerrain) {
        return null;
      }

      return Math.max(bottom, 0);
    };
    /**
     *
     * @param {number} sideBottom
     */
    const bottomColorAt = (sideBottom) => [
      Math.round(
        Math.max(0, Math.min(1, (top - sideBottom) / (top - bottom))) *
          255,
      ),
      0,
      0,
      0,
    ];
    const westBottom = exposedBottomAt(cell.col - 1, cell.row);
    if (
      waterfallDirection !== 'WEST' &&
      westBottom !== null
    ) {
      const bottomColor = bottomColorAt(westBottom);
      this.#addQuad(
        group,
        [
          [minimumX, westBottom, minimumZ],
          [minimumX, top, minimumZ],
          [minimumX, top, maximumZ],
          [minimumX, westBottom, maximumZ],
        ],
        [-1, 0, 0],
        [bottomColor, topColor, topColor, bottomColor],
        true,
        surfaceMetadata,
      );
    }
    const eastBottom = exposedBottomAt(cell.col + 1, cell.row);
    if (
      waterfallDirection !== 'EAST' &&
      eastBottom !== null
    ) {
      const bottomColor = bottomColorAt(eastBottom);
      this.#addQuad(
        group,
        [
          [maximumX, eastBottom, maximumZ],
          [maximumX, top, maximumZ],
          [maximumX, top, minimumZ],
          [maximumX, eastBottom, minimumZ],
        ],
        [1, 0, 0],
        [bottomColor, topColor, topColor, bottomColor],
        true,
        surfaceMetadata,
      );
    }
    const northBottom = exposedBottomAt(cell.col, cell.row - 1);
    if (
      waterfallDirection !== 'NORTH' &&
      northBottom !== null
    ) {
      const bottomColor = bottomColorAt(northBottom);
      this.#addQuad(
        group,
        [
          [maximumX, northBottom, minimumZ],
          [maximumX, top, minimumZ],
          [minimumX, top, minimumZ],
          [minimumX, northBottom, minimumZ],
        ],
        [0, 0, -1],
        [bottomColor, topColor, topColor, bottomColor],
        true,
        surfaceMetadata,
      );
    }
    const southBottom = exposedBottomAt(cell.col, cell.row + 1);
    if (
      waterfallDirection !== 'SOUTH' &&
      southBottom !== null
    ) {
      const bottomColor = bottomColorAt(southBottom);
      this.#addQuad(
        group,
        [
          [minimumX, southBottom, maximumZ],
          [minimumX, top, maximumZ],
          [maximumX, top, maximumZ],
          [maximumX, southBottom, maximumZ],
        ],
        [0, 0, 1],
        [bottomColor, topColor, topColor, bottomColor],
        true,
        surfaceMetadata,
      );
    }
    if (!waterfallDirection) {
      return null;
    }
    return this.#spillJoin(
      waterfallDirection,
      surfaceSegments,
      surfacePointAt,
      bottomPointAt,
      flowUvAt,
      sourceAt,
    );
  }

  /**
   *
   * @param {string} directionName
   * @param {number} segments
   * @param {(...coordinates: number[]) => Array<number>} surfacePointAt
   * @param {(...coordinates: number[]) => Array<number>} bottomPointAt
   * @param {(...args: number[]) => Array<number>} uvAt
   * @param {(...args: number[]) => Array<number>} sourceAt
   */
  #spillJoin(directionName, segments, surfacePointAt, bottomPointAt, uvAt, sourceAt) {
    const direction = this.#directionVector(directionName);
    const front = [];
    const rear = [];
    const uvs = [];
    const sources = [];
    for (let index = 0; index <= segments; index += 1) {
      let row;
      let column;
      if (direction.col !== 0) {
        column = direction.col < 0 ? 0 : segments;
        row = direction.col < 0 ? segments - index : index;
      } else {
        row = direction.row < 0 ? 0 : segments;
        column = direction.row < 0 ? index : segments - index;
      }
      front.push(surfacePointAt(row, column));
      rear.push(bottomPointAt(row, column));
      uvs.push(uvAt(row, column));
      sources.push(sourceAt(row, column));
    }
    return { front, rear, uvs, sources };
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} waterfall
   * @param {number} cols
   * @param {number} rows
   * @param {import("src/game/objects/ObjectTypes.js").RiverTerminal} terminal
   * @param {number} routeDistance
   * @param {string} section
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallJoin|null} join
   */
  addCurvedWaterfall(
    group,
    waterfall,
    cols,
    rows,
    terminal,
    routeDistance,
    section = 'all',
    join = null,
  ) {
    const geometry = new WaterfallGeometry(
      waterfall,
      this.#directionVector(waterfall.direction),
      cols,
      rows,
      terminal,
      routeDistance,
      join,
    );
    geometry.append(/**
     *
     * @param {...(number|boolean|Array<number>|((row: number, column: number) => Array<number>)|null)} args
     */
    (...args) => this.#addGrid(group, ...args), section);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {number} rowSegments
   * @param {number} columnSegments
   * @param {(...args: number[]) => Array<number>} pointAt
   * @param {{x: number, y: number, z: number}} normal
   * @param {number} colorAt
   * @param {boolean} reverseWinding
   * @param {boolean} weld
   * @param {(...args: number[]) => Array<number>} uvAt
   * @param {(...args: number[]) => Array<number>} metadataAt
   * @param {(...args: number[]) => Array<number>} sourceAt
   */
  #addGrid(
    group,
    rowSegments,
    columnSegments,
    pointAt,
    normal,
    colorAt = null,
    reverseWinding = false,
    weld = false,
    uvAt = null,
    metadataAt = null,
    sourceAt = null,
  ) {
    const vertices = [];
    for (let row = 0; row <= rowSegments; row++) {
      for (let column = 0; column <= columnSegments; column++) {
        vertices.push(
          this.#addVertex(
            group,
            pointAt(row, column),
            normal,
            colorAt?.(row, column) ?? [0, 0, 0, 0],
            uvAt?.(row, column) ?? [column / columnSegments, row / rowSegments],
            weld,
            metadataAt?.(row, column) ?? [0, 0],
            sourceAt?.(row, column) ?? [0, 0],
          ),
        );
      }
    }

    const rowWidth = columnSegments + 1;
    for (let row = 0; row < rowSegments; row++) {
      for (let column = 0; column < columnSegments; column++) {
        const topLeft = vertices[row * rowWidth + column];
        const topRight = vertices[row * rowWidth + column + 1];
        const bottomLeft = vertices[(row + 1) * rowWidth + column];
        const bottomRight = vertices[(row + 1) * rowWidth + column + 1];
        if (reverseWinding) {
          group.indices.push(
            topLeft,
            bottomRight,
            topRight,
            topLeft,
            bottomLeft,
            bottomRight,
          );
        } else {
          group.indices.push(
            topLeft,
            topRight,
            bottomRight,
            topLeft,
            bottomRight,
            bottomLeft,
          );
        }
      }
    }
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} direction
   */
  #directionVector(direction) {
    if (direction === 'NORTH') {
      return { col: 0, row: -1 };
    }
    if (direction === 'EAST') {
      return { col: 1, row: 0 };
    }
    if (direction === 'SOUTH') {
      return { col: 0, row: 1 };
    }
    return { col: -1, row: 0 };
  }
}
