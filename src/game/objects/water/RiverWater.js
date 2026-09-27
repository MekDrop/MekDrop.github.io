import riverStoneAngularModelUrl from '../../models/water/river-stone-angular.glb?url';
import riverStoneFlatModelUrl from '../../models/water/river-stone-flat.glb?url';
import riverStoneModelUrl from '../../models/water/river-stone.glb?url';
import riverWaterFragmentShader from './RiverWater.frag?raw';
import riverWaterNormalShader from './RiverWaterNormal.frag?raw';
import riverWaterOpacityShader from './RiverWaterOpacity.frag?raw';
import riverWaterVertexShader from './RiverWater.vert?raw';
import { WaterfallGeometry } from './WaterfallGeometry.js';
import { WaterfallSpray } from './WaterfallSpray.js';
import { HeroWaterReflection } from './HeroWaterReflection.js';
import { RiverSurfaceHeights } from './RiverSurfaceHeights.js';
import { RiverFlowMap } from './RiverFlowMap.js';
import { RiverSourceProfile } from './RiverSourceProfile.js';
import { RIVER_KIND } from '../../enum/RiverKind.js';

export class RiverWater {
  static get modelUrls() {
    return [
      riverStoneModelUrl,
      riverStoneFlatModelUrl,
      riverStoneAngularModelUrl,
    ];
  }

  #pc;
  #app;
  #mapData;
  #materials = new Map();
  #meshes = [];
  #mistTexture;
  #waterfallSpray;
  #stoneVertexBuffers = [];
  #time = 0;
  #heroReflection;
  #flowMap;
  #rockContacts = new Float32Array(18 * 4);
  #rockContactCount = 0;
  #cascadeImpacts = new Float32Array(32 * 4);
  #cascadeFlows = new Float32Array(32 * 4);
  #cascadeImpactCount = 0;

