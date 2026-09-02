import earthSideUrl from "src/assets/game/tiles/earth-side.png";
import grassSideUrl from "src/assets/game/tiles/grass-side.png";
import grassTopUrl from "src/assets/game/tiles/grass-top.png";
import pathSideUrl from "src/assets/game/tiles/path-side.png";
import pathTopUrl from "src/assets/game/tiles/path-top.png";
import waterSideUrl from "src/assets/game/tiles/water-side.png";
import waterTopUrl from "src/assets/game/tiles/water-top.png";
import { GATEWAY_BANNER_SIGNS } from "./GatewayBannerSign.js";
import { GATEWAY_COLORS, Gateway } from "./Gateway.js";
import { TileType } from "./MapGenerator.js";

const FIXED_HEIGHTS = {
  [TileType.WATER]: 0,
  [TileType.CASTLE_WALL]: 7,
  [TileType.CASTLE_TOWER]: 9,
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
  path: { color: 0xfff1d9, texture: "path", gloss: 0.04 },
  water: { color: 0xd8f2ff, texture: "water", gloss: 0.22 },
  castleWall: { color: 0x918e87, gloss: 0.12 },
  castleTower: { color: 0x77746f, gloss: 0.1 },
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
    colors: [0xffe2ba, 0xf6d7b0, 0xffe8c5, 0xf1cfaa, 0xfbe0bc, 0xf4d3ad],
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
  [TileType.CASTLE_WALL]: "castleWall",
  [TileType.CASTLE_TOWER]: "castleTower",
};

const SIDE_MATERIALS = {
  [TileType.GRASS]: "grassSide",
  [TileType.PATH]: "pathSide",
  [TileType.WATER]: "waterSide",
  [TileType.ENTRY]: "pathSide",
  [TileType.CASTLE_WALL]: "castleWall",
  [TileType.CASTLE_TOWER]: "castleTower",
};

