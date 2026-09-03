import { BannerWind } from "../shared/BannerWind.js";
import { GatewayBannerSign } from "./GatewayBannerSign.js";
import portalFragmentShader from "./GatewayPortal.frag?raw";
import portalVertexShader from "./GatewayPortal.vert?raw";
import { GatewayStoneTexture } from "./GatewayStoneTexture.js";

export const DEFAULT_GATEWAY_COLOR = 0x269cff;
export const GATEWAY_COLORS = [
  DEFAULT_GATEWAY_COLOR,
  0xf24edb,
  0xff8a2a,
  0x2ad66f,
];

const FRAME_WIDTH_BLOCKS = 16;
const FRAME_OPENING_HEIGHT_BLOCKS = 8;
const FRAME_LINTEL_HEIGHT_BLOCKS = 3;
const FRAME_DEPTH_BLOCKS = 3;
const FRAME_TOWER_WIDTH_BLOCKS = 4;
const FRAME_TOWER_HEIGHT_BLOCKS = 13;
const FRAME_STONE_COLORS = [0x434b54, 0x535d67, 0x626d77];
const PORTAL_COLLISION_HALF_DEPTH = 0.08;

/**
 * A two-lane voxel gateway with an animated, shader-driven portal surface.
 * Frame blocks use a grid pitch and physical size of exactly one quarter of a
 * terrain cube by default.
 */
export class Gateway {
  #pc;
  #app;
  #entity;
  #cubeSize;
  #symbol;
  #materials = [];
  #meshes = [];
  #textures = [];
  #portalMaterial = null;
  #accentMaterial = null;
  #bannerMaterial = null;
  #emblemMaterial = null;
  #bannerMesh = null;
  #bannerBasePositions = null;
  #bannerPositions = null;
  #bannerVertexUv = null;
  #bannerIndices = null;
  #bannerInteraction = null;
  #emblemEntity = null;
  #emblemBasePosition = null;
  #bannerWind = new BannerWind();
  #updateHandle = null;
  #elapsed = 0;
  #inverseWorldTransform = null;
  #collisionWorldPoint = null;
  #collisionLocalPoint = null;

