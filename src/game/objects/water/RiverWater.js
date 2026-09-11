import riverStoneAngularModelUrl from '../../models/water/river-stone-angular.glb?url';
import riverStoneFlatModelUrl from '../../models/water/river-stone-flat.glb?url';
import riverStoneModelUrl from '../../models/water/river-stone.glb?url';
import riverWaterFragmentShader from './RiverWater.frag?raw';
import riverWaterNormalShader from './RiverWaterNormal.frag?raw';
import riverWaterOpacityShader from './RiverWaterOpacity.frag?raw';
import riverWaterVertexShader from './RiverWater.vert?raw';
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
  #stoneVertexBuffers = [];
  #time = 0;

  constructor({ pc, app, mapData, modelLibrary }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.entity = new pc.Entity('Cel-shaded rivers');
    this.#mistTexture = this.#createMistTexture();
    this.#build();
    this.#buildRiverStones(modelLibrary);
  }

  update(deltaTime) {
    this.#time = (this.#time + deltaTime) % 1000;
    for (const material of this.#materials.values()) {
      material.setParameter('uRiverTime', this.#time);
    }
  }

  destroy() {
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
    for (const river of riverData) {
      const riverKind = river.kind ?? RIVER_KIND.WATER;
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
      for (const [cellIndex, cell] of river.cells.entries()) {
        const surfaceGroup = this.#group(
          groups,
          `surface|${riverKind}|${cell.direction}|${river.id}`,
        );
        this.#addWaterVolume(
          surfaceGroup,
          cell,
          cols,
          rows,
          spillDirections.get(`${cell.col},${cell.row}`) ?? null,
          riverCellKeys,
          cellIndex === 0,
        );
      }
      if (river.cells[0]) {
      }
      for (const cascade of river.cascades) {
        this.#addCurvedWaterfall(
          this.#group(groups, `fall|${riverKind}|${cascade.direction}`),
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
        );
        this.#addWaterfallMist(
          cascade,
          cols,
          rows,
          false,
          riverKind,
        );
        this.#addCascadeImpact(
          this.#group(
            groups,
            `surface|${riverKind}|${cascade.direction}|${river.id}`,
          ),
          cascade,
          cols,
          rows,
        );
      }
      this.#addCurvedWaterfall(
        this.#group(
          groups,
          `fall|${riverKind}|${river.waterfall.direction}`,
        ),
        river.waterfall,
        cols,
        rows,
        true,
      );
      this.#addWaterfallMist(
        river.waterfall,
        cols,
        rows,
        true,
        riverKind,
      );
    }

    for (const [key, geometryData] of groups.entries()) {
      if (geometryData.indices.length === 0) {
        continue;
      }
      const geometry = new this.#pc.Geometry();
      geometry.positions = geometryData.positions;
      geometry.normals = geometryData.normals;
      geometry.colors = geometryData.colors;
      geometry.uvs = geometryData.uvs;
      geometry.indices = geometryData.indices;
      const mesh = this.#pc.Mesh.fromGeometry(
        this.#app.graphicsDevice,
        geometry,
      );
      this.#meshes.push(mesh);

      const [kind, riverKind, direction] = key.split('|');
      const meshInstance = new this.#pc.MeshInstance(
        mesh,
        this.#material(direction, kind === 'fall', riverKind),
      );
      const entity = new this.#pc.Entity(
        `River ${riverKind.toLowerCase()} ${key}`,
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

    for (const [riverIndex, river] of riverData.entries()) {
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
        indices: [],
        weldedVertices: new Map(),
      });
    }
    return groups.get(key);
  }

  #material(direction, vertical, riverKind) {
    const lava = riverKind === RIVER_KIND.LAVA;
    const key = `${riverKind}-${vertical ? 'fall' : 'surface'}-${direction}`;
    if (this.#materials.has(key)) {
      return this.#materials.get(key);
    }

    const flow = this.#directionVector(direction);
    const material = new this.#pc.StandardMaterial();
    material.name = `Cel-shaded river ${key}`;
    material.diffuse = lava
      ? new this.#pc.Color(1, 0.2, 0.015)
      : new this.#pc.Color(0.08, 0.62, 0.84);
    if (lava) {
      material.emissive = new this.#pc.Color(0.72, 0.12, 0.006);
      material.emissiveIntensity = 0.9;
    }
    material.diffuseVertexColor = true;
    material.opacityVertexColor = true;
    material.opacityVertexColorChannel = 'a';
    material.useLighting = false;
    material.blendType = this.#pc.BLEND_NORMAL;
    material.depthWrite = true;
    material.useDynamicRefraction = !lava;
    material.refraction = 0.3;
    material.refractionIndex = 1 / 1.333;
    material.thickness = 0.46;
    material.attenuation = lava
      ? new this.#pc.Color(0.8, 0.08, 0.01)
      : new this.#pc.Color(0.18, 0.64, 0.82);
    material.attenuationDistance = 1.15;
    material.cull = this.#pc.CULLFACE_NONE;
    material.shaderChunks.glsl.set('transformVS', riverWaterVertexShader);
    material.shaderChunks.glsl.set('diffusePS', riverWaterFragmentShader);
    material.shaderChunks.glsl.set('normalMapPS', riverWaterNormalShader);
    material.shaderChunks.glsl.set('opacityPS', riverWaterOpacityShader);
    material.setParameter('uRiverFlowDirection', [flow.col, flow.row]);
    material.setParameter('uRiverVertical', vertical ? 1 : 0);
    material.setParameter('uRiverLava', lava ? 1 : 0);
    material.setParameter('uRiverTime', this.#time);
    material.update();
    this.#materials.set(key, material);
    return material;
  }

  #addVertex(group, point, normal, color, uv, weld) {
    const key = weld
      ? `${point[0].toFixed(6)},${point[1].toFixed(6)},${point[2].toFixed(6)}`
      : null;
    if (key && group.weldedVertices.has(key)) {
      return group.weldedVertices.get(key);
    }

    const index = group.positions.length / 3;
    group.positions.push(...point);
    group.normals.push(...normal);
    group.colors.push(...color);
    group.uvs.push(...uv);
    if (key) {
      group.weldedVertices.set(key, index);
    }
    return index;
  }

  #addQuad(group, points, normal, colors = null, weld = false) {
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
  ) {
    const x = cell.col - (cols - 1) / 2;
    const z = cell.row - (rows - 1) / 2;
    const top = cell.elevation + 0.012;
    const bottom = top - 0.5;
    const half = 0.5;
    const minimumX = x - half;
    const maximumX = x + half;
    const minimumZ = z - half;
    const maximumZ = z + half;
    const surfaceSegments = 12;
    const sourceStrengthAt = (row, column) => {
      if (!springSource) {
        return 0;
      }
      const distance = Math.hypot(
        column / surfaceSegments - 0.5,
        row / surfaceSegments - 0.5,
      );
      const radialProgress = Math.max(0, 1 - distance / 0.49);
      return radialProgress * radialProgress * (3 - 2 * radialProgress);
    };
    const flowInteriorStrengthAt = (row, column) => {
      const edgeDistance = Math.min(
        row,
        column,
        surfaceSegments - row,
        surfaceSegments - column,
      );
      return Math.min(1, edgeDistance / 2);
    };
    this.#addGrid(
      group,
      surfaceSegments,
      surfaceSegments,
      (row, column) => [
        minimumX +
          (maximumX - minimumX) * (column / surfaceSegments),
        top,
        minimumZ +
          (maximumZ - minimumZ) * (row / surfaceSegments),
      ],
      [0, 1, 0],
      (row, column) => [
        0,
        Math.round(sourceStrengthAt(row, column) * 255),
        Math.round(flowInteriorStrengthAt(row, column) * 96),
        255,
      ],
      false,
      true,
    );
    this.#addGrid(
      group,
      surfaceSegments,
      surfaceSegments,
      (row, column) => [
        minimumX +
          (maximumX - minimumX) * (column / surfaceSegments),
        bottom,
        minimumZ +
          (maximumZ - minimumZ) * (row / surfaceSegments),
      ],
      [0, -1, 0],
      (row, column) => [
        255,
        Math.round(sourceStrengthAt(row, column) * 255),
        0,
        255,
      ],
      true,
      true,
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
      );
    }
  }

  #addCurvedWaterfall(group, waterfall, cols, rows, terminal) {
    const direction = this.#directionVector(waterfall.direction);
    const cross = { col: -direction.row, row: direction.col };
    const centerX = waterfall.col - (cols - 1) / 2;
    const centerZ = waterfall.row - (rows - 1) / 2;
    const top = waterfall.topElevation + 0.012;
    const lipRadius = 0.4;
    const lipStart = 0.5;
    const lipSlices = 12;
    const widthSegments = 12;
    const curtainSegments = terminal
      ? 24
      : Math.max(
          4,
          Math.ceil(
            (waterfall.topElevation - waterfall.bottomElevation) * 6,
          ),
        );
    const totalRows = lipSlices + curtainSegments;
    const curtainTop = top - lipRadius;
    const curtainForward = lipStart + lipRadius;
    const seed = waterfall.col * 53 + waterfall.row * 97;
    const bottomByWidth = Array.from(
      { length: widthSegments + 1 },
      (_, widthIndex) =>
        terminal
          ? waterfall.bottomElevation +
            0.1 +
            this.#waterfallNoise(seed + widthIndex * 19) * 0.22
          : waterfall.bottomElevation + 0.012,
    );

    const pointAt = (row, widthIndex, depthOffset) => {
      const acrossBase = widthIndex / widthSegments - 0.5;
      if (row <= lipSlices) {
        const progress = row / lipSlices;
        const angle = progress * Math.PI * 0.5;
        const normalForward = Math.sin(angle);
        const normalY = Math.cos(angle);
        const thicknessScale = Math.sin(angle);
        const curvedThickness = depthOffset * thicknessScale;
        const forward =
          lipStart +
          Math.sin(angle) * lipRadius +
          normalForward * curvedThickness;
        const y =
          top -
          (1 - Math.cos(angle)) * lipRadius +
          normalY * curvedThickness;
        return [
          centerX + direction.col * forward + cross.col * acrossBase,
          y,
          centerZ + direction.row * forward + cross.row * acrossBase,
        ];
      }

      const progress = (row - lipSlices) / curtainSegments;
      const taper = terminal ? 1 - Math.max(0, progress - 0.72) * 0.75 : 1;
      const across = acrossBase * taper;
      const edgeWobble =
        widthIndex === 0 || widthIndex === widthSegments
          ? Math.sin(progress * 12.0 + seed * 0.13) * 0.045 * progress
          : 0;
      const forwardWobble =
        Math.sin(progress * 10.0 + acrossBase * 15.0 + seed * 0.07) *
        0.034 *
        progress;
      const layeredBulge =
        Math.sin(acrossBase * Math.PI * 6 + progress * 7.0 + seed) *
        0.014 *
        progress;
      return [
        centerX +
          direction.col *
            (curtainForward +
              depthOffset +
              forwardWobble +
              layeredBulge) +
          cross.col * (across + edgeWobble),
        curtainTop +
          (bottomByWidth[widthIndex] - curtainTop) * progress,
        centerZ +
          direction.row *
            (curtainForward +
              depthOffset +
              forwardWobble +
              layeredBulge) +
          cross.row * (across + edgeWobble),
      ];
    };

    const depthOffsetAt = (widthIndex) =>
      Math.sin((widthIndex / widthSegments) * Math.PI) * 0.13;
    const colorAt = (row, widthIndex) =>
      this.#waterfallVertexColor(
        row,
        widthIndex,
        lipSlices,
        curtainSegments,
        widthSegments,
        terminal,
      );
    const innerColorAt = (row, widthIndex) => {
      const color = colorAt(row, widthIndex);
      color[3] = Math.min(
        color[3],
        Math.round(Math.min(1, row / lipSlices) * 255),
      );
      return color;
    };

    this.#addGrid(
      group,
      totalRows,
      widthSegments,
      (row, widthIndex) =>
        pointAt(row, widthIndex, depthOffsetAt(widthIndex)),
      [direction.col, 0, direction.row],
      colorAt,
    );
    const curtainThickness = 0.32;
    const innerPointAt = (row, widthIndex) => {
      const point = pointAt(row, widthIndex, depthOffsetAt(widthIndex));
      const lipProgress = Math.min(1, row / lipSlices);
      const angle = lipProgress * Math.PI * 0.5;
      const remainingDepth = 1 - lipProgress;
      const thickness =
        curtainThickness +
        (0.5 - curtainThickness) * remainingDepth * remainingDepth;
      point[0] -= direction.col * Math.sin(angle) * thickness;
      point[1] -= Math.cos(angle) * thickness;
      point[2] -= direction.row * Math.sin(angle) * thickness;
      return point;
    };
    this.#addGrid(
      group,
      totalRows,
      widthSegments,
      innerPointAt,
      [-direction.col, -0.2, -direction.row],
      innerColorAt,
      true,
    );
    for (const widthIndex of [0, widthSegments]) {
      const sideNormal =
        widthIndex === 0
          ? [-cross.col, 0, -cross.row]
          : [cross.col, 0, cross.row];
      for (let row = 0; row < totalRows; row++) {
        this.#addQuad(
          group,
          [
            pointAt(row, widthIndex, depthOffsetAt(widthIndex)),
            pointAt(row + 1, widthIndex, depthOffsetAt(widthIndex)),
            innerPointAt(row + 1, widthIndex),
            innerPointAt(row, widthIndex),
          ],
          sideNormal,
          [
            colorAt(row, widthIndex),
            colorAt(row + 1, widthIndex),
            innerColorAt(row + 1, widthIndex),
            innerColorAt(row, widthIndex),
          ],
        );
      }
    }
    if (terminal) {
      this.#addWaterfallDroplets(
        group,
        waterfall,
        direction,
        cross,
        centerX,
        centerZ,
        curtainForward,
        seed,
      );
    }
  }

  #addCascadeImpact(group, cascade, cols, rows) {
    const direction = this.#directionVector(cascade.direction);
    const cross = { col: -direction.row, row: direction.col };
    const centerX = cascade.from.col - (cols - 1) / 2;
    const centerZ = cascade.from.row - (rows - 1) / 2;
    const widthSegments = 12;
    const impactColor = [0, 0, 255, 255];

    for (let band = 0; band < 3; band++) {
      const baseForward = 0.94 + band * 0.095;
      const thickness = 0.026 - band * 0.004;
      for (let widthIndex = 0; widthIndex < widthSegments; widthIndex++) {
        const pointAt = (column, edge) => {
          const across = column / widthSegments - 0.5;
          const arch = (1 - Math.pow(across * 2, 2)) * (0.045 + band * 0.01);
          const irregularity =
            Math.sin(
              column * 1.73 +
                band * 2.19 +
                cascade.from.col * 0.37 +
                cascade.from.row * 0.51,
            ) * 0.012;
          const forward =
            baseForward + arch + irregularity + edge * thickness;
          return [
            centerX + direction.col * forward + cross.col * across * 0.86,
            cascade.bottomElevation + 0.045,
            centerZ + direction.row * forward + cross.row * across * 0.86,
          ];
        };
        this.#addQuad(
          group,
          [
            pointAt(widthIndex, -1),
            pointAt(widthIndex, 1),
            pointAt(widthIndex + 1, 1),
            pointAt(widthIndex + 1, -1),
          ],
          [0, 1, 0],
          [impactColor, impactColor, impactColor, impactColor],
        );
      }
    }
  }

  #addWaterfallDroplets(
    group,
    waterfall,
    direction,
    cross,
    centerX,
    centerZ,
    curtainForward,
    seed,
  ) {
    const fadeElevation =
      waterfall.bottomElevation +
      (waterfall.topElevation - waterfall.bottomElevation) * 0.17;
    for (let index = 0; index < 16; index++) {
      const across =
        (this.#waterfallNoise(seed + index * 37) - 0.5) * 0.72;
      const forward =
        curtainForward +
        0.02 +
        this.#waterfallNoise(seed + index * 61) * 0.13;
      const y =
        fadeElevation -
        this.#waterfallNoise(seed + index * 83) * 1.1;
      const radius =
        0.025 + this.#waterfallNoise(seed + index * 101) * 0.035;
      const height =
        0.1 + this.#waterfallNoise(seed + index * 127) * 0.2;
      this.#addDroplet(
        group,
        [
          centerX + direction.col * forward + cross.col * across,
          y,
          centerZ + direction.row * forward + cross.row * across,
        ],
        radius,
        height,
      );
    }
  }

  #addWaterfallMist(waterfall, cols, rows, terminal, riverKind) {
    const lava = riverKind === RIVER_KIND.LAVA;
    const direction = this.#directionVector(waterfall.direction);
    const cross = { col: -direction.row, row: direction.col };
    const col = waterfall.col ?? waterfall.from.col;
    const row = waterfall.row ?? waterfall.from.row;
    const centerX = col - (cols - 1) / 2;
    const centerZ = row - (rows - 1) / 2;
    const forward = 0.57;
    const scale = terminal ? 1 : 0.82;
    const mistElevation = terminal
      ? waterfall.bottomElevation +
        (waterfall.topElevation - waterfall.bottomElevation) * 0.17
      : waterfall.bottomElevation + 0.12;
    const root = new this.#pc.Entity(
      lava ? 'Lavafall impact smoke' : 'Waterfall impact spray',
    );
    root.setLocalPosition(
      centerX + direction.col * forward,
      mistElevation,
      centerZ + direction.row * forward,
    );
    this.entity.addChild(root);

    const mist = new this.#pc.Entity(
      lava ? 'Lavafall smoke' : 'Waterfall mist',
    );
    mist.addComponent('particlesystem', {
      numParticles: terminal ? 32 : 12,
      lifetime: 1.7,
      rate: terminal ? 0.04 : 0.07,
      rate2: terminal ? 0.065 : 0.11,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1,
      depthWrite: false,
      noFog: true,
      sort: this.#pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.#pc.BLEND_NORMAL,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(
        (Math.abs(cross.col) * 0.46 + Math.abs(direction.col) * 0.1) *
          scale,
        0.025,
        (Math.abs(cross.row) * 0.46 + Math.abs(direction.row) * 0.1) *
          scale,
      ),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.#mistTexture,
      orientation: this.#pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [
          0,
          (direction.col * 0.08 - cross.col * 0.24) * scale,
          1,
          (direction.col * 0.22 - cross.col * 0.42) * scale,
        ],
        [0, 0.06 * scale, 0.45, 0.36 * scale, 1, 0.18 * scale],
        [
          0,
          (direction.row * 0.08 - cross.row * 0.24) * scale,
          1,
          (direction.row * 0.22 - cross.row * 0.42) * scale,
        ],
      ),
      localVelocityGraph2: this.#curveSet(
        [
          0,
          (direction.col * 0.14 + cross.col * 0.24) * scale,
          1,
          (direction.col * 0.28 + cross.col * 0.42) * scale,
        ],
        [0, 0.12 * scale, 0.45, 0.5 * scale, 1, 0.22 * scale],
        [
          0,
          (direction.row * 0.14 + cross.row * 0.24) * scale,
          1,
          (direction.row * 0.28 + cross.row * 0.42) * scale,
        ],
      ),
      scaleGraph: this.#curve([
        0,
        0.14 * scale,
        0.22,
        0.36 * scale,
        0.72,
        0.58 * scale,
        1,
        0.72 * scale,
      ]),
      scaleGraph2: this.#curve([
        0,
        0.11 * scale,
        0.25,
        0.3 * scale,
        0.75,
        0.5 * scale,
        1,
        0.66 * scale,
      ]),
      colorGraph: lava
        ? this.#curveSet(
            [0, 0.35, 0.45, 0.18, 1, 0.08],
            [0, 0.08, 0.45, 0.055, 1, 0.045],
            [0, 0.015, 0.45, 0.02, 1, 0.025],
          )
        : this.#curveSet(
            [0, 0.78, 0.45, 0.9, 1, 0.7],
            [0, 0.94, 0.45, 0.99, 1, 0.88],
            [0, 1, 0.45, 1, 1, 0.98],
          ),
      alphaGraph: this.#curve([
        0,
        0,
        0.1,
        0.52,
        0.5,
        0.34,
        1,
        0,
      ]),
      startAngle: -35,
      startAngle2: 35,
      rotationSpeedGraph: this.#curve([0, -12, 1, 16]),
      rotationSpeedGraph2: this.#curve([0, 15, 1, -18]),
    });
    root.addChild(mist);

    const spray = new this.#pc.Entity(
      lava ? 'Lavafall sparks' : 'Waterfall spray droplets',
    );
    spray.addComponent('particlesystem', {
      numParticles: terminal ? 14 : 8,
      lifetime: 0.52,
      rate: terminal ? 0.035 : 0.06,
      rate2: terminal ? 0.07 : 0.1,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1.08,
      depthWrite: false,
      noFog: true,
      sort: this.#pc.PARTICLESORT_OLDER_FIRST,
      blendType: this.#pc.BLEND_NORMAL,
      stretch: 0.13 * scale,
      alignToMotion: true,
      emitterShape: this.#pc.EMITTERSHAPE_BOX,
      emitterExtents: new this.#pc.Vec3(
        Math.abs(cross.col) * 0.34 * scale + 0.03,
        0.02,
        Math.abs(cross.row) * 0.34 * scale + 0.03,
      ),
      initialVelocity: 0,
      localSpace: true,
      colorMap: this.#mistTexture,
      orientation: this.#pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: this.#curveSet(
        [0, -cross.col * 0.7 * scale, 1, direction.col * 0.16],
        [0, 0.85 * scale, 1, -0.28 * scale],
        [0, -cross.row * 0.7 * scale, 1, direction.row * 0.16],
      ),
      localVelocityGraph2: this.#curveSet(
        [0, cross.col * 0.7 * scale, 1, direction.col * 0.28],
        [0, 1.2 * scale, 1, -0.4 * scale],
        [0, cross.row * 0.7 * scale, 1, direction.row * 0.28],
      ),
      scaleGraph: this.#curve([0, 0.035 * scale, 0.6, 0.025, 1, 0]),
      scaleGraph2: this.#curve([0, 0.055 * scale, 0.6, 0.04, 1, 0]),
      colorGraph: lava
        ? this.#curveSet(
            [0, 1, 0.5, 1, 1, 0.52],
            [0, 0.58, 0.5, 0.16, 1, 0.025],
            [0, 0.04, 0.5, 0.005, 1, 0],
          )
        : this.#curveSet(
            [0, 0.72, 1, 0.92],
            [0, 0.93, 1, 1],
            [0, 1, 1, 1],
          ),
      alphaGraph: this.#curve([0, 0, 0.08, 0.85, 0.7, 0.55, 1, 0]),
    });
    root.addChild(spray);
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

  #addDroplet(group, center, radius, height) {
    const top = [center[0], center[1] + height / 2, center[2]];
    const bottom = [center[0], center[1] - height / 2, center[2]];
    const ring = [
      [center[0] - radius, center[1], center[2]],
      [center[0], center[1], center[2] - radius],
      [center[0] + radius, center[1], center[2]],
      [center[0], center[1], center[2] + radius],
    ];
    for (let index = 0; index < ring.length; index++) {
      const next = ring[(index + 1) % ring.length];
      this.#addTriangle(group, [top, ring[index], next], [0, 1, 0]);
      this.#addTriangle(group, [bottom, next, ring[index]], [0, -1, 0]);
    }
  }

  #addTriangle(group, points, normal, colors = null) {
    const start = group.positions.length / 3;
    for (let index = 0; index < points.length; index++) {
      group.positions.push(...points[index]);
      group.normals.push(...normal);
      group.colors.push(...(colors?.[index] ?? [0, 0, 0, 0]));
      group.uvs.push(index === 1 ? 1 : 0, index === 2 ? 1 : 0);
    }
    group.indices.push(start, start + 1, start + 2);
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
            [column / columnSegments, row / rowSegments],
            weld,
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

  #waterfallVertexColor(
    row,
    widthIndex,
    lipSlices,
    curtainSegments,
    widthSegments,
    terminal,
  ) {
    const across = Math.round((widthIndex / widthSegments) * 255);
    const lipProgress = Math.min(1, row / lipSlices);
    const fallProgress = Math.max(
      0,
      Math.min(1, (row - lipSlices) / curtainSegments),
    );
    let opacity = 1;
    if (terminal) {
      const fadeProgress = Math.max(
        0,
        Math.min(1, (fallProgress - 0.72) / 0.28),
      );
      const smoothFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
      opacity = 1 - smoothFade;
    }
    return [
      across,
      Math.round(fallProgress * 255),
      Math.round(lipProgress * 255),
      Math.round(opacity * 255),
    ];
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
