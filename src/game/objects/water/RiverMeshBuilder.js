import { RIVER_KIND } from '../../enum/RiverKind.js';
import { RiverSurfaceHeights } from './RiverSurfaceHeights.js';
import { WaterfallGeometry } from './WaterfallGeometry.js';

export class RiverMeshBuilder {
  #pc;
  #device;
  #mapData;
  #riverKind;
  #entity;
  #meshes = [];

  constructor({ pc, device, mapData, riverKind, entity }) {
    this.#pc = pc;
    this.#device = device;
    this.#mapData = mapData;
    this.#riverKind = riverKind;
    this.#entity = entity;
  }

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
        river.cells.map((cell) => `${cell.col},${cell.row}`),
      );
      const spillDirections = new Map(
        river.cascades.map((cascade) => [
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
    const sourceSampleAt = (row, column) => sourceProfile.sample(
      cell.col + column / surfaceSegments - 0.5,
      cell.row + row / surfaceSegments - 0.5,
    );
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
    const sourceAt = (row, column) => [
      sourceStrengthAt(row, column),
      sourceProgressAt(row, column),
    ];
    const flowInteriorStrengthAt = (row, column) => {
      const edgeDistance = Math.min(
        row,
        column,
        surfaceSegments - row,
        surfaceSegments - column,
      );
      return Math.min(1, edgeDistance / 2);
    };
    const surfacePointAt = (row, column) => [
      minimumX +
        (maximumX - minimumX) * (column / surfaceSegments),
      surfaceHeightAt(row, column),
      minimumZ +
        (maximumZ - minimumZ) * (row / surfaceSegments),
    ];
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
    geometry.append((...args) => this.#addGrid(group, ...args), section);
  }

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