  constructor({
    pc,
    app,
    color = DEFAULT_GATEWAY_COLOR,
    cubeSize = 0.25,
    symbol = "✧",
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#cubeSize = cubeSize;
    this.#symbol = symbol;
    this.#entity = new pc.Entity("Voxel gateway");
    this.#collisionWorldPoint = new pc.Vec3();
    this.#collisionLocalPoint = new pc.Vec3();

    this.#createFrame();
    this.#createPortal();
    this.setColor(color);

    this.#updateHandle = app.on("update", (deltaTime) => {
      this.#elapsed += deltaTime;
      this.#portalMaterial?.setParameter("uTime", this.#elapsed);
      this.#animateBanner(deltaTime);
    });
  }

  get entity() {
    return this.#entity;
  }

  intersectsGroundFootprint(x, z, radius = 0) {
    if (!this.#entity) return false;
    this.#inverseWorldTransform ??= this.#entity
      .getWorldTransform()
      .clone()
      .invert();
    this.#collisionWorldPoint.set(x, this.#entity.getPosition().y, z);
    this.#inverseWorldTransform.transformPoint(
      this.#collisionWorldPoint,
      this.#collisionLocalPoint,
    );
    return (
      Math.abs(this.#collisionLocalPoint.x) <=
        PORTAL_COLLISION_HALF_DEPTH + radius &&
      Math.abs(this.#collisionLocalPoint.z) <=
        (FRAME_WIDTH_BLOCKS * this.#cubeSize) / 2 + radius
    );
  }

  setColor(value) {
    const color = this.#colorFrom(value);
    this.#portalMaterial?.setParameter("uColor", [color.r, color.g, color.b]);
    if (this.#accentMaterial) {
      this.#accentMaterial.diffuse = new this.#pc.Color(
        color.r * 0.18 + 0.68,
        color.g * 0.18 + 0.68,
        color.b * 0.18 + 0.68,
      );
      this.#accentMaterial.emissive = new this.#pc.Color(
        color.r * 0.025,
        color.g * 0.025,
        color.b * 0.025,
      );
      this.#accentMaterial.update();
    }
    if (this.#bannerMaterial) {
      this.#bannerMaterial.diffuse = new this.#pc.Color(
        color.r * 0.72,
        color.g * 0.72,
        color.b * 0.72,
      );
      this.#bannerMaterial.emissive = new this.#pc.Color(
        color.r * 0.12,
        color.g * 0.12,
        color.b * 0.12,
      );
      this.#bannerMaterial.update();
    }
  }

  getBannerHit(rayStart, rayEnd) {
    return this.#intersectBannerRay(rayStart, rayEnd, true);
  }

  beginWindGesture(hit) {
    this.#bannerWind.begin(hit?.point ?? hit);
  }

  applyMouseWind(rayStart, rayEnd, deltaTime) {
    const hit = this.#intersectBannerRay(rayStart, rayEnd, false);
    if (!hit) return;
    this.#bannerWind.applyPointer(hit.point, deltaTime);
  }

  endWindGesture() {
    this.#bannerWind.end();
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#entity = null;

    for (const material of this.#materials) material.destroy();
    this.#materials = [];
    for (const texture of this.#textures) texture.destroy();
    this.#textures = [];
    for (const mesh of this.#meshes) {
      mesh.decRefCount();
      if (mesh.refCount < 1) mesh.destroy();
    }
    this.#meshes = [];
    this.#portalMaterial = null;
    this.#accentMaterial = null;
    this.#bannerMaterial = null;
    this.#emblemMaterial = null;
    this.#bannerMesh = null;
    this.#bannerBasePositions = null;
    this.#bannerPositions = null;
    this.#bannerVertexUv = null;
    this.#bannerIndices = null;
    this.#bannerInteraction = null;
    this.#emblemEntity = null;
    this.#emblemBasePosition = null;
    this.#inverseWorldTransform = null;
    this.#collisionWorldPoint = null;
    this.#collisionLocalPoint = null;
    this.endWindGesture();
  }

  #createFrame() {
    const pc = this.#pc;
    const blocksByVariant = FRAME_STONE_COLORS.map(() => []);
    const accentBlocks = [];
    const lintelStart = FRAME_OPENING_HEIGHT_BLOCKS;
    const lintelEnd = lintelStart + FRAME_LINTEL_HEIGHT_BLOCKS;

    const blockPosition = (column, row, depth) => ({
      x: (depth - (FRAME_DEPTH_BLOCKS - 1) / 2) * this.#cubeSize,
      y: (row + 0.5) * this.#cubeSize,
      z: (column - (FRAME_WIDTH_BLOCKS - 1) / 2) * this.#cubeSize,
    });
    const addStoneBlock = (column, row, depth) => {
      const hash = Math.abs(column * 17 + row * 31 + depth * 13);
      blocksByVariant[hash % blocksByVariant.length].push(
        blockPosition(column, row, depth),
      );
    };
    const addAccentBlock = (column, row, depth) => {
      accentBlocks.push(blockPosition(column, row, depth));
    };

    for (let depth = 0; depth < FRAME_DEPTH_BLOCKS; depth += 1) {
      for (let row = 0; row < FRAME_TOWER_HEIGHT_BLOCKS; row += 1) {
        for (let column = 0; column < FRAME_TOWER_WIDTH_BLOCKS; column += 1) {
          addStoneBlock(column, row, depth);
          addStoneBlock(FRAME_WIDTH_BLOCKS - 1 - column, row, depth);
        }
      }

      for (let row = lintelStart; row < lintelEnd; row += 1) {
        for (
          let column = FRAME_TOWER_WIDTH_BLOCKS;
          column < FRAME_WIDTH_BLOCKS - FRAME_TOWER_WIDTH_BLOCKS;
          column += 1
        ) {
          addAccentBlock(column, row, depth);
        }
      }

      addAccentBlock(
        FRAME_TOWER_WIDTH_BLOCKS,
        FRAME_OPENING_HEIGHT_BLOCKS - 2,
        depth,
      );
      addAccentBlock(
        FRAME_WIDTH_BLOCKS - 1 - FRAME_TOWER_WIDTH_BLOCKS,
        FRAME_OPENING_HEIGHT_BLOCKS - 2,
        depth,
      );
      for (const column of [
        FRAME_TOWER_WIDTH_BLOCKS,
        FRAME_TOWER_WIDTH_BLOCKS + 1,
        FRAME_WIDTH_BLOCKS - 2 - FRAME_TOWER_WIDTH_BLOCKS,
        FRAME_WIDTH_BLOCKS - 1 - FRAME_TOWER_WIDTH_BLOCKS,
      ]) {
        addAccentBlock(column, FRAME_OPENING_HEIGHT_BLOCKS - 1, depth);
      }

      for (const startColumn of [FRAME_TOWER_WIDTH_BLOCKS, 7, 10]) {
        addAccentBlock(startColumn, lintelEnd, depth);
        addAccentBlock(startColumn + 1, lintelEnd, depth);
      }

      for (let column = 0; column < FRAME_TOWER_WIDTH_BLOCKS; column += 1) {
        addStoneBlock(column, FRAME_TOWER_HEIGHT_BLOCKS, depth);
        addStoneBlock(
          FRAME_WIDTH_BLOCKS - 1 - column,
          FRAME_TOWER_HEIGHT_BLOCKS,
          depth,
        );
      }
      for (const column of [
        0,
        FRAME_TOWER_WIDTH_BLOCKS - 1,
        FRAME_WIDTH_BLOCKS - FRAME_TOWER_WIDTH_BLOCKS,
        FRAME_WIDTH_BLOCKS - 1,
      ]) {
        addStoneBlock(column, FRAME_TOWER_HEIGHT_BLOCKS + 1, depth);
      }
    }

    for (const depth of [-1, FRAME_DEPTH_BLOCKS]) {
      for (let column = 0; column < FRAME_TOWER_WIDTH_BLOCKS; column += 1) {
        addStoneBlock(column, FRAME_TOWER_HEIGHT_BLOCKS, depth);
        addStoneBlock(
          FRAME_WIDTH_BLOCKS - 1 - column,
          FRAME_TOWER_HEIGHT_BLOCKS,
          depth,
        );
      }
    }

    blocksByVariant.forEach((blocks, index) => {
      if (!blocks.length) return;
      const material = new pc.StandardMaterial();
      material.name = `Gateway stone ${index + 1}`;
      material.diffuse = this.#colorFrom(FRAME_STONE_COLORS[index]);
      const textures = GatewayStoneTexture.create(
        pc,
        this.#app.graphicsDevice,
        index + 1,
      );
      material.diffuseMap = textures.diffuse;
      material.normalMap = textures.normal;
      material.bumpiness = 0.48;
      material.gloss = 0.12;
      material.metalness = 0;
      material.useMetalness = true;
      material.update();
      this.#textures.push(textures.diffuse, textures.normal);
      this.#materials.push(material);

      const mesh = this.#createBlockMesh(blocks);
      const meshInstance = new pc.MeshInstance(mesh, material);
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = true;
      const part = new pc.Entity(`Gateway stonework ${index + 1}`);
      part.addComponent("render", {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: true,
      });
      this.#entity.addChild(part);
    });

    this.#accentMaterial = new pc.StandardMaterial();
    this.#accentMaterial.name = "Gateway washed colored arch";
    const accentTextures = GatewayStoneTexture.create(
      pc,
      this.#app.graphicsDevice,
      11,
    );
    this.#accentMaterial.diffuseMap = accentTextures.diffuse;
    this.#accentMaterial.normalMap = accentTextures.normal;
    this.#accentMaterial.bumpiness = 0.38;
    this.#accentMaterial.gloss = 0.03;
    this.#accentMaterial.emissiveIntensity = 0.08;
    this.#accentMaterial.useMetalness = true;
    this.#accentMaterial.update();
    this.#textures.push(accentTextures.diffuse, accentTextures.normal);
    this.#materials.push(this.#accentMaterial);

    const mesh = this.#createBlockMesh(accentBlocks);
    const meshInstance = new pc.MeshInstance(mesh, this.#accentMaterial);
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = true;
    const arch = new pc.Entity("Gateway washed colored arch");
    arch.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: true,
    });
    this.#entity.addChild(arch);
    this.#createBanner();
  }

  #createBanner() {
    const pc = this.#pc;
    const width = 0.86 + this.#cubeSize * 2;
    const height = 0.78 + this.#cubeSize * 2;
    const yTop =
      (FRAME_OPENING_HEIGHT_BLOCKS + FRAME_LINTEL_HEIGHT_BLOCKS - 0.2) *
      this.#cubeSize;
    const faceX = (FRAME_DEPTH_BLOCKS * this.#cubeSize) / 2 + 0.012;
    const columnSegments = 12;
    const rowSegments = 8;
    this.#bannerInteraction = {
      planeX: faceX + 0.03,
      width,
      height,
      yTop,
    };
    const geometry = new pc.Geometry();
    geometry.positions = [];
    geometry.indices = [];
    const vertexUv = [];

    // Local +X is the enemy-facing side. Right gates rotate the whole gateway
    // 180 degrees, keeping this cloth on the approach side only.
    for (let row = 0; row <= rowSegments; row += 1) {
      const v = row / rowSegments;
      for (let column = 0; column <= columnSegments; column += 1) {
        const u = (column / columnSegments) * 2 - 1;
        const taper = 1 - v * 0.1;
        const bottomSag = row === rowSegments ? (1 - Math.abs(u)) * 0.065 : 0;
        const foldedDepth =
          0.026 +
          Math.cos(u * Math.PI * 3) * (0.014 + Math.sin(v * Math.PI) * 0.014) +
          Math.sin(v * Math.PI) * 0.018;

        geometry.positions.push(
          faceX + foldedDepth,
          yTop - v * height - bottomSag,
          u * (width / 2) * taper,
        );
        vertexUv.push(u, v);
      }
    }
    const rowLength = columnSegments + 1;
    for (let row = 0; row < rowSegments; row += 1) {
      for (let column = 0; column < columnSegments; column += 1) {
        const topLeft = row * rowLength + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + rowLength;
        const bottomRight = bottomLeft + 1;
        geometry.indices.push(
          topLeft,
          topRight,
          bottomRight,
          topLeft,
          bottomRight,
          bottomLeft,
        );
      }
    }
    this.#bannerBasePositions = Float32Array.from(geometry.positions);
    this.#bannerPositions = new Float32Array(this.#bannerBasePositions);
    this.#bannerVertexUv = Float32Array.from(vertexUv);
    this.#bannerIndices = Uint16Array.from(geometry.indices);

    const mesh = new pc.Mesh(this.#app.graphicsDevice);
    mesh.clear(
      true,
      false,
      this.#bannerPositions.length / 3,
      this.#bannerIndices.length,
    );
    mesh.setPositions(this.#bannerPositions);
    mesh.setNormals(
      pc.calculateNormals(this.#bannerPositions, this.#bannerIndices),
    );
    mesh.setIndices(this.#bannerIndices);
    mesh.update();
    mesh.incRefCount();
    this.#meshes.push(mesh);
    this.#bannerMesh = mesh;
    this.#bannerMaterial = new pc.StandardMaterial();
    this.#bannerMaterial.name = "Gateway hanging cloth";
    this.#bannerMaterial.gloss = 0.05;
    this.#bannerMaterial.emissiveIntensity = 0.22;
    this.#bannerMaterial.cull = pc.CULLFACE_BACK;
    this.#bannerMaterial.update();
    this.#materials.push(this.#bannerMaterial);

    const meshInstance = new pc.MeshInstance(mesh, this.#bannerMaterial);
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = true;
    const banner = new pc.Entity("Gateway hanging cloth");
    banner.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: true,
    });
    this.#entity.addChild(banner);

    const centerY = yTop - height * 0.48;
    const signHalfWidth = 0.23 * 1.4;
    const signHalfHeight = 0.23 * 1.4;
    const emblemGeometry = new pc.Geometry();
    emblemGeometry.positions = [
      0,
      signHalfHeight,
      -signHalfWidth,
      0,
      signHalfHeight,
      signHalfWidth,
      0,
      -signHalfHeight,
      signHalfWidth,
      0,
      -signHalfHeight,
      -signHalfWidth,
    ];
    emblemGeometry.normals = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
    emblemGeometry.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    emblemGeometry.indices = [0, 1, 2, 0, 2, 3];

    const emblemMesh = pc.Mesh.fromGeometry(
      this.#app.graphicsDevice,
      emblemGeometry,
    );
    emblemMesh.incRefCount();
    this.#meshes.push(emblemMesh);
    const signTexture = GatewayBannerSign.createTexture(
      pc,
      this.#app.graphicsDevice,
      this.#symbol,
    );
    this.#textures.push(signTexture);
    this.#emblemMaterial = new pc.StandardMaterial();
    this.#emblemMaterial.name = `Gateway cloth sign ${this.#symbol}`;
    this.#emblemMaterial.diffuse = this.#colorFrom(0xeaf8ff);
    this.#emblemMaterial.diffuseMap = signTexture;
    this.#emblemMaterial.emissive = this.#colorFrom(0xeaf8ff);
    this.#emblemMaterial.emissiveMap = signTexture;
    this.#emblemMaterial.emissiveIntensity = 0.55;
    this.#emblemMaterial.opacityMap = signTexture;
    this.#emblemMaterial.opacityMapChannel = "a";
    this.#emblemMaterial.alphaTest = 0.08;
    this.#emblemMaterial.blendType = pc.BLEND_NORMAL;
    this.#emblemMaterial.depthWrite = false;
    this.#emblemMaterial.useLighting = false;
    this.#emblemMaterial.cull = pc.CULLFACE_BACK;
    this.#emblemMaterial.update();
    this.#materials.push(this.#emblemMaterial);

    const emblemMeshInstance = new pc.MeshInstance(
      emblemMesh,
      this.#emblemMaterial,
    );
    emblemMeshInstance.castShadow = false;
    emblemMeshInstance.receiveShadow = false;
    const emblem = new pc.Entity(`Gateway cloth sign ${this.#symbol}`);
    this.#emblemBasePosition = [faceX + 0.082, centerY, 0];
    emblem.setLocalPosition(...this.#emblemBasePosition);
    emblem.addComponent("render", {
      meshInstances: [emblemMeshInstance],
      castShadows: false,
      receiveShadows: false,
    });
    this.#entity.addChild(emblem);
    this.#emblemEntity = emblem;
  }

  #intersectBannerRay(rayStart, rayEnd, bounded) {
    if (!this.#entity || !this.#bannerInteraction) return null;

    const pc = this.#pc;
    const inverse = this.#entity.getWorldTransform().clone().invert();
    const localStart = inverse.transformPoint(rayStart, new pc.Vec3());
    const localEnd = inverse.transformPoint(rayEnd, new pc.Vec3());
    const directionX = localEnd.x - localStart.x;
    const { planeX, width, height, yTop } = this.#bannerInteraction;

    if (Math.abs(directionX) < 0.000001) return null;

    const distance = (planeX - localStart.x) / directionX;
    if (distance < 0 || distance > 1) return null;

    const point = new pc.Vec3(
      planeX,
      localStart.y + (localEnd.y - localStart.y) * distance,
      localStart.z + (localEnd.z - localStart.z) * distance,
    );
    if (
      bounded &&
      (point.y > yTop + 0.03 ||
        point.y < yTop - height - 0.09 ||
        Math.abs(point.z) > width / 2 + 0.045)
    ) {
      return null;
    }

    return { distance, point };
  }

  #animateBanner(deltaTime) {
    if (
      !this.#bannerMesh ||
      !this.#bannerBasePositions ||
      !this.#bannerPositions ||
      !this.#bannerVertexUv ||
      !this.#bannerIndices
    ) {
      return;
    }

    this.#bannerWind.advance(deltaTime);
    this.#bannerWind.deform({
      basePositions: this.#bannerBasePositions,
      positions: this.#bannerPositions,
      vertexUv: this.#bannerVertexUv,
    });

    this.#bannerMesh.setPositions(this.#bannerPositions);
    this.#bannerMesh.setNormals(
      this.#pc.calculateNormals(this.#bannerPositions, this.#bannerIndices),
    );
    this.#bannerMesh.update(this.#pc.PRIMITIVE_TRIANGLES, false);

    if (this.#emblemEntity && this.#emblemBasePosition) {
      const emblemOffset = this.#bannerWind.sample(0, 0.48);
      this.#emblemEntity.setLocalPosition(
        this.#emblemBasePosition[0] + emblemOffset.normal,
        this.#emblemBasePosition[1] + emblemOffset.vertical,
        this.#emblemBasePosition[2] + emblemOffset.horizontal,
      );
      this.#emblemEntity.setLocalEulerAngles(
        0,
        emblemOffset.rotationY,
        emblemOffset.rotationZ,
      );
    }
  }

  #createPortal() {
    const pc = this.#pc;
    const width =
      (FRAME_WIDTH_BLOCKS - FRAME_TOWER_WIDTH_BLOCKS * 2) * this.#cubeSize;
    const height = FRAME_OPENING_HEIGHT_BLOCKS * this.#cubeSize;
    const halfWidth = width / 2;
    const geometry = new pc.Geometry();
    geometry.positions = [
      0,
      0,
      -halfWidth,
      0,
      0,
      halfWidth,
      0,
      height,
      halfWidth,
      0,
      height,
      -halfWidth,
    ];
    geometry.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    geometry.indices = [0, 1, 2, 0, 2, 3];

    const mesh = pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
    mesh.incRefCount();
    this.#meshes.push(mesh);

    this.#portalMaterial = new pc.ShaderMaterial({
      uniqueName: "voxel-gateway-portal",
      vertexGLSL: portalVertexShader,
      fragmentGLSL: portalFragmentShader,
      attributes: {
        vertex_position: pc.SEMANTIC_POSITION,
        vertex_texCoord0: pc.SEMANTIC_TEXCOORD0,
      },
    });
    this.#portalMaterial.name = "Gateway portal";
    this.#portalMaterial.blendType = pc.BLEND_NORMAL;
    this.#portalMaterial.depthWrite = false;
    this.#portalMaterial.cull = pc.CULLFACE_NONE;
    this.#portalMaterial.setParameter("uTime", 0);
    this.#portalMaterial.update();
    this.#materials.push(this.#portalMaterial);

    const meshInstance = new pc.MeshInstance(mesh, this.#portalMaterial);
    meshInstance.castShadow = false;
    meshInstance.receiveShadow = false;
    meshInstance.pick = false;
    const portal = new pc.Entity("Gateway portal surface");
    portal.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: false,
      receiveShadows: false,
    });
    this.#entity.addChild(portal);
  }

  #createBlockMesh(blocks) {
    const pc = this.#pc;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const half = this.#cubeSize / 2;
    const inner = half - Math.min(this.#cubeSize * 0.08, 0.02);

    const appendFace = (block, localPoints) => {
      let points = localPoints.map((point) => [...point]);
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
        points = points.reverse();
        normal = normal.map((value) => -value);
      }
      const normalLength = Math.hypot(...normal);
      normal = normal.map((value) => value / normalLength);
      const normalMagnitude = normal.map((value) => Math.abs(value));
      const dominantAxis = normalMagnitude.indexOf(
        Math.max(...normalMagnitude),
      );

      const start = positions.length / 3;
      for (const point of points) {
        positions.push(
          block.x + point[0],
          block.y + point[1],
          block.z + point[2],
        );
        normals.push(...normal);
        const coordinateU =
          dominantAxis === 0
            ? point[2]
            : dominantAxis === 1
              ? point[0]
              : point[0];
        const coordinateV =
          dominantAxis === 0
            ? point[1]
            : dominantAxis === 1
              ? point[2]
              : point[1];
        uvs.push(
          coordinateU / this.#cubeSize + 0.5,
          coordinateV / this.#cubeSize + 0.5,
        );
      }
      for (let index = 1; index < points.length - 1; index += 1) {
        indices.push(start, start + index, start + index + 1);
      }
    };

    for (const block of blocks) {
      for (const sign of [-1, 1]) {
        appendFace(block, [
          [sign * half, -inner, -inner],
          [sign * half, inner, -inner],
          [sign * half, inner, inner],
          [sign * half, -inner, inner],
        ]);
        appendFace(block, [
          [-inner, sign * half, -inner],
          [-inner, sign * half, inner],
          [inner, sign * half, inner],
          [inner, sign * half, -inner],
        ]);
        appendFace(block, [
          [-inner, -inner, sign * half],
          [inner, -inner, sign * half],
          [inner, inner, sign * half],
          [-inner, inner, sign * half],
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
            const point = (outerAxis, freeValue) => {
              const result = [0, 0, 0];
              result[axisA] = signA * (outerAxis === axisA ? half : inner);
              result[axisB] = signB * (outerAxis === axisB ? half : inner);
              result[freeAxis] = freeValue;
              return result;
            };
            appendFace(block, [
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
            appendFace(block, [
              [signX * half, signY * inner, signZ * inner],
              [signX * inner, signY * half, signZ * inner],
              [signX * inner, signY * inner, signZ * half],
            ]);
          }
        }
      }
    }

    const geometry = new pc.Geometry();
    geometry.positions = positions;
    geometry.normals = normals;
    geometry.uvs = uvs;
    geometry.tangents = pc.calculateTangents(positions, normals, uvs, indices);
    geometry.indices = indices;
    const mesh = pc.Mesh.fromGeometry(this.#app.graphicsDevice, geometry);
    mesh.incRefCount();
    this.#meshes.push(mesh);
    return mesh;
  }

  #colorFrom(value) {
    if (value instanceof this.#pc.Color) return value.clone();
    if (Array.isArray(value)) {
      return new this.#pc.Color(value[0] ?? 1, value[1] ?? 1, value[2] ?? 1);
    }
    const parsed =
      typeof value === "string"
        ? Number.parseInt(value.replace(/^#/, ""), 16)
        : value;
    const color = Number.isFinite(parsed) ? parsed : DEFAULT_GATEWAY_COLOR;
    return new this.#pc.Color(
      ((color >> 16) & 0xff) / 255,
      ((color >> 8) & 0xff) / 255,
      (color & 0xff) / 255,
    );
  }
}