  constructor({ pc, app, mapData }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.entity = new pc.Entity(`River ${this.riverKind.toLowerCase()}`);
    this.#waterfallSpray = this.hasWaterEffects
      ? new WaterfallSpray(pc, app.graphicsDevice)
      : null;
    if (this.#waterfallSpray) {
      this.entity.addChild(this.#waterfallSpray.entity);
    }
    this.#mistTexture = this.#createMistTexture();
    this.#heroReflection = this.hasWaterEffects
      ? new HeroWaterReflection(pc, app)
      : null;
    this.#flowMap = this.hasWaterEffects
      ? new RiverFlowMap(pc, app.graphicsDevice, mapData)
      : null;
  }

  build(modelLibrary) {
    this.#build();
    this.#buildRiverStones(modelLibrary);
    for (const material of this.#materials.values()) {
      material.setParameter('uRiverRocks[0]', this.#rockContacts);
      material.setParameter('uRiverRockCount', this.#rockContactCount);
      material.setParameter('uCascadeImpacts[0]', this.#cascadeImpacts);
      material.setParameter('uCascadeFlows[0]', this.#cascadeFlows);
      material.setParameter('uCascadeImpactCount', this.#cascadeImpactCount);
    }
  }

  get riverKind() {
    return RIVER_KIND.WATER;
  }

  get pc() {
    return this.#pc;
  }

  get mistTexture() {
    return this.#mistTexture;
  }

  get hasRockContactEffects() {
    return true;
  }

  get hasWaterEffects() {
    return true;
  }

  createSourceProfile(cells) {
    return new RiverSourceProfile(cells);
  }

  isSpringSource(cellIndex, cascadeLanding) {
    return cellIndex < 2 && !cascadeLanding;
  }

  surfaceCorners(surfaceHeights, cell) {
    return surfaceHeights.cornersFor(cell);
  }

  appendCascade({ group, cascade, cols, rows, routeDistance, join }) {
    this.#addCurvedWaterfall(
      group,
      {
        col: cascade.from.col,
        row: cascade.from.row,
        direction: cascade.direction,
        topElevation: cascade.topElevation,
        bottomElevation: cascade.bottomElevation,
      },
      cols,
      rows,
      false,
      routeDistance,
      "all",
      join,
    );
  }

  appendTerminal({
    riverGroup,
    terminalGroup,
    waterfall,
    cols,
    rows,
    routeDistance,
    join,
  }) {
    this.#addCurvedWaterfall(
      riverGroup,
      waterfall,
      cols,
      rows,
      true,
      routeDistance,
      "body",
      join,
    );
    this.#addCurvedWaterfall(
      terminalGroup,
      waterfall,
      cols,
      rows,
      true,
      routeDistance,
      "tail",
      join,
    );
  }

  update(deltaTime, hero = null, camera = null) {
    this.#time = (this.#time + deltaTime) % 1000;
    this.#heroReflection?.update(hero?.waterPresentation, camera);
    for (const material of this.#materials.values()) {
      material.setParameter('uRiverTime', this.#time);
      this.#heroReflection?.apply(material);
    }
  }

  destroy() {
    this.#heroReflection?.destroy();
    this.#flowMap?.destroy();
    this.#waterfallSpray?.destroy();
    this.entity.destroy();
    for (const mesh of this.#meshes) {
      mesh.destroy();
    }
    this.#meshes = [];
    for (const material of this.#materials.values()) {
      material.destroy();
    }
    this.#materials.clear();
    this.#mistTexture?.destroy();
    this.#mistTexture = null;
    for (const vertexBuffer of this.#stoneVertexBuffers) {
      vertexBuffer.destroy();
    }
    this.#stoneVertexBuffers = [];
  }

  #build() {
    const groups = new Map();
    const { cols, rows, riverData = [] } = this.#mapData;
    const rivers = riverData.filter(
      (river) => (river.kind ?? RIVER_KIND.WATER) === this.riverKind,
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
      const sourceProfile = this.createSourceProfile(river.cells);
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
          this.isSpringSource(cellIndex, cascadeLanding),
          river.cells[cellIndex - 1]?.direction ?? cell.direction,
          cellIndex,
          this.surfaceCorners(surfaceHeights, cell),
          sourceProfile,
        );
        if (spillJoin) {
          spillJoins.set(cellKey, spillJoin);
        }
      }
      for (const cascade of river.cascades) {
        this.appendCascade({
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
      this.appendTerminal({
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
      const mesh = new this.#pc.Mesh(this.#app.graphicsDevice);
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
        this.createMaterial(surfaceType === "terminal"),
      );
      const entity = new this.#pc.Entity(
        `River ${this.riverKind.toLowerCase()} ${key}`,
      );
      entity.addComponent('render', {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: false,
      });
      this.entity.addChild(entity);
    }
  }

  #buildRiverStones(modelLibrary) {
    const { cols, rows, riverData = [] } = this.#mapData;
    const rivers = riverData.filter(
      (river) => (river.kind ?? RIVER_KIND.WATER) === this.riverKind,
    );
    const stoneModels = [
      riverStoneModelUrl,
      riverStoneFlatModelUrl,
      riverStoneAngularModelUrl,
    ];
    const stoneModelHeights = new Map([
      [riverStoneModelUrl, 0.20761],
      [riverStoneFlatModelUrl, 0.14188],
      [riverStoneAngularModelUrl, 0.27262],
    ]);
    const matricesByModel = new Map(
      stoneModels.map((modelUrl) => [modelUrl, []]),
    );

    for (const [riverIndex, river] of rivers.entries()) {
      const blockedCells = new Set([
        `${river.cells[0].col},${river.cells[0].row}`,
        `${river.waterfall.col},${river.waterfall.row}`,
        ...river.cascades.flatMap((cascade) => [
          `${cascade.from.col},${cascade.from.row}`,
          `${cascade.to.col},${cascade.to.row}`,
        ]),
      ]);
      let stonesPlaced = 0;
      for (const cell of river.cells) {
        if (
          cell.underBridge ||
          blockedCells.has(`${cell.col},${cell.row}`) ||
          stonesPlaced >= 3
        ) {
          continue;
        }

        const seed =
          cell.col * 73 + cell.row * 131 + riverIndex * 977 + 41;
        if (this.#waterfallNoise(seed) > 0.24) {
          continue;
        }

        const modelUrl =
          stoneModels[
            Math.floor(this.#waterfallNoise(seed + 89) * stoneModels.length)
          ];
        const scale = 0.38 + this.#waterfallNoise(seed + 43) * 0.9;
        const horizontalStretch =
          0.74 + this.#waterfallNoise(seed + 59) * 0.52;
        const footprintScale =
          scale * Math.max(horizontalStretch, 1 / horizontalStretch);
        const offsetRange = Math.max(0.04, 0.36 - footprintScale * 0.2);
        const offsetX =
          (this.#waterfallNoise(seed + 17) - 0.5) * 2 * offsetRange;
        const offsetZ =
          (this.#waterfallNoise(seed + 29) - 0.5) * 2 * offsetRange;
        const burialDepth = 0.01 + this.#waterfallNoise(seed + 101) * 0.14;
        const rockHeight = 0.38 + this.#waterfallNoise(seed + 113) * 0.44;
        const verticalScale = rockHeight / stoneModelHeights.get(modelUrl);
        const matrix = new this.#pc.Mat4();
        const rotation = new this.#pc.Quat().setFromEulerAngles(
          0,
          this.#waterfallNoise(seed + 71) * 360,
          0,
        );
        matrix.setTRS(
          new this.#pc.Vec3(
            cell.col - (cols - 1) / 2 + offsetX,
            cell.bedElevation - burialDepth,
            cell.row - (rows - 1) / 2 + offsetZ,
          ),
          rotation,
          new this.#pc.Vec3(
            scale * horizontalStretch,
            verticalScale,
            scale / horizontalStretch,
          ),
        );
        matricesByModel.get(modelUrl).push(...matrix.data);
        if (
          this.hasRockContactEffects &&
          cell.bedElevation - burialDepth + rockHeight > cell.elevation - 0.025 &&
          this.#rockContactCount < 18
        ) {
          const rockX = cell.col - (cols - 1) / 2 + offsetX;
          const rockZ = cell.row - (rows - 1) / 2 + offsetZ;
          const radius = Math.min(0.28, footprintScale * 0.19);
          this.#rockContacts.set(
            [rockX, cell.elevation + 0.012, rockZ, radius],
            this.#rockContactCount * 4,
          );
          this.#rockContactCount++;
          this.#addRockSpray(rockX, cell.elevation, rockZ, radius, cell.direction);
        }
        stonesPlaced++;
      }
    }

    for (const [modelUrl, matrices] of matricesByModel) {
      const batch = modelLibrary.instantiateMergedBatch(modelUrl, matrices, {
        name: 'Partially submerged river stones',
        castShadows: true,
        receiveShadows: true,
      });
      if (!batch) {
        continue;
      }
      this.#stoneVertexBuffers.push(batch.vertexBuffer);
      this.entity.addChild(batch.entity);
    }
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

  #addRockSpray(x, elevation, z, radius, direction) {
    const flow = this.#directionVector(direction);
    const spray = new this.#pc.Entity('River rock contact spray');
    spray.setLocalPosition(
      x - flow.col * radius * 0.8,
      elevation + 0.045,
      z - flow.row * radius * 0.8,
    );
    spray.addComponent('particlesystem', {
      numParticles: 7, lifetime: 0.65, rate: 0.12, rate2: 0.2,
      loop: true, preWarm: true, lighting: false, depthWrite: false,
      blendType: this.#pc.BLEND_NORMAL, localSpace: true,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(radius * 0.45, 0.015, radius * 0.45),
      colorMap: this.#mistTexture,
      localVelocityGraph: this.#curveSet(
        [0, flow.col * 0.08 - 0.035, 1, flow.col * 0.18],
        [0, 0.34, 0.4, 0.18, 1, -0.06],
        [0, flow.row * 0.08 - 0.035, 1, flow.row * 0.18],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, flow.col * 0.12 + 0.035, 1, flow.col * 0.22],
        [0, 0.5, 0.4, 0.26, 1, -0.1],
        [0, flow.row * 0.12 + 0.035, 1, flow.row * 0.22],
      ),
      scaleGraph: this.#curve([0, 0.012, 0.4, 0.032, 1, 0.05]),
      scaleGraph2: this.#curve([0, 0.018, 0.4, 0.045, 1, 0.065]),
      colorGraph: this.#curveSet([0, 0.69, 1, 0.77], [0, 0.84, 1, 0.86], [0, 0.8, 1, 0.85]),
      alphaGraph: this.#curve([0, 0, 0.16, 0.38, 0.55, 0.16, 1, 0]),
    });
    this.entity.addChild(spray);
  }

