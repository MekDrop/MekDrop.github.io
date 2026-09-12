import { BannerWind } from "../shared/BannerWind.js";
import { colorFromValue } from "../../helpers/colors.js";
import gatewayFrameModelUrl from "../../models/gateway/gateway-frame.glb?url";
import { GatewayBannerSign } from "./GatewayBannerSign.js";
import portalFragmentShader from "./GatewayPortal.frag?raw";
import portalVertexShader from "./GatewayPortal.vert?raw";

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
const PORTAL_COLLISION_HALF_DEPTH = 0.08;

/**
 * A two-lane voxel gateway with an animated, shader-driven portal surface.
 * Frame blocks use a grid pitch and physical size of exactly one quarter of a
 * terrain cube by default.
 */
export class Gateway {
  static get modelUrl() {
    return gatewayFrameModelUrl;
  }

  #pc;
  #app;
  #entity;
  #cubeSize;
  #symbol;
  #modelLibrary;
  #materials = [];
  #meshes = [];
  #textures = [];
  #portalMaterial = null;
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
  #repulsionFromLocalPoint = null;
  #repulsionDirection = null;

  constructor({
    pc,
    app,
    color = DEFAULT_GATEWAY_COLOR,
    cubeSize = 0.25,
    surfaceLift = 0,
    symbol = "✧",
    modelLibrary,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#cubeSize = cubeSize;
    this.#symbol = symbol;
    this.#modelLibrary = modelLibrary;
    this.#entity = new pc.Entity("Voxel gateway");
    this.#collisionWorldPoint = new pc.Vec3();
    this.#collisionLocalPoint = new pc.Vec3();
    this.#repulsionFromLocalPoint = new pc.Vec3();
    this.#repulsionDirection = new pc.Vec3();

    this.#createFrame(surfaceLift);
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
    if (!this.#entity) {
      return false;
    }
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

  repulsionForMovement(fromX, fromZ, toX, toZ, radius = 0) {
    if (!this.#entity) {
      return null;
    }
    this.#inverseWorldTransform ??= this.#entity
      .getWorldTransform()
      .clone()
      .invert();
    const elevation = this.#entity.getPosition().y;
    this.#collisionWorldPoint.set(fromX, elevation, fromZ);
    this.#inverseWorldTransform.transformPoint(
      this.#collisionWorldPoint,
      this.#repulsionFromLocalPoint,
    );
    this.#collisionWorldPoint.set(toX, elevation, toZ);
    this.#inverseWorldTransform.transformPoint(
      this.#collisionWorldPoint,
      this.#collisionLocalPoint,
    );
    if (
      Math.abs(this.#collisionLocalPoint.x) >
        PORTAL_COLLISION_HALF_DEPTH + radius ||
      Math.abs(this.#collisionLocalPoint.z) >
        (FRAME_WIDTH_BLOCKS * this.#cubeSize) / 2 + radius ||
      Math.abs(this.#collisionLocalPoint.x) >
        Math.abs(this.#repulsionFromLocalPoint.x) + 0.000001
    ) {
      return null;
    }

    const side = this.#repulsionFromLocalPoint.x >= 0 ? 1 : -1;
    this.#entity
      .getWorldTransform()
      .transformVector(
        this.#repulsionDirection.set(side, 0, 0),
        this.#repulsionDirection,
      );
    const length = Math.hypot(
      this.#repulsionDirection.x,
      this.#repulsionDirection.z,
    );
    if (length <= 0.001) {
      return null;
    }
    return {
      x: this.#repulsionDirection.x / length,
      z: this.#repulsionDirection.z / length,
    };
  }

  setColor(value) {
    const color = colorFromValue(this.#pc, value, DEFAULT_GATEWAY_COLOR);
    this.#portalMaterial?.setParameter("uColor", [color.r, color.g, color.b]);
    if (this.#bannerMaterial) {
      this.#bannerMaterial.diffuse = new this.#pc.Color(
        color.r * 0.35,
        color.g * 0.35,
        color.b * 0.35,
      );
      this.#bannerMaterial.emissive = new this.#pc.Color(
        color.r * 0.02,
        color.g * 0.02,
        color.b * 0.02,
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
    if (!hit) {
      return;
    }
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
    this.#repulsionFromLocalPoint = null;
    this.#repulsionDirection = null;
    this.endWindGesture();
  }

  #createFrame(surfaceLift) {
    const frame = this.#modelLibrary.instantiate(Gateway.modelUrl);
    frame.name = "Gateway frame instance";
    frame.setLocalPosition(0, surfaceLift, 0);
    this.#entity.addChild(frame);
    this.#createBanner(surfaceLift);
  }

  #createBanner(surfaceLift) {
    const pc = this.#pc;
    const width = this.#cubeSize * 6;
    const height = this.#cubeSize * 5;
    const yTopBlocks =
      FRAME_OPENING_HEIGHT_BLOCKS + FRAME_LINTEL_HEIGHT_BLOCKS - 0.2;
    const yTop = yTopBlocks * this.#cubeSize + surfaceLift;
    const centerZ = 0;
    const faceX = (FRAME_DEPTH_BLOCKS * this.#cubeSize) / 2 + 0.012;
    const columnSegments = 12;
    const rowSegments = 8;
    this.#bannerInteraction = {
      planeX: faceX + 0.03,
      width,
      height,
      yTop,
      centerZ,
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
          centerZ + u * (width / 2) * taper,
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
    meshInstance.castShadow = true;
    meshInstance.receiveShadow = true;
    const banner = new pc.Entity("Gateway hanging cloth");
    banner.addComponent("render", {
      meshInstances: [meshInstance],
      castShadows: true,
      receiveShadows: true,
    });
    this.#entity.addChild(banner);

    const centerY = yTop - height * 0.48;
    const signHalfWidth = width * 0.3;
    const signHalfHeight = width * 0.3;
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
    this.#emblemMaterial.diffuse = colorFromValue(this.#pc, 0xeaf8ff);
    this.#emblemMaterial.diffuseMap = signTexture;
    this.#emblemMaterial.emissive = colorFromValue(this.#pc, 0xeaf8ff);
    this.#emblemMaterial.emissiveMap = signTexture;
    this.#emblemMaterial.emissiveIntensity = 0.55;
    this.#emblemMaterial.opacityMap = signTexture;
    this.#emblemMaterial.opacityMapChannel = "a";
    this.#emblemMaterial.alphaTest = 0.08;
    this.#emblemMaterial.blendType = pc.BLEND_NONE;
    this.#emblemMaterial.depthWrite = true;
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
    this.#emblemBasePosition = [faceX + 0.082, centerY, centerZ];
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
    if (!this.#entity || !this.#bannerInteraction) {
      return null;
    }

    const pc = this.#pc;
    const inverse = this.#entity.getWorldTransform().clone().invert();
    const localStart = inverse.transformPoint(rayStart, new pc.Vec3());
    const localEnd = inverse.transformPoint(rayEnd, new pc.Vec3());
    const directionX = localEnd.x - localStart.x;
    const { planeX, width, height, yTop, centerZ } = this.#bannerInteraction;

    if (Math.abs(directionX) < 0.000001) {
      return null;
    }

    const distance = (planeX - localStart.x) / directionX;
    if (distance < 0 || distance > 1) {
      return null;
    }

    const point = new pc.Vec3(
      planeX,
      localStart.y + (localEnd.y - localStart.y) * distance,
      localStart.z + (localEnd.z - localStart.z) * distance,
    );
    if (
      bounded &&
      (point.y > yTop + 0.03 ||
        point.y < yTop - height - 0.09 ||
        Math.abs(point.z - centerZ) > width / 2 + 0.045)
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
    const segments = 24;
    const geometry = new pc.Geometry();
    geometry.positions = [];
    geometry.uvs = [];
    geometry.indices = [];
    for (let row = 0; row <= segments; row += 1) {
      const v = row / segments;
      for (let column = 0; column <= segments; column += 1) {
        const u = column / segments;
        geometry.positions.push(0, v * height, -halfWidth + u * width);
        geometry.uvs.push(u, v);
      }
    }
    const rowLength = segments + 1;
    for (let row = 0; row < segments; row += 1) {
      for (let column = 0; column < segments; column += 1) {
        const bottomLeft = row * rowLength + column;
        const bottomRight = bottomLeft + 1;
        const topLeft = bottomLeft + rowLength;
        const topRight = topLeft + 1;
        geometry.indices.push(
          bottomLeft,
          bottomRight,
          topRight,
          bottomLeft,
          topRight,
          topLeft,
        );
      }
    }

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
    const portalColor = colorFromValue(this.#pc, DEFAULT_GATEWAY_COLOR);
    this.#portalMaterial.setParameter("uColor", [
      portalColor.r,
      portalColor.g,
      portalColor.b,
    ]);
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

}
