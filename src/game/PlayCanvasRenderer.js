import earthSideUrl from "src/assets/game/tiles/earth-side.png";
import grassSideUrl from "src/assets/game/tiles/grass-side.png";
import grassTopUrl from "src/assets/game/tiles/grass-top.png";
import pathSideUrl from "src/assets/game/tiles/path-sandstone-side.png";
import pathTopUrl from "src/assets/game/tiles/path-sandstone-top.png";
import waterSideUrl from "src/assets/game/tiles/water-side.png";
import waterTopUrl from "src/assets/game/tiles/water-top.png";
import { Castle } from "./objects/castle/index.js";
import {
  GATEWAY_BANNER_SIGNS,
  GATEWAY_COLORS,
  Gateway,
} from "./objects/gateway/index.js";
import { PathArrows } from "./objects/path/index.js";
import { Hero } from "./objects/hero/index.js";
import { TileType } from "./MapGenerator.js";
import { GRASS_SURFACE_LIFT } from "./config/terrain.js";

const FIXED_HEIGHTS = {
  [TileType.WATER]: 0,
};

const TEXTURE_URLS = {
  grass: grassTopUrl,
  path: pathTopUrl,
  water: waterTopUrl,
  earthSide: earthSideUrl,
  grassSide: grassSideUrl,
  pathSide: pathSideUrl,
  waterSide: waterSideUrl,
};

const MATERIAL_DEFINITIONS = {
  earth: { color: 0xe8c4a0, texture: "earthSide", gloss: 0.08 },
  grass: { color: 0xffffff, texture: "grass", gloss: 0.05 },
  path: { color: 0xe8d6b5, texture: "path", gloss: 0.05 },
  water: { color: 0xd8f2ff, texture: "water", gloss: 0.22 },
};

const SIDE_VARIANT_DEFINITIONS = {
  earthSide: {
    texture: "earthSide",
    colors: [0xe8c4a0, 0xf0cbaa, 0xddb894, 0xebc09c, 0xe4bd99, 0xf2ceb0],
    gloss: 0.08,
  },
  grassSide: {
    texture: "grassSide",
    colors: [0xffffff, 0xf9f5ee, 0xf2f7ed, 0xf8fbf5, 0xf5f1e9, 0xfbf8f2],
    gloss: 0.05,
  },
  pathSide: {
    texture: "pathSide",
    colors: [0xead8b9, 0xe2ceb0, 0xecd5b4, 0xdcc6a7, 0xe8d1b0, 0xdfc9a9],
    gloss: 0.04,
  },
  waterSide: {
    texture: "waterSide",
    colors: [0xd8f2ff, 0xcfeaff, 0xe0f5ff, 0xc9e7ff, 0xd5efff, 0xdff7ff],
    gloss: 0.18,
  },
};

const SIDE_VARIANT_TRANSFORMS = [
  { startU: 0, scaleU: 0.72, flipU: false },
  { startU: 0.14, scaleU: 0.72, flipU: true },
  { startU: 0.28, scaleU: 0.72, flipU: false },
  { startU: 0, scaleU: 0.72, flipU: true },
  { startU: 0.14, scaleU: 0.72, flipU: false },
  { startU: 0.28, scaleU: 0.72, flipU: true },
];

const GRASS_TOP_VARIANTS = [
  { color: 0xffffff, startU: 0.02, startV: 0.02, flipU: false },
  { color: 0xfafcf6, startU: 0.34, startV: 0.02, flipU: true },
  { color: 0xf4f8f0, startU: 0.66, startV: 0.02, flipU: false },
  { color: 0xfffffb, startU: 0.02, startV: 0.34, flipU: true },
  { color: 0xf7fbf4, startU: 0.34, startV: 0.34, flipU: false },
  { color: 0xf1f6ee, startU: 0.66, startV: 0.34, flipU: true },
  { color: 0xfbfef8, startU: 0.02, startV: 0.66, flipU: false },
  { color: 0xf5f9f2, startU: 0.34, startV: 0.66, flipU: true },
  { color: 0xfdfbf5, startU: 0.66, startV: 0.66, flipU: false },
].map((variant) => ({ ...variant, scaleU: 0.32, scaleV: 0.32 }));

const SURFACE_MATERIALS = {
  [TileType.GRASS]: "grass",
  [TileType.PATH]: "path",
  [TileType.WATER]: "water",
  [TileType.ENTRY]: "path",
};

const SIDE_MATERIALS = {
  [TileType.GRASS]: "grassSide",
  [TileType.PATH]: "pathSide",
  [TileType.WATER]: "waterSide",
  [TileType.ENTRY]: "pathSide",
};