  createMaterial(translucent = false) {
    const key = translucent ? "translucent" : "opaque";
    return this.materialFor(key, () => {
      const material = new this.#pc.StandardMaterial();
      material.name = `Painted river ${key}`;
      material.diffuse = new this.#pc.Color(0.08, 0.62, 0.84);
      material.ambient = new this.#pc.Color(0, 0, 0);
      material.emissive = new this.#pc.Color(1, 1, 1);
      material.shaderChunks.glsl.set(
        'emissivePS',
        'void getEmission() { dEmission = dAlbedo; }',
      );
      // Enable the standard material's UV varying; the painted shader supplies its own color.
      material.diffuseMap = this.#mistTexture;
      material.forceUv1 = true;
      material.setAttribute('vertex_riverSource', this.#pc.SEMANTIC_TEXCOORD2);
      material.diffuseVertexColor = true;
      material.useLighting = false;
      material.blendType = translucent
        ? this.#pc.BLEND_NORMAL
        : this.#pc.BLEND_NONE;
      material.depthWrite = true;
      material.useDynamicRefraction = false;
      material.refraction = 0;
      material.cull = this.#pc.CULLFACE_NONE;
      material.shaderChunks.glsl.set('transformVS', riverWaterVertexShader);
      material.shaderChunks.glsl.set("diffusePS", riverWaterFragmentShader);
      material.shaderChunks.glsl.set("normalMapPS", riverWaterNormalShader);
      if (translucent) {
        material.opacityVertexColor = true;
        material.opacityVertexColorChannel = 'a';
        material.shaderChunks.glsl.set("opacityPS", riverWaterOpacityShader);
      }
      material.setParameter('uRiverLava', 0);
      return material;
    });
  }

  materialFor(key, create) {
    if (this.#materials.has(key)) {
      return this.#materials.get(key);
    }
    const material = create();
    material.setParameter('uRiverTime', this.#time);
    this.#heroReflection?.apply(material);
    this.#flowMap?.apply(material);
    material.update();
    this.#materials.set(key, material);
    return material;
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

  #addCurvedWaterfall(
    group, waterfall, cols, rows, terminal, routeDistance,
    section = "all", join = null,
  ) {
    const geometry = new WaterfallGeometry(
      waterfall,
      this.#directionVector(waterfall.direction),
      cols, rows, terminal, routeDistance, join,
    );
    geometry.append((...args) => this.#addGrid(group, ...args), section);
    if (section !== 'tail') {
      this.#waterfallSpray.add(waterfall, cols, rows, terminal);
      if (!terminal && this.#cascadeImpactCount < 32) {
        const direction = this.#directionVector(waterfall.direction);
        const drop = waterfall.topElevation - waterfall.bottomElevation;
        // The center of the falling front reaches this point in the lower cell.
        const forward = 0.565 + Math.min(0.22, drop * 0.22);
        this.#cascadeImpacts.set([
          waterfall.col - (cols - 1) / 2 + direction.col * forward,
          waterfall.bottomElevation + 0.012,
          waterfall.row - (rows - 1) / 2 + direction.row * forward,
          Math.min(1, 0.45 + drop * 0.2),
        ], this.#cascadeImpactCount * 4);
        this.#cascadeFlows.set([
          direction.col, direction.row, routeDistance, 0,
        ], this.#cascadeImpactCount * 4);
        this.#cascadeImpactCount++;
      }
    }
  }

  #createMistTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const normalizedX = (x + 0.5 - size / 2) / (size / 2);
        const normalizedY = (y + 0.5 - size / 2) / (size / 2);
        const distance = Math.hypot(normalizedX, normalizedY);
        const angle = Math.atan2(normalizedY, normalizedX);
        const boundary =
          0.82 +
          Math.sin(angle * 5 + 0.7) * 0.08 +
          Math.sin(angle * 9 - 0.4) * 0.045;
        const edge = Math.max(
          0,
          Math.min(1, (boundary - distance) / 0.34),
        );
        const softEdge = edge * edge * (3 - 2 * edge);
        const cloudyNoise =
          0.76 +
          Math.sin(x * 1.73 + y * 0.91) * 0.09 +
          Math.sin(x * 0.41 - y * 1.37) * 0.07;
        const pixel = (y * size + x) * 4;
        image.data[pixel] = 226;
        image.data[pixel + 1] = 247;
        image.data[pixel + 2] = 255;
        image.data[pixel + 3] = Math.round(
          Math.max(0, softEdge * cloudyNoise) * 154,
        );
      }
    }
    context.putImageData(image, 0, 0);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: 'Waterfall mist particle',
      width: size,
      height: size,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      mipmaps: true,
    });
    texture.setSource(canvas);
    return texture;
  }

  #curve(keys) {
    const curve = new this.#pc.Curve(keys);
    curve.type = this.#pc.CURVE_SMOOTHSTEP;
    return curve;
  }

  #curveSet(...channels) {
    const curves = new this.#pc.CurveSet(channels);
    curves.type = this.#pc.CURVE_SMOOTHSTEP;
    return curves;
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

  #waterfallNoise(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
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