const CUBE_SCALE = 1;
const CAMERA_PITCH = Math.atan(1 / Math.sqrt(2));
const CAMERA_DISTANCE = 80;
const ARROW_POINTS = [
  [-0.1, -0.32],
  [0.1, -0.32],
  [0.1, 0.04],
  [-0.1, 0.04],
  [-0.34, -0.01],
  [0.34, -0.01],
  [0, 0.43],
];
const ARROW_TRIANGLES = [
  [0, 2, 1],
  [0, 3, 2],
  [4, 6, 5],
];
const ARROW_MIN_Z = -0.32;
const ARROW_MAX_Z = 0.43;
const ARROW_MERGE_DISTANCE = 0.76;
const ARROW_COLOR_SCROLL_SPEED = 0.42;
const ARROW_GLOW_PULSE_SPEED = 4.2;

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
  #arrowRoot = null;
  #mapData = null;
  #cubeMeshes = null;
  #arrowMesh = null;
  #arrowAuraMesh = null;
  #arrowAuraTexture = null;
  #arrowSliceMeshes = new Map();
  #materials = new Map();
  #animatedArrowPalettes = new Map();
  #arrowAnimationTime = 0;
  #textureAssets = [];
  #generatedArrowTextures = [];
  #vertexBuffers = [];
  #zoom = 1;
  #rotation = 0;
  #panX = 0;
  #panZ = 0;
  #baseOrthoHeight = 24;
  #arrowsVisible = false;
  #gateways = [];
  #gatewayColors = [...GATEWAY_COLORS];
  #bannerWindGateway = null;
  #bannerWindPointerId = null;
  #bannerWindLastTime = 0;
  #gatewayInteractionConnected = false;

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
    this.#arrowMesh = this.#createArrowMesh();
    this.#arrowAuraMesh = this.#createArrowAuraMesh();
    this.#arrowAuraTexture = this.#createArrowAuraTexture();

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
    this.#app.on("update", this.#updateArrowAnimation, this);
    this.#app.start();
    this.#connectGatewayInteraction();
  }

  render(mapData) {
    this.#mapData = mapData;
    this.#zoom = 1;
    this.#rotation = 0;
    this.#panX = 0;
    this.#panZ = 0;
    this.#rebuildScene();
    this.#fitCamera();
    this.#updateCamera();
  }

  setArrowsVisible(visible) {
    this.#arrowsVisible = visible;
    if (this.#arrowRoot) this.#arrowRoot.enabled = visible;
  }

  getArrowsVisible() {
    return this.#arrowsVisible;
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
    this.#setArrowMaterialColor(paletteIndex, color);
    this.#refreshAnimatedArrowTextures();
  }

  setGatewayColors(colors) {
    if (!Array.isArray(colors) || colors.length === 0) return;
    this.#gatewayColors = [...colors];
    this.#gateways.forEach((gateway, index) => {
      const color = colors[index % colors.length];
      gateway.setColor(color);
      this.#setArrowMaterialColor(index, color);
    });
    this.#refreshAnimatedArrowTextures();
  }

  getViewport() {
    return {
      zoom: this.#zoom,
      rotation: this.#rotation,
      panX: this.#panX,
      panZ: this.#panZ,
    };
  }

  setViewport({ zoom, rotation = 0, panX = 0, panZ = 0 }) {
    this.#zoom = zoom;
    this.#rotation = rotation;
    this.#panX = panX;
    this.#panZ = panZ;
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
    this.#updateCamera();
  }

  rotateBy(quarterTurns) {
    this.#rotation = (this.#rotation + quarterTurns + 4) % 4;
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
    this.#disconnectGatewayInteraction();
    this.#app?.off("update", this.#updateArrowAnimation, this);
    this.#clearScene();
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
    if (this.#arrowMesh) this.#destroyMesh(this.#arrowMesh);
    this.#arrowMesh = null;
    if (this.#arrowAuraMesh) this.#destroyMesh(this.#arrowAuraMesh);
    this.#arrowAuraMesh = null;
    this.#arrowAuraTexture?.destroy();
    this.#arrowAuraTexture = null;
    for (const texture of this.#generatedArrowTextures) texture.destroy();
    this.#generatedArrowTextures = [];
    for (const mesh of this.#arrowSliceMeshes.values()) {
      this.#destroyMesh(mesh);
    }
    this.#arrowSliceMeshes.clear();
    this.#animatedArrowPalettes.clear();
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

    GATEWAY_COLORS.forEach((color, index) => {
      this.#materials.set(
        `arrow-${index}`,
        this.#createArrowCoreMaterial(`arrow-${index}`, color),
      );
      this.#materials.set(
        `arrow-aura-${index}`,
        this.#createArrowAuraMaterial(`arrow-aura-${index}`, color),
      );
    });
  }

  #createArrowCoreMaterial(name, color) {
    return this.#createMaterial(name, {
      color,
      emissive: color,
      emissiveIntensity: 1.45,
      gloss: 0.08,
      useLighting: false,
    });
  }

  #createArrowAuraMaterial(name, color) {
    const material = this.#createMaterial(name, {
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      gloss: 0,
      useLighting: false,
    });
    material.diffuseMap = this.#arrowAuraTexture;
    material.emissiveMap = this.#arrowAuraTexture;
    material.opacityMap = this.#arrowAuraTexture;
    material.opacityMapChannel = "a";
    material.opacity = 0.12;
    material.blendType = this.#pc.BLEND_ADDITIVE;
    material.depthWrite = false;
    material.cull = this.#pc.CULLFACE_NONE;
    material.update();
    return material;
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

  #setArrowMaterialColor(index, color) {
    for (const name of [`arrow-${index}`, `arrow-aura-${index}`]) {
      const material = this.#materials.get(name);
      if (!material) continue;
      this.#applyArrowMaterialColor(material, colorFromHex(this.#pc, color));
    }
  }

  #applyArrowMaterialColor(material, color) {
    material.diffuse = color.clone();
    material.emissive = color.clone();
    material.update();
  }

  #getAnimatedArrowMaterials(colorIndexes) {
    const key = colorIndexes.join("-");
    const existing = this.#animatedArrowPalettes.get(key);
    if (existing) return existing;

    const color = this.#averageGatewayColor(colorIndexes);
    const coreName = `arrow-scroll-${key}`;
    const auraName = `arrow-scroll-aura-${key}`;
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 128;
    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: `Arrow colors ${key}`,
      width: canvas.width,
      height: canvas.height,
      minFilter: this.#pc.FILTER_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_REPEAT,
      mipmaps: false,
    });
    this.#paintArrowScrollTexture(canvas, colorIndexes);
    texture.setSource(canvas);
    this.#generatedArrowTextures.push(texture);

    const core = this.#createArrowCoreMaterial(coreName, 0xffffff);
    core.diffuseMap = texture;
    core.emissiveMap = texture;
    core.diffuseMapTiling = new this.#pc.Vec2(1, 1.35);
    core.emissiveMapTiling = new this.#pc.Vec2(1, 1.35);
    core.diffuseMapOffset = new this.#pc.Vec2(0, 0);
    core.emissiveMapOffset = new this.#pc.Vec2(0, 0);
    core.update();
    const aura = this.#createArrowAuraMaterial(auraName, color);
    this.#materials.set(coreName, core);
    this.#materials.set(auraName, aura);
    const palette = {
      colorIndexes: [...colorIndexes],
      coreName,
      auraName,
      canvas,
      texture,
    };
    this.#animatedArrowPalettes.set(key, palette);
    return palette;
  }

  #paintArrowScrollTexture(canvas, colorIndexes) {
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    const count = colorIndexes.length;
    for (let index = 0; index < count; index++) {
      const start = index / count;
      const end = (index + 1) / count;
      const holdEnd = start + (end - start) * 0.72;
      const color = this.#gatewayColors[colorIndexes[index]];
      const nextColor = this.#gatewayColors[colorIndexes[(index + 1) % count]];
      gradient.addColorStop(start, this.#colorToCss(color));
      gradient.addColorStop(holdEnd, this.#colorToCss(color));
      gradient.addColorStop(end, this.#colorToCss(nextColor));
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  #colorToCss(color) {
    return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
  }

  #averageGatewayColor(colorIndexes) {
    const channels = colorIndexes.reduce(
      (sum, index) => {
        const color = this.#gatewayColors[index];
        sum.r += (color >> 16) & 0xff;
        sum.g += (color >> 8) & 0xff;
        sum.b += color & 0xff;
        return sum;
      },
      { r: 0, g: 0, b: 0 },
    );
    const count = colorIndexes.length;
    return (
      (Math.round(channels.r / count) << 16) |
      (Math.round(channels.g / count) << 8) |
      Math.round(channels.b / count)
    );
  }

  #refreshAnimatedArrowTextures() {
    for (const palette of this.#animatedArrowPalettes.values()) {
      this.#paintArrowScrollTexture(palette.canvas, palette.colorIndexes);
      palette.texture.upload();
      const aura = this.#materials.get(palette.auraName);
      if (aura) {
        this.#applyArrowMaterialColor(
          aura,
          colorFromHex(
            this.#pc,
            this.#averageGatewayColor(palette.colorIndexes),
          ),
        );
      }
    }
  }

  #updateArrowAnimation(dt) {
    this.#arrowAnimationTime += dt;
    const pulse = (Math.sin(this.#arrowAnimationTime * ARROW_GLOW_PULSE_SPEED) + 1) / 2;

    for (let index = 0; index < this.#gatewayColors.length; index++) {
      const core = this.#materials.get(`arrow-${index}`);
      if (core) {
        core.emissiveIntensity = 1.3 + pulse * 0.45;
        core.update();
      }
    }

    for (const palette of this.#animatedArrowPalettes.values()) {
      const core = this.#materials.get(palette.coreName);
      if (core) {
        core.emissiveIntensity = 1.35 + pulse * 0.55;
        const scrollOffset =
          (this.#arrowAnimationTime * ARROW_COLOR_SCROLL_SPEED) % 1;
        core.diffuseMapOffset.y = scrollOffset;
        core.emissiveMapOffset.y = scrollOffset;
        core.update();
      }
    }
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
    this.#buildGateways();

    this.#arrowRoot = new this.#pc.Entity("Path arrows");
    this.#arrowRoot.enabled = this.#arrowsVisible;
    this.#mapRoot.addChild(this.#arrowRoot);
    const arrowBatches = new Map();
    this.#buildArrowMatrices(arrowBatches);
    this.#createArrowInstancedBatches(arrowBatches, this.#arrowRoot);
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
      this.#setArrowMaterialColor(
        index,
        entry.color ?? this.getGatewayColor(index),
      );
      gateway.entity.setPosition(x, groundHeight, z);
      if (entry.side === "RIGHT") gateway.entity.setEulerAngles(0, 180, 0);
      this.#mapRoot.addChild(gateway.entity);
      this.#gateways.push(gateway);
    });
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
          );
        }
      }
    }
  }

  #cubeMaterials(type, topCube, col, row, level) {
    if (type === TileType.CASTLE_WALL) {
      return {
        top: "castleWall",
        sides: "castleWall",
        underlay: "castleWall",
      };
    }
    if (type === TileType.CASTLE_TOWER) {
      return {
        top: "castleTower",
        sides: "castleTower",
        underlay: "castleTower",
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

  #buildArrowMatrices(batches) {
    const { arrowData, cols, rows } = this.#mapData;
    if (!arrowData) return;

    for (const group of this.#groupNearbyArrows(arrowData)) {
      const col =
        group.reduce((sum, marker) => sum + marker.col, 0) / group.length;
      const row =
        group.reduce((sum, marker) => sum + marker.row, 0) / group.length;
      const baseX = col - (cols - 1) / 2;
      const baseZ = row - (rows - 1) / 2;
      const top = Math.max(
        ...group.map(marker => this.#arrowHeight(marker.col, marker.row)),
      );
      const arrows = group.flatMap(marker => marker.arrows);
      const directions = arrows
        .map(arrow => {
          const length = Math.hypot(arrow.dc, arrow.dr);
          return length
            ? { dx: arrow.dc / length, dz: arrow.dr / length }
            : null;
        })
        .filter(Boolean);
      if (!directions.length) continue;

      let dx = directions.reduce((sum, direction) => sum + direction.dx, 0);
      let dz = directions.reduce((sum, direction) => sum + direction.dz, 0);
      const combinedLength = Math.hypot(dx, dz);
      if (combinedLength < 0.001) {
        ({ dx, dz } = directions[0]);
      } else {
        dx /= combinedLength;
        dz /= combinedLength;
      }
      const colorIndexes = [
        ...new Set(
          arrows.map(arrow => arrow.pathIdx % GATEWAY_COLORS.length),
        ),
      ];
      const widthScale = 0.86;
      const lengthScale = 0.9;
      const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      const materialNames =
        colorIndexes.length === 1
          ? {
              coreName: `arrow-${colorIndexes[0]}`,
              auraName: `arrow-aura-${colorIndexes[0]}`,
            }
          : this.#getAnimatedArrowMaterials(colorIndexes);
      this.#addArrowMatrix(
        batches,
        materialNames.auraName,
        "aura",
        baseX,
        top + 0.018,
        baseZ,
        yaw,
        widthScale * 1.2,
        lengthScale * 1.08,
      );
      this.#addArrowMatrix(
        batches,
        materialNames.coreName,
        "full",
        baseX,
        top + 0.034,
        baseZ,
        yaw,
        widthScale,
        lengthScale,
      );
    }
  }

  #groupNearbyArrows(arrowData) {
    const markers = [...arrowData.entries()].map(([key, arrows]) => {
      const [col, row] = key.split(",").map(Number);
      return { col, row, arrows };
    });
    const remaining = new Set(markers.map((_, index) => index));
    const groups = [];

    while (remaining.size) {
      const firstIndex = remaining.values().next().value;
      remaining.delete(firstIndex);
      const group = [markers[firstIndex]];
      const queue = [markers[firstIndex]];

      while (queue.length) {
        const current = queue.shift();
        for (const candidateIndex of [...remaining]) {
          const candidate = markers[candidateIndex];
          if (
            Math.hypot(
              candidate.col - current.col,
              candidate.row - current.row,
            ) > ARROW_MERGE_DISTANCE
          ) {
            continue;
          }
          remaining.delete(candidateIndex);
          group.push(candidate);
          queue.push(candidate);
        }
      }
      groups.push(group);
    }

    return groups;
  }

  #addArrowMatrix(
    batches,
    material,
    meshKey,
    x,
    y,
    z,
    yaw,
    scaleX,
    scaleZ,
  ) {
    const matrix = new this.#pc.Mat4();
    const rotation = new this.#pc.Quat();
    rotation.setFromEulerAngles(0, yaw, 0);
    matrix.setTRS(
      new this.#pc.Vec3(x, y, z),
      rotation,
      new this.#pc.Vec3(scaleX, 1, scaleZ),
    );
    const batchKey = `${material}|${meshKey}`;
    const data = batches.get(batchKey) ?? [];
    for (const value of matrix.data) data.push(value);
    batches.set(batchKey, data);
  }

  #tileHeight(col, row) {
    const type = this.#mapData.grid[row][col];
    return type in FIXED_HEIGHTS
      ? FIXED_HEIGHTS[type]
      : this.#mapData.heightmap[row][col];
  }

  #arrowHeight(col, row) {
    const { cols, rows, grid } = this.#mapData;
    const candidateCols = [...new Set([Math.floor(col), Math.ceil(col)])];
    const candidateRows = [...new Set([Math.floor(row), Math.ceil(row)])];
    const pathHeights = [];

    for (const candidateRow of candidateRows) {
      for (const candidateCol of candidateCols) {
        if (
          candidateCol < 0 ||
          candidateCol >= cols ||
          candidateRow < 0 ||
          candidateRow >= rows
        ) {
          continue;
        }
        const type = grid[candidateRow][candidateCol];
        if (type !== TileType.PATH && type !== TileType.ENTRY) continue;
        pathHeights.push(this.#tileHeight(candidateCol, candidateRow));
      }
    }

    if (pathHeights.length) return Math.max(...pathHeights);
    const nearestCol = Math.max(0, Math.min(cols - 1, Math.round(col)));
    const nearestRow = Math.max(0, Math.min(rows - 1, Math.round(row)));
    return this.#tileHeight(nearestCol, nearestRow);
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
  ) {
    this.#addBoxMatrix(
      batches,
      topMaterial,
      sideMaterial,
      x,
      y,
      z,
      0,
      CUBE_SCALE,
      CUBE_SCALE,
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

  #createArrowInstancedBatches(batches, root) {
    const pc = this.#pc;
    for (const [batchKey, matrices] of batches.entries()) {
      if (matrices.length === 0) continue;
      const [materialName, meshKey] = batchKey.split("|");
      const vertexBuffer = new pc.VertexBuffer(
        this.#app.graphicsDevice,
        pc.VertexFormat.getDefaultInstancingFormat(this.#app.graphicsDevice),
        matrices.length / 16,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const meshInstance = new pc.MeshInstance(
        this.#getArrowMesh(meshKey),
        this.#materials.get(materialName),
      );
      meshInstance.setInstancing(vertexBuffer, false);
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = false;

      const entity = new pc.Entity(`Path arrows ${materialName}`);
      entity.addComponent("render", {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: false,
      });
      root.addChild(entity);
    }
  }

  #createArrowMesh() {
    return this.#createArrowSliceMesh(0, 1);
  }

  #getArrowMesh(meshKey) {
    if (meshKey === "full") return this.#arrowMesh;
    if (meshKey === "aura") return this.#arrowAuraMesh;
    const cached = this.#arrowSliceMeshes.get(meshKey);
    if (cached) return cached;
    const match = /^slice-(\d+)-(\d+)$/.exec(meshKey);
    if (!match) throw new Error(`Unknown arrow mesh: ${meshKey}`);
    const mesh = this.#createArrowSliceMesh(Number(match[2]), Number(match[1]));
    this.#arrowSliceMeshes.set(meshKey, mesh);
    return mesh;
  }

  #createArrowAuraMesh() {
    const geometry = new this.#pc.Geometry();
    geometry.positions = [
      -0.5, 0, -0.5,
      0.5, 0, -0.5,
      0.5, 0, 0.5,
      -0.5, 0, 0.5,
    ];
    geometry.normals = [
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ];
    geometry.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    geometry.indices = [0, 2, 1, 0, 3, 2];
    const mesh = this.#pc.Mesh.fromGeometry(
      this.#app.graphicsDevice,
      geometry,
    );
    mesh.incRefCount();
    return mesh;
  }

  #createArrowAuraTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    const center = size / 2;
    const gradient = context.createRadialGradient(
      center,
      center,
      2,
      center,
      center,
      center,
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.58)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.28)");
    gradient.addColorStop(0.72, "rgba(72,72,72,0.08)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      name: "Arrow aura",
      width: size,
      height: size,
      minFilter: this.#pc.FILTER_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      mipmaps: false,
    });
    texture.setSource(canvas);
    return texture;
  }

  #clipArrowPolygon(polygon, axis, boundary, keepAbove) {
    const clipped = [];
    for (let index = 0; index < polygon.length; index++) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = keepAbove
        ? current[axis] >= boundary
        : current[axis] <= boundary;
      const previousInside = keepAbove
        ? previous[axis] >= boundary
        : previous[axis] <= boundary;

      if (currentInside !== previousInside) {
        const ratio =
          (boundary - previous[axis]) / (current[axis] - previous[axis]);
        const intersection = [
          previous[0] + (current[0] - previous[0]) * ratio,
          previous[1] + (current[1] - previous[1]) * ratio,
        ];
        intersection[axis] = boundary;
        clipped.push(intersection);
      }
      if (currentInside) clipped.push(current);
    }
    return clipped;
  }

  #createArrowSliceMesh(sliceIndex, sliceCount) {
    return this.#createSlicedArrowMesh(
      ARROW_POINTS,
      ARROW_TRIANGLES,
      ARROW_MIN_Z,
      ARROW_MAX_Z,
      sliceIndex,
      sliceCount,
      1,
    );
  }

  #createSlicedArrowMesh(
    points,
    triangles,
    minCoordinate,
    maxCoordinate,
    sliceIndex,
    sliceCount,
    axis = 0,
  ) {
    const pc = this.#pc;
    const sliceWidth = (maxCoordinate - minCoordinate) / sliceCount;
    const sliceMin = minCoordinate + sliceWidth * sliceIndex;
    const sliceMax = sliceMin + sliceWidth;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const minX = Math.min(...points.map(point => point[0]));
    const maxX = Math.max(...points.map(point => point[0]));
    const minZ = Math.min(...points.map(point => point[1]));
    const maxZ = Math.max(...points.map(point => point[1]));

    for (const triangle of triangles) {
      let polygon = triangle.map(index => points[index]);
      polygon = this.#clipArrowPolygon(polygon, axis, sliceMin, true);
      polygon = this.#clipArrowPolygon(polygon, axis, sliceMax, false);
      if (polygon.length < 3) continue;
      const start = positions.length / 3;
      for (const [x, z] of polygon) {
        positions.push(x, 0, z);
        normals.push(0, 1, 0);
        uvs.push(
          (x - minX) / Math.max(0.001, maxX - minX),
          (z - minZ) / Math.max(0.001, maxZ - minZ),
        );
      }
      for (let index = 1; index < polygon.length - 1; index++) {
        indices.push(start, start + index, start + index + 1);
      }
    }

    const geometry = new pc.Geometry();
    geometry.positions = positions;
    geometry.normals = normals;
    geometry.uvs = uvs;
    geometry.indices = indices;
    const mesh = pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
    mesh.incRefCount();
    return mesh;
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

  #connectGatewayInteraction() {
    if (this.#gatewayInteractionConnected || !this.canvas) return;
    this.canvas.addEventListener("pointerdown", this.#handleBannerPointerDown);
    this.canvas.addEventListener("pointermove", this.#handleBannerPointerMove);
    this.canvas.addEventListener("pointerup", this.#handleBannerPointerUp);
    this.canvas.addEventListener("pointercancel", this.#handleBannerPointerUp);
    this.#gatewayInteractionConnected = true;
  }

  #disconnectGatewayInteraction() {
    if (!this.#gatewayInteractionConnected || !this.canvas) return;
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
    this.#gatewayInteractionConnected = false;
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
    if (event.button !== 0 || this.#bannerWindGateway) return;
    const ray = this.#pointerRay(event);
    if (!ray) return;

    let closest = null;
    for (const gateway of this.#gateways) {
      const hit = gateway.getBannerHit(ray.start, ray.end);
      if (!hit || (closest && hit.distance >= closest.hit.distance)) continue;
      closest = { gateway, hit };
    }
    if (!closest) return;

    event.preventDefault();
    this.#bannerWindGateway = closest.gateway;
    this.#bannerWindPointerId = event.pointerId;
    this.#bannerWindLastTime = event.timeStamp;
    closest.gateway.beginWindGesture(closest.hit.point);
    this.canvas.setPointerCapture(event.pointerId);
  };

  #handleBannerPointerMove = (event) => {
    if (!this.#bannerWindGateway) return;
    if (event.pointerId !== this.#bannerWindPointerId) {
      return;
    }
    const ray = this.#pointerRay(event);
    if (!ray) return;

    event.preventDefault();
    const deltaTime = (event.timeStamp - this.#bannerWindLastTime) / 1000;
    this.#bannerWindLastTime = event.timeStamp;
    this.#bannerWindGateway.applyMouseWind(ray.start, ray.end, deltaTime);
  };

  #handleBannerPointerUp = (event) => {
    if (event.pointerId !== this.#bannerWindPointerId) return;
    event.preventDefault();
    this.#finishBannerWindGesture();
  };

  #finishBannerWindGesture() {
    this.#bannerWindGateway?.endWindGesture();
    if (
      this.#bannerWindPointerId !== null &&
      this.canvas?.hasPointerCapture(this.#bannerWindPointerId)
    ) {
      this.canvas.releasePointerCapture(this.#bannerWindPointerId);
    }
    this.#bannerWindGateway = null;
    this.#bannerWindPointerId = null;
    this.#bannerWindLastTime = 0;
  }

  #clearScene() {
    this.#finishBannerWindGesture();
    for (const gateway of this.#gateways) gateway.destroy();
    this.#gateways = [];
    this.#mapRoot?.destroy();
    this.#mapRoot = null;
    this.#arrowRoot = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
  }
}