const CUBE_SCALE = 1;
const CAMERA_PITCH = Math.atan(1 / Math.sqrt(2));
const CAMERA_DISTANCE = 80;
const MAP_FIT_ZOOM = 1;
const HERO_VIEWPORT_MARGIN = 32;
const HERO_CAMERA_CENTER_HEIGHT = 0.85;

function colorFromHex(pc, value) {
  return new pc.Color(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  );
}

export class PlayCanvasRenderer {
  #pc = null;
  #app = null;
  #camera = null;
  #mapRoot = null;
  #mapData = null;
  #cubeMeshes = null;
  #materials = new Map();
  #textureAssets = [];
  #vertexBuffers = [];
  #zoom = 1;
  #rotation = 0;
  #panX = 0;
  #panZ = 0;
  #viewportManuallyMoved = false;
  #baseOrthoHeight = 24;
  #pathArrows = null;
  #gateways = [];
  #castle = null;
  #hero = null;
  #gatewayColors = [...GATEWAY_COLORS];
  #bannerWindTarget = null;
  #bannerWindPointerId = null;
  #bannerWindLastTime = 0;
  #bannerInteractionConnected = false;

  constructor(canvas, container) {
    this.canvas = canvas;
    this.container = container;
  }

  async init() {
    this.#pc = await import("playcanvas");
    const pc = this.#pc;

    this.#app = new pc.Application(this.canvas, {
      graphicsDeviceOptions: {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      },
    });
    this.#app.setCanvasFillMode(pc.FILLMODE_NONE);
    this.#app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.#app.graphicsDevice.maxPixelRatio = Math.min(
      window.devicePixelRatio || 1,
      2,
    );

    this.#app.scene.ambientLight = new pc.Color(0.5, 0.57, 0.64);
    this.#cubeMeshes = this.#createCubeMeshes();
    this.#pathArrows = new PathArrows({
      pc,
      app: this.#app,
      colors: this.#gatewayColors,
    });

    this.#camera = new pc.Entity("Isometric camera");
    this.#camera.addComponent("camera", {
      clearColor: new pc.Color(0.055, 0.45, 0.72),
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      nearClip: 0.1,
      farClip: 250,
    });
    this.#app.root.addChild(this.#camera);

    const sunlight = new pc.Entity("Sunlight");
    sunlight.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 0.93, 0.8),
      intensity: 2.1,
      castShadows: false,
    });
    sunlight.setEulerAngles(48, 132, 0);
    this.#app.root.addChild(sunlight);

    await this.#createMaterials();
    this.resize();
    this.#app.start();
    this.#connectBannerInteraction();
  }

  render(mapData) {
    this.#mapData = mapData;
    this.#zoom = 1;
    this.#rotation = 0;
    this.#panX = 0;
    this.#panZ = 0;
    this.#viewportManuallyMoved = false;
    this.#rebuildScene();
    this.#fitCamera();
    this.#updateCamera();
  }

  setArrowsVisible(visible) {
    this.#pathArrows?.setVisible(visible);
  }

  getArrowsVisible() {
    return this.#pathArrows?.visible ?? false;
  }

  getZoom() {
    return this.#zoom;
  }

  getRotation() {
    return this.#rotation;
  }

  getGatewayColor(index = 0) {
    return this.#gatewayColors[index % this.#gatewayColors.length];
  }

  setGatewayColor(color, index = 0) {
    const paletteIndex = index % this.#gatewayColors.length;
    this.#gatewayColors[paletteIndex] = color;
    this.#gateways[index]?.setColor(color);
    this.#pathArrows?.setColor(paletteIndex, color);
  }

  setGatewayColors(colors) {
    if (!Array.isArray(colors) || colors.length === 0) return;
    this.#gatewayColors = [...colors];
    this.#gateways.forEach((gateway, index) => {
      const color = colors[index % colors.length];
      gateway.setColor(color);
    });
    this.#pathArrows?.setColors(colors);
  }

  getViewport() {
    return {
      zoom: this.#zoom,
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
      manuallyMoved: this.#viewportManuallyMoved,
    };
  }

  setHeroMovement(screenX, screenY, running = false) {
    this.#hero?.setMovement(screenX, screenY, running);
  }

  jumpHero() {
    this.#hero?.jump();
  }

  setViewport({
    zoom,
    rotation = 0,
    panX = 0,
    panZ = 0,
    manuallyMoved = false,
  }) {
    this.#zoom = zoom;
    this.#rotation = rotation;
    this.#panX = panX;
    this.#panZ = panZ;
    this.#viewportManuallyMoved = manuallyMoved;
    this.#updateCamera();
  }

  zoomTo(newZoom, pivotX, pivotY) {
    const before = this.#screenOffsetToGround(pivotX, pivotY, this.#zoom);
    const after = this.#screenOffsetToGround(pivotX, pivotY, newZoom);
    this.#panX += before.x - after.x;
    this.#panZ += before.z - after.z;
    this.#zoom = newZoom;
    this.#updateCamera();
  }

  panBy(deltaX, deltaY) {
    const offset = this.#screenDeltaToGround(deltaX, deltaY, this.#zoom);
    this.#panX -= offset.x;
    this.#panZ -= offset.z;
    this.#viewportManuallyMoved = true;
    this.#updateCamera();
  }

  rotateBy(quarterTurns) {
    this.#rotation = (((this.#rotation + quarterTurns) % 4) + 4) % 4;
    this.#updateCamera();
    return this.#rotation;
  }

  resize() {
    if (!this.#app || !this.container) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.#app.resizeCanvas(width, height);
    this.#fitCamera();
    this.#updateCamera();
  }

  getCanvas() {
    return this.canvas;
  }

  destroy() {
    this.#disconnectBannerInteraction();
    this.#clearScene();
    this.#pathArrows?.destroy();
    this.#pathArrows = null;
    for (const material of this.#materials.values()) material.destroy();
    this.#materials.clear();
    for (const asset of this.#textureAssets) {
      asset.unload();
      this.#app?.assets.remove(asset);
    }
    this.#textureAssets = [];
    if (this.#cubeMeshes) {
      this.#destroyMesh(this.#cubeMeshes.sides);
      this.#destroyMesh(this.#cubeMeshes.underlay);
      for (const mesh of Object.values(this.#cubeMeshes.surfaces)) {
        this.#destroyMesh(mesh);
      }
    }
    this.#cubeMeshes = null;
    this.#app?.destroy();
    this.#app = null;
  }

  async #createMaterials() {
    const textures = new Map();
    await Promise.all(
      Object.entries(TEXTURE_URLS).map(async ([name, url]) => {
        textures.set(name, await this.#loadTexture(name, url));
      }),
    );
    for (const [name, definition] of Object.entries(MATERIAL_DEFINITIONS)) {
      this.#materials.set(
        name,
        this.#createMaterial(name, definition, textures),
      );
    }

    for (const [name, definition] of Object.entries(SIDE_VARIANT_DEFINITIONS)) {
      SIDE_VARIANT_TRANSFORMS.forEach((transform, index) => {
        const variantName = `${name}-${index}`;
        this.#materials.set(
          variantName,
          this.#createMaterial(
            variantName,
            {
              ...definition,
              ...transform,
              color: definition.colors[index],
            },
            textures,
          ),
        );
      });
    }

    GRASS_TOP_VARIANTS.forEach((variant, index) => {
      const name = `grass-${index}`;
      this.#materials.set(
        name,
        this.#createMaterial(
          name,
          { ...MATERIAL_DEFINITIONS.grass, ...variant },
          textures,
        ),
      );
    });
  }

  #createMaterial(name, definition, textures = new Map()) {
    const pc = this.#pc;
    const material = new pc.StandardMaterial();
    material.name = name;
    material.diffuse = colorFromHex(pc, definition.color);
    material.gloss = definition.gloss ?? 0.08;
    material.metalness = 0;
    material.useMetalness = true;
    material.useLighting = definition.useLighting ?? true;
    if (definition.texture) {
      material.diffuseMap = textures.get(definition.texture) ?? null;
      if (definition.scaleU || definition.scaleV) {
        const scaleU = definition.scaleU ?? 1;
        const scaleV = definition.scaleV ?? 1;
        const tilingU = definition.flipU ? -scaleU : scaleU;
        const offsetU = definition.flipU
          ? definition.startU + scaleU
          : definition.startU;
        material.diffuseMapTiling = new pc.Vec2(tilingU, scaleV);
        material.diffuseMapOffset = new pc.Vec2(
          offsetU,
          definition.startV === undefined ? 0 : 1 - scaleV - definition.startV,
        );
      }
    }
    if (definition.emissive) {
      material.emissive = colorFromHex(pc, definition.emissive);
      material.emissiveIntensity = definition.emissiveIntensity ?? 0.45;
    }
    material.update();
    return material;
  }

  #loadTexture(name, url) {
    const pc = this.#pc;
    const asset = new pc.Asset(name, "texture", { url });
    this.#textureAssets.push(asset);
    this.#app.assets.add(asset);

    return new Promise((resolve, reject) => {
      asset.ready((loadedAsset) => {
        loadedAsset.resource.anisotropy = 8;
        loadedAsset.resource.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        loadedAsset.resource.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        resolve(loadedAsset.resource);
      });
      asset.once("error", reject);
      this.#app.assets.load(asset);
    });
  }

  #rebuildScene() {
    this.#clearScene();
    this.#mapRoot = new this.#pc.Entity("Voxel map");
    this.#app.root.addChild(this.#mapRoot);

    const cubeBatches = new Map();
    this.#buildTerrainMatrices(cubeBatches);
    this.#createInstancedBatches(cubeBatches, this.#mapRoot, false);
    this.#buildCastle();
    this.#buildGateways();
    this.#buildHero();

    this.#mapRoot.addChild(this.#pathArrows.render(this.#mapData));
  }

  #buildHero() {
    this.#hero = new Hero({
      pc: this.#pc,
      app: this.#app,
      mapData: this.#mapData,
      getViewRotation: () => this.#rotation,
      onPositionChange: this.#handleHeroPositionChange,
      isStructureBlocked: (x, z, radius) =>
        this.#castle?.intersectsGroundFootprint(x, z, radius) ?? false,
      getStructureSurfaceHeight: (x, z) =>
        this.#castle?.surfaceHeightAt(x, z) ?? null,
      isGatewayBlocked: (x, z, radius) =>
        this.#gateways.some((gateway) =>
          gateway.intersectsGroundFootprint(x, z, radius),
        ),
    });
    this.#mapRoot.addChild(this.#hero.entity);
  }

  #buildGateways() {
    const { entries = [], cols, rows } = this.#mapData;
    const signs = [...GATEWAY_BANNER_SIGNS];
    for (let index = signs.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [signs[index], signs[swapIndex]] = [signs[swapIndex], signs[index]];
    }
    entries.forEach((entry, index) => {
      const gateRows = entry.rows ?? [entry.row, entry.row + 1];
      const x = entry.col - (cols - 1) / 2;
      const z =
        gateRows.reduce((sum, row) => sum + row, 0) / gateRows.length -
        (rows - 1) / 2;
      const groundHeight = Math.max(
        ...gateRows.map((row) => this.#tileHeight(entry.col, row)),
      );
      const gateway = new Gateway({
        pc: this.#pc,
        app: this.#app,
        color: entry.color ?? this.getGatewayColor(index),
        cubeSize: CUBE_SCALE / 4,
        symbol: signs[index % signs.length],
      });
      this.#pathArrows.setColor(
        index,
        entry.color ?? this.getGatewayColor(index),
      );
      gateway.entity.setPosition(x, groundHeight, z);
      if (entry.side === "RIGHT") gateway.entity.setEulerAngles(0, 180, 0);
      this.#mapRoot.addChild(gateway.entity);
      this.#gateways.push(gateway);
    });
  }

  #buildCastle() {
    const { castle, cols, rows, heightmap } = this.#mapData;
    if (!castle?.position || !castle.doors?.length) return;

    this.#castle = new Castle({
      pc: this.#pc,
      app: this.#app,
      position: {
        x: castle.position.col - (cols - 1) / 2 - CUBE_SCALE / 2,
        z: castle.position.row - (rows - 1) / 2 - CUBE_SCALE / 2,
        width: castle.position.width,
        depth: castle.position.depth,
        elevation: castle.position.elevation,
      },
      doors: castle.doors.map(({ side, offset, width, cells = [] }) => {
        const approachElevations = cells
          .map(({ col, row }) => heightmap?.[row]?.[col])
          .filter(Number.isFinite);
        return {
          side,
          offset,
          width,
          approachElevation: approachElevations.length
            ? Math.max(...approachElevations)
            : castle.position.elevation,
        };
      }),
      occupant: castle.occupant,
    });
    this.#mapRoot.addChild(this.#castle.entity);
  }

  #buildTerrainMatrices(batches) {
    const { grid, heightmap, tileMeta, cols, rows } = this.#mapData;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const type = grid[row][col];
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        const renderMode = tileMeta?.[row]?.[col]?.renderMode ?? "SOLID";
        const height =
          type in FIXED_HEIGHTS ? FIXED_HEIGHTS[type] : heightmap[row][col];

        if (type === TileType.WATER || renderMode === "BRIDGE") {
          this.#addCubeMatrix(
            batches,
            "water",
            this.#sideVariant("waterSide", col, row, -1),
            x,
            -0.5,
            z,
          );
        }

        if (type === TileType.WATER) continue;

        if (renderMode === "BRIDGE") {
          this.#addCubeMatrix(
            batches,
            SURFACE_MATERIALS[type],
            this.#sideVariant(SIDE_MATERIALS[type], col, row, height - 1),
            x,
            height - 0.5,
            z,
            "full",
            "earth",
          );
          continue;
        }

        for (let level = 0; level < height; level += 1) {
          const topCube = level === height - 1;
          const { top, sides, underlay } = this.#cubeMaterials(
            type,
            topCube,
            col,
            row,
            level,
          );
          this.#addCubeMatrix(
            batches,
            top,
            sides,
            x,
            level + 0.5,
            z,
            this.#surfaceCoverage(type, col, row, topCube),
            underlay,
            topCube && type === TileType.GRASS ? GRASS_SURFACE_LIFT : 0,
          );
        }
      }
    }
  }

  #cubeMaterials(type, topCube, col, row, level) {
    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      if (!topCube) {
        return {
          top: "earth",
          sides: this.#sideVariant("earthSide", col, row, level),
          underlay: "earth",
        };
      }
      return {
        top: `grass-${this.#variantIndex(col, row, level, 11, GRASS_TOP_VARIANTS.length)}`,
        sides: this.#sideVariant("grassSide", col, row, level),
        underlay: "earth",
      };
    }
    if (!topCube) {
      return {
        top: "earth",
        sides: this.#sideVariant("earthSide", col, row, level),
        underlay: "earth",
      };
    }
    return {
      top:
        type === TileType.GRASS
          ? `grass-${this.#variantIndex(col, row, level, 11, GRASS_TOP_VARIANTS.length)}`
          : SURFACE_MATERIALS[type],
      sides: this.#sideVariant(SIDE_MATERIALS[type], col, row, level),
      underlay: type === TileType.WATER ? "water" : "earth",
    };
  }

  #sideVariant(material, col, row, level) {
    if (material === "castleWall" || material === "castleTower") {
      return material;
    }
    const index = this.#variantIndex(
      col,
      row,
      level,
      37,
      SIDE_VARIANT_TRANSFORMS.length,
    );
    return `${material}-${index}`;
  }

  #variantIndex(col, row, level, salt, count) {
    const hash =
      Math.imul(col + 17, 73856093) ^
      Math.imul(row + 31, 19349663) ^
      Math.imul(level + 7, 83492791) ^
      salt;
    return (hash >>> 0) % count;
  }

  #surfaceCoverage(type) {
    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      return "block";
    }
    return "full";
  }

  #tileHeight(col, row) {
    const type = this.#mapData.grid[row][col];
    return type in FIXED_HEIGHTS
      ? FIXED_HEIGHTS[type]
      : this.#mapData.heightmap[row][col];
  }

  #addCubeMatrix(
    batches,
    topMaterial,
    sideMaterial,
    x,
    y,
    z,
    coverage = "full",
    underlayMaterial = sideMaterial,
    surfaceLift = 0,
  ) {
    this.#addBoxMatrix(
      batches,
      topMaterial,
      sideMaterial,
      x,
      y + surfaceLift / 2,
      z,
      0,
      CUBE_SCALE,
      CUBE_SCALE + surfaceLift,
      CUBE_SCALE,
      coverage,
      underlayMaterial,
    );
  }

  #addBoxMatrix(
    batches,
    topMaterial,
    sideMaterial,
    x,
    y,
    z,
    yaw,
    sx,
    sy,
    sz,
    coverage = "full",
    underlayMaterial = sideMaterial,
  ) {
    const pc = this.#pc;
    const matrix = new pc.Mat4();
    const rotation = new pc.Quat();
    rotation.setFromEulerAngles(0, yaw, 0);
    matrix.setTRS(new pc.Vec3(x, y, z), rotation, new pc.Vec3(sx, sy, sz));
    const materialBatch = `${topMaterial}|${sideMaterial}|${underlayMaterial}|${coverage}`;
    const data = batches.get(materialBatch) ?? [];
    for (const value of matrix.data) data.push(value);
    batches.set(materialBatch, data);
  }

  #createInstancedBatches(batches, root, castsShadows) {
    const pc = this.#pc;
    for (const [materialBatch, matrices] of batches.entries()) {
      if (matrices.length === 0) continue;
      const [topMaterial, sideMaterial, underlayMaterial, coverage] =
        materialBatch.split("|");
      const batchCastsShadows = castsShadows;
      const instanceCount = matrices.length / 16;
      const vertexBuffer = new pc.VertexBuffer(
        this.#app.graphicsDevice,
        pc.VertexFormat.getDefaultInstancingFormat(this.#app.graphicsDevice),
        instanceCount,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const entity = new pc.Entity(`${topMaterial}/${sideMaterial} cubes`);
      const sideMeshInstance = new pc.MeshInstance(
        this.#cubeMeshes.sides,
        this.#materials.get(sideMaterial),
      );
      const topMeshInstance = new pc.MeshInstance(
        this.#cubeMeshes.surfaces[coverage],
        this.#materials.get(topMaterial),
      );
      const underlayMeshInstance = new pc.MeshInstance(
        this.#cubeMeshes.underlay,
        this.#materials.get(underlayMaterial),
      );
      entity.addComponent("render", {
        meshInstances: [
          sideMeshInstance,
          underlayMeshInstance,
          topMeshInstance,
        ],
        castShadows: batchCastsShadows,
        receiveShadows: true,
      });
      for (const meshInstance of [
        sideMeshInstance,
        underlayMeshInstance,
        topMeshInstance,
      ]) {
        meshInstance.setInstancing(vertexBuffer, false);
        meshInstance.castShadow = batchCastsShadows;
        meshInstance.receiveShadow = true;
      }
      root.addChild(entity);
    }
  }

  #createCubeMeshes() {
    const pc = this.#pc;
    const groups = {
      underlay: { positions: [], normals: [], uvs: [], indices: [] },
      sides: { positions: [], normals: [], uvs: [], indices: [] },
      full: { positions: [], normals: [], uvs: [], indices: [] },
      block: { positions: [], normals: [], uvs: [], indices: [] },
    };
    const half = 0.5;
    const inner = 0.49;

    const addFace = (groupName, sourcePoints) => {
      const group = groups[groupName];
      const points = sourcePoints.map((point) => [...point]);
      const edgeA = points[1].map((value, axis) => value - points[0][axis]);
      const edgeB = points[2].map((value, axis) => value - points[0][axis]);
      let normal = [
        edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
        edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
        edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0],
      ];
      const center = [0, 1, 2].map(
        (axis) =>
          points.reduce((sum, point) => sum + point[axis], 0) / points.length,
      );
      if (
        normal.reduce((sum, value, axis) => sum + value * center[axis], 0) < 0
      ) {
        points.reverse();
        normal = normal.map((value) => -value);
      }
      const normalLength = Math.hypot(...normal);
      normal = normal.map((value) => value / normalLength);

      const start = group.positions.length / 3;
      const xRange =
        Math.max(...points.map((point) => point[0])) -
        Math.min(...points.map((point) => point[0]));
      const zRange =
        Math.max(...points.map((point) => point[2])) -
        Math.min(...points.map((point) => point[2]));
      const horizontalAxis = xRange >= zRange ? 0 : 2;
      const minX = Math.min(...points.map((point) => point[0]));
      const maxX = Math.max(...points.map((point) => point[0]));
      const minZ = Math.min(...points.map((point) => point[2]));
      const maxZ = Math.max(...points.map((point) => point[2]));
      points.forEach((point) => {
        group.positions.push(...point);
        group.normals.push(...normal);
        if (groupName !== "sides") {
          group.uvs.push(
            (point[0] - minX) / Math.max(0.001, maxX - minX),
            (point[2] - minZ) / Math.max(0.001, maxZ - minZ),
          );
        } else {
          group.uvs.push(point[horizontalAxis] + half, half - point[1]);
        }
      });
      for (let index = 1; index < points.length - 1; index += 1) {
        group.indices.push(start, start + index, start + index + 1);
      }
    };

    for (const sign of [-1, 1]) {
      addFace("sides", [
        [sign * half, -inner, -inner],
        [sign * half, half, -inner],
        [sign * half, half, inner],
        [sign * half, -inner, inner],
      ]);
      addFace(sign === 1 ? "underlay" : "sides", [
        [-inner, sign * half, -inner],
        [-inner, sign * half, inner],
        [inner, sign * half, inner],
        [inner, sign * half, -inner],
      ]);
      addFace("sides", [
        [-inner, -inner, sign * half],
        [inner, -inner, sign * half],
        [inner, half, sign * half],
        [-inner, half, sign * half],
      ]);
    }

    const axisPairs = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 2, 0],
    ];
    for (const [axisA, axisB, freeAxis] of axisPairs) {
      for (const signA of [-1, 1]) {
        for (const signB of [-1, 1]) {
          const point = (onAxis, freeValue) => {
            const result = [0, 0, 0];
            result[axisA] = signA * (onAxis === axisA ? half : inner);
            result[axisB] = signB * (onAxis === axisB ? half : inner);
            result[freeAxis] = freeValue;
            const touchesTopEdge =
              (axisA === 1 && signA === 1) ||
              (axisB === 1 && signB === 1) ||
              (freeAxis === 1 && freeValue === inner);
            if (touchesTopEdge) result[1] = half;
            return result;
          };
          addFace("sides", [
            point(axisA, -inner),
            point(axisA, inner),
            point(axisB, inner),
            point(axisB, -inner),
          ]);
        }
      }
    }

    for (const signX of [-1, 1]) {
      for (const signY of [-1, 1]) {
        for (const signZ of [-1, 1]) {
          addFace("sides", [
            [signX * half, signY === 1 ? half : -inner, signZ * inner],
            [signX * inner, signY * half, signZ * inner],
            [signX * inner, signY === 1 ? half : -inner, signZ * half],
          ]);
        }
      }
    }

    const surfaceY = half + 0.0002;
    addFace("full", [
      [-half, surfaceY, -half],
      [-half, surfaceY, half],
      [half, surfaceY, half],
      [half, surfaceY, -half],
    ]);
    addFace("block", [
      [-inner, surfaceY, -inner],
      [-inner, surfaceY, inner],
      [inner, surfaceY, inner],
      [inner, surfaceY, -inner],
    ]);

    const createMesh = (group) => {
      const geometry = new pc.Geometry();
      geometry.positions = group.positions;
      geometry.normals = group.normals;
      geometry.uvs = group.uvs;
      geometry.indices = group.indices;
      const mesh = pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
      mesh.incRefCount();
      return mesh;
    };

    return {
      sides: createMesh(groups.sides),
      underlay: createMesh(groups.underlay),
      surfaces: {
        full: createMesh(groups.full),
        block: createMesh(groups.block),
      },
    };
  }

  #destroyMesh(mesh) {
    mesh.decRefCount();
    if (mesh.refCount < 1) mesh.destroy();
  }

  #fitCamera() {
    if (!this.#mapData || !this.#camera) return;
    const aspect = Math.max(0.35, this.canvas.width / this.canvas.height);
    const { cols, rows } = this.#mapData;
    const maxHeight = 9;
    const halfWidth = (cols + rows) / (2 * Math.sqrt(2)) + 1;
    const halfHeight =
      ((cols + rows) * Math.sin(CAMERA_PITCH)) / (2 * Math.sqrt(2)) +
      maxHeight * Math.cos(CAMERA_PITCH) +
      1;
    this.#baseOrthoHeight = Math.max(halfHeight, halfWidth / aspect) * 0.84;
  }

  #handleHeroPositionChange = ({ x, y, z }) => {
    this.#castle?.updateHeroPosition({ x, y, z });
    const screenPosition = this.#camera.camera.worldToScreen(
      new this.#pc.Vec3(x, y + HERO_CAMERA_CENTER_HEIGHT, z),
    );
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const marginX = Math.min(HERO_VIEWPORT_MARGIN, width / 4);
    const marginY = Math.min(HERO_VIEWPORT_MARGIN, height / 4);
    const boundedX = Math.max(
      marginX,
      Math.min(width - marginX, screenPosition.x),
    );
    const boundedY = Math.max(
      marginY,
      Math.min(height - marginY, screenPosition.y),
    );
    const heroIsOutOfBounds =
      boundedX !== screenPosition.x || boundedY !== screenPosition.y;

    if (this.#viewportManuallyMoved) {
      if (!heroIsOutOfBounds) return;
      const correction = this.#screenDeltaToGround(
        screenPosition.x - boundedX,
        screenPosition.y - boundedY,
        this.#zoom,
      );
      this.#panX += correction.x;
      this.#panZ += correction.z;
    } else if (this.#zoom > MAP_FIT_ZOOM) {
      this.#panX = x;
      this.#panZ = z;
    } else if (!heroIsOutOfBounds) {
      return;
    } else {
      const correction = this.#screenDeltaToGround(
        screenPosition.x - boundedX,
        screenPosition.y - boundedY,
        this.#zoom,
      );
      this.#panX += correction.x;
      this.#panZ += correction.z;
    }
    this.#updateCamera();
  };

  #updateCamera() {
    if (!this.#camera || !this.#mapData) return;
    const yaw = Math.PI / 4 + this.#rotation * (Math.PI / 2);
    const horizontalDistance = CAMERA_DISTANCE * Math.cos(CAMERA_PITCH);
    const target = new this.#pc.Vec3(this.#panX, 3.2, this.#panZ);
    this.#camera.setPosition(
      target.x + Math.sin(yaw) * horizontalDistance,
      target.y + Math.sin(CAMERA_PITCH) * CAMERA_DISTANCE,
      target.z + Math.cos(yaw) * horizontalDistance,
    );
    this.#camera.lookAt(target);
    this.#camera.camera.orthoHeight = this.#baseOrthoHeight / this.#zoom;
  }

  #screenOffsetToGround(x, y, zoom) {
    return this.#screenDeltaToGround(
      x - this.container.clientWidth / 2,
      y - this.container.clientHeight / 2,
      zoom,
    );
  }

  #screenDeltaToGround(deltaX, deltaY, zoom) {
    const yaw = Math.PI / 4 + this.#rotation * (Math.PI / 2);
    const worldPerPixel =
      (2 * this.#baseOrthoHeight) /
      Math.max(1, this.container.clientHeight) /
      zoom;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const downX = Math.sin(yaw);
    const downZ = Math.cos(yaw);
    const verticalScale = worldPerPixel / Math.sin(CAMERA_PITCH);
    return {
      x: rightX * deltaX * worldPerPixel + downX * deltaY * verticalScale,
      z: rightZ * deltaX * worldPerPixel + downZ * deltaY * verticalScale,
    };
  }

  #connectBannerInteraction() {
    if (this.#bannerInteractionConnected || !this.canvas) return;
    this.canvas.addEventListener("pointerdown", this.#handleBannerPointerDown);
    this.canvas.addEventListener("pointermove", this.#handleBannerPointerMove);
    this.canvas.addEventListener("pointerup", this.#handleBannerPointerUp);
    this.canvas.addEventListener("pointercancel", this.#handleBannerPointerUp);
    this.#bannerInteractionConnected = true;
  }

  #disconnectBannerInteraction() {
    if (!this.#bannerInteractionConnected || !this.canvas) return;
    this.canvas.removeEventListener(
      "pointerdown",
      this.#handleBannerPointerDown,
    );
    this.canvas.removeEventListener(
      "pointermove",
      this.#handleBannerPointerMove,
    );
    this.canvas.removeEventListener("pointerup", this.#handleBannerPointerUp);
    this.canvas.removeEventListener(
      "pointercancel",
      this.#handleBannerPointerUp,
    );
    this.#finishBannerWindGesture();
    this.#bannerInteractionConnected = false;
  }

  #pointerRay(event) {
    if (!this.#camera?.camera || !this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    return {
      start: this.#camera.camera.screenToWorld(
        screenX,
        screenY,
        this.#camera.camera.nearClip,
      ),
      end: this.#camera.camera.screenToWorld(
        screenX,
        screenY,
        this.#camera.camera.farClip,
      ),
    };
  }

  #handleBannerPointerDown = (event) => {
    if (event.button !== 0 || this.#bannerWindTarget) return;
    const ray = this.#pointerRay(event);
    if (!ray) return;

    let closest = null;
    for (const gateway of this.#gateways) {
      const hit = gateway.getBannerHit(ray.start, ray.end);
      if (!hit || (closest && hit.distance >= closest.hit.distance)) continue;
      closest = { target: gateway, hit };
    }
    const castleHit = this.#castle?.getBannerHit(ray.start, ray.end);
    if (castleHit && (!closest || castleHit.distance < closest.hit.distance)) {
      closest = { target: this.#castle, hit: castleHit };
    }
    if (!closest) return;

    event.preventDefault();
    this.#bannerWindTarget = closest.target;
    this.#bannerWindPointerId = event.pointerId;
    this.#bannerWindLastTime = event.timeStamp;
    closest.target.beginWindGesture(closest.hit);
    this.canvas.setPointerCapture(event.pointerId);
  };

  #handleBannerPointerMove = (event) => {
    if (!this.#bannerWindTarget) return;
    if (event.pointerId !== this.#bannerWindPointerId) {
      return;
    }
    const ray = this.#pointerRay(event);
    if (!ray) return;

    event.preventDefault();
    const deltaTime = (event.timeStamp - this.#bannerWindLastTime) / 1000;
    this.#bannerWindLastTime = event.timeStamp;
    this.#bannerWindTarget.applyMouseWind(ray.start, ray.end, deltaTime);
  };

  #handleBannerPointerUp = (event) => {
    if (event.pointerId !== this.#bannerWindPointerId) return;
    event.preventDefault();
    this.#finishBannerWindGesture();
  };

  #finishBannerWindGesture() {
    this.#bannerWindTarget?.endWindGesture();
    if (
      this.#bannerWindPointerId !== null &&
      this.canvas?.hasPointerCapture(this.#bannerWindPointerId)
    ) {
      this.canvas.releasePointerCapture(this.#bannerWindPointerId);
    }
    this.#bannerWindTarget = null;
    this.#bannerWindPointerId = null;
    this.#bannerWindLastTime = 0;
  }

  #clearScene() {
    this.#finishBannerWindGesture();
    this.#pathArrows?.clear();
    for (const gateway of this.#gateways) gateway.destroy();
    this.#gateways = [];
    this.#castle?.destroy();
    this.#castle = null;
    this.#hero?.destroy();
    this.#hero = null;
    this.#mapRoot?.destroy();
    this.#mapRoot = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
  }
}
