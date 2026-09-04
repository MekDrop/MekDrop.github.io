import {
  AMBIENT_WIND_BASE_SPEED,
  AMBIENT_WIND_DIRECTION,
  getAmbientWind,
} from "../shared/BannerWind.js";
import cloudFragmentShader from "./CubeCloud.frag?raw";
import cloudVertexShader from "./CubeCloud.vert?raw";

const CLOUD_VARIANT_COUNT = 20;
const CLOUD_COUNT = 28;
const CUBE_SIZE = 1.08;
const CUBE_STEP = 0.9;
const WIND_FIELD_SCALE = 1.05;
const BLUE_NOISE_CANDIDATES = 48;
const FAR_CLOUD_BANK_COUNT = 3;
const FAR_CLOUD_BANK_OFFSETS = Object.freeze([
  { x: 0, y: 0, z: 0 },
  { x: 2.7, y: 0.28, z: 0.9 },
  { x: -2.35, y: -0.16, z: 1.65 },
  { x: 0.65, y: 0.12, z: -2.15 },
]);
const CLOUD_DEPTH_LAYERS = Object.freeze([
  {
    name: "far",
    scale: 0.56,
    opacity: 0.28,
    speed: 0.45,
    cameraFollow: 0.78,
    zoomResponse: 0.35,
    topColor: [0.78, 0.89, 0.96],
    sideColor: [0.55, 0.7, 0.81],
  },
  {
    name: "middle",
    scale: 0.78,
    opacity: 0.46,
    speed: 0.7,
    cameraFollow: 0.48,
    zoomResponse: 0.6,
    topColor: [0.88, 0.95, 0.99],
    sideColor: [0.64, 0.78, 0.88],
  },
  {
    name: "near",
    scale: 1,
    opacity: 0.7,
    speed: 1,
    cameraFollow: 0.18,
    zoomResponse: 0.85,
    topColor: [0.96, 0.985, 1],
    sideColor: [0.72, 0.84, 0.92],
  },
]);

function addVoxel(voxels, occupied, x, y, z) {
  const key = `${x}:${y}:${z}`;
  if (occupied.has(key)) return;
  occupied.add(key);
  voxels.push([x, y, z]);
}

function createCloudVariant(variant) {
  const voxels = [];
  const occupied = new Set();
  const width = 5 + (variant % 4);
  const left = -Math.floor(width / 2);
  const right = left + width - 1;
  const crownShift = (Math.floor(variant / 4) % 3) - 1;

  for (let x = left; x <= right; x += 1) {
    addVoxel(voxels, occupied, x, 0, 0);
  }

  const depthWidth = 2 + (variant % 3);
  const depthLeft = crownShift - Math.floor(depthWidth / 2);
  for (let index = 0; index < depthWidth; index += 1) {
    addVoxel(voxels, occupied, depthLeft + index, 0, 1);
  }
  addVoxel(voxels, occupied, crownShift, 0, -1);
  if (variant % 2 === 0) {
    addVoxel(voxels, occupied, crownShift - 1, 0, -1);
  }

  const middleWidth = 2 + ((variant + 1) % 3);
  const middleLeft = crownShift - Math.floor(middleWidth / 2);
  for (let index = 0; index < middleWidth; index += 1) {
    addVoxel(voxels, occupied, middleLeft + index, 1, 0);
  }
  if (variant % 3 !== 1) {
    addVoxel(voxels, occupied, crownShift, 1, 1);
  }

  addVoxel(voxels, occupied, crownShift, 2, 0);
  if (variant % 5 === 3) {
    addVoxel(voxels, occupied, crownShift + 1, 2, 0);
  }
  if (variant % 4 === 1) {
    addVoxel(voxels, occupied, left - 1, 0, 0);
  }
  if (variant % 4 === 2) {
    addVoxel(voxels, occupied, right + 1, 0, 0);
  }

  return Object.freeze(voxels);
}

const CLOUD_VARIANTS = Object.freeze(
  Array.from({ length: CLOUD_VARIANT_COUNT }, (_, variant) =>
    createCloudVariant(variant),
  ),
);

export class CubeCloudField {
  #pc;
  #app;
  #mapData;
  #layerId;
  #entity;
  #mesh;
  #materials = [];
  #clusters = [];
  #vertexBuffers = [];
  #elapsed = 0;
  #windSpeed = AMBIENT_WIND_BASE_SPEED;
  #windDirection = { ...AMBIENT_WIND_DIRECTION };
  #viewRotation = null;
  #cameraState = { panX: 0, panZ: 0, zoom: 1 };
  #seed;

  constructor({ pc, app, mapData, layerId }) {
    this.#pc = pc;
    this.#app = app;
    this.#mapData = mapData;
    this.#layerId = layerId;
    this.#seed = this.#hashString(mapData.layoutSignature ?? "cube-clouds");
    this.#entity = new pc.Entity("Shader cube cloud field");

    this.#createResources();
    this.#buildClouds();
    this.setCameraState({ rotation: 0, panX: 0, panZ: 0, zoom: 1 });
  }

  get entity() {
    return this.#entity;
  }

  get windSpeed() {
    return this.#windSpeed;
  }

  get wind() {
    return {
      direction: { ...this.#windDirection },
      speed: this.#windSpeed,
    };
  }

  update(deltaTime) {
    const frameTime = Math.min(deltaTime, 0.1);
    this.#elapsed += frameTime;
    const wind = getAmbientWind(this.#elapsed);
    this.#windSpeed = wind.speed;
    this.#windDirection = wind.direction;
    for (const cluster of this.#clusters) {
      const travel = this.#windSpeed * cluster.speedScale * frameTime;
      cluster.x = this.#wrapFieldPosition(
        cluster.x + this.#windDirection.x * travel,
        cluster.fieldMinimum,
        cluster.fieldSpan,
      );
      cluster.z = this.#wrapFieldPosition(
        cluster.z + this.#windDirection.z * travel,
        cluster.fieldMinimum,
        cluster.fieldSpan,
      );
      this.#positionCluster(cluster);
    }
  }

  setCameraState({ rotation, panX, panZ, zoom }) {
    this.#cameraState = { panX, panZ, zoom };
    this.#setViewRotation(rotation);
    for (const cluster of this.#clusters) this.#positionCluster(cluster);
  }

  #setViewRotation(rotation) {
    if (rotation === this.#viewRotation && this.#clusters.length) return;
    this.#viewRotation = rotation;
    const cameraFacingYaw = ((45 + rotation * 90) * Math.PI) / 180;
    const yaw = [Math.cos(cameraFacingYaw), Math.sin(cameraFacingYaw)];
    for (const material of this.#materials) {
      material.setParameter("uCloudYaw", yaw);
    }
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    for (const buffer of this.#vertexBuffers) buffer.destroy();
    this.#vertexBuffers = [];
    for (const material of this.#materials) material.destroy();
    this.#materials = [];
    if (this.#mesh) {
      this.#mesh.decRefCount();
      if (this.#mesh.refCount < 1) this.#mesh.destroy();
      this.#mesh = null;
    }
    this.#clusters = [];
  }

  #createResources() {
    const pc = this.#pc;
    this.#mesh = pc.Mesh.fromGeometry(
      this.#app.graphicsDevice,
      new pc.BoxGeometry(),
    );
    this.#mesh.incRefCount();

    this.#materials = CLOUD_DEPTH_LAYERS.map((layer) => {
      const material = new pc.ShaderMaterial({
        uniqueName: `shader-cube-clouds-${layer.name}`,
        vertexGLSL: cloudVertexShader,
        fragmentGLSL: cloudFragmentShader,
        attributes: {
          vertex_position: pc.SEMANTIC_POSITION,
          vertex_normal: pc.SEMANTIC_NORMAL,
          instance_line1: pc.SEMANTIC_ATTR11,
          instance_line2: pc.SEMANTIC_ATTR12,
          instance_line3: pc.SEMANTIC_ATTR14,
          instance_line4: pc.SEMANTIC_ATTR15,
        },
      });
      material.name = `${layer.name} shader cube clouds`;
      material.blendType = pc.BLEND_NORMAL;
      material.depthWrite = false;
      material.setParameter("uCloudTopColor", layer.topColor);
      material.setParameter("uCloudSideColor", layer.sideColor);
      material.setParameter("uLightDirection", [0.42, 0.82, 0.38]);
      material.setParameter("uOpacity", layer.opacity);
      material.setParameter("uCloudYaw", [Math.SQRT1_2, Math.SQRT1_2]);
      material.update();
      return material;
    });
  }

  #buildClouds() {
    const pc = this.#pc;
    const { cols, rows } = this.#mapData;
    const variantOffset = this.#seed % CLOUD_VARIANT_COUNT;
    const fieldExtent = Math.max(cols, rows) * WIND_FIELD_SCALE;
    const fieldMinimum = -fieldExtent;
    const fieldSpan = fieldExtent * 2;
    const initialPositions = this.#createInitialPositions({
      fieldMinimum,
      fieldSpan,
    });
    const farBankAnchors = this.#createInitialPositions({
      fieldMinimum,
      fieldSpan,
      count: FAR_CLOUD_BANK_COUNT,
      seedSalt: 211,
    });

    Array.from({ length: CLOUD_COUNT }, (_, cloudIndex) => {
      const depthLayerIndex = cloudIndex % CLOUD_DEPTH_LAYERS.length;
      const depthLayer = CLOUD_DEPTH_LAYERS[depthLayerIndex];
      const isFarCloud = depthLayerIndex === 0;
      const farCloudIndex = Math.floor(
        cloudIndex / CLOUD_DEPTH_LAYERS.length,
      );
      const farBankIndex = farCloudIndex % FAR_CLOUD_BANK_COUNT;
      const farBankSlot = Math.floor(farCloudIndex / FAR_CLOUD_BANK_COUNT);
      const variantIndex =
        (variantOffset + cloudIndex * 7) % CLOUD_VARIANT_COUNT;
      const variant = CLOUD_VARIANTS[variantIndex];
      const scale =
        (0.96 + (this.#hash(cloudIndex, 13) % 17) / 100) * depthLayer.scale;
      const matrices = [];

      for (const [x, y, z] of variant) {
        const matrix = new pc.Mat4();
        matrix.setTRS(
          new pc.Vec3(x * CUBE_STEP, y * CUBE_STEP, z * CUBE_STEP),
          pc.Quat.IDENTITY,
          new pc.Vec3(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
        );
        matrices.push(...matrix.data);
      }

      const vertexBuffer = new pc.VertexBuffer(
        this.#app.graphicsDevice,
        pc.VertexFormat.getDefaultInstancingFormat(this.#app.graphicsDevice),
        variant.length,
        { data: new Float32Array(matrices) },
      );
      this.#vertexBuffers.push(vertexBuffer);

      const meshInstance = new pc.MeshInstance(
        this.#mesh,
        this.#materials[depthLayerIndex],
      );
      meshInstance.setInstancing(vertexBuffer, false);
      meshInstance.castShadow = false;
      meshInstance.receiveShadow = false;
      meshInstance.pick = false;

      const clusterEntity = new pc.Entity(
        `${depthLayer.name} shader cloud ${cloudIndex + 1} / variant ${variantIndex + 1}`,
      );
      clusterEntity.addComponent("render", {
        meshInstances: [meshInstance],
        castShadows: false,
        receiveShadows: false,
        layers: [this.#layerId],
      });
      this.#entity.addChild(clusterEntity);

      const bankOffset = FAR_CLOUD_BANK_OFFSETS[farBankSlot];
      const bankAnchor = farBankAnchors[farBankIndex];
      const originY = isFarCloud
        ? 1.65 + (this.#hash(farBankIndex, 29) % 24) / 10 + bankOffset.y
        : 1.2 + (this.#hash(cloudIndex, 29) % 32) / 10;
      const initialPosition = isFarCloud
        ? {
            x: this.#wrapFieldPosition(
              bankAnchor.x + bankOffset.x,
              fieldMinimum,
              fieldSpan,
            ),
            z: this.#wrapFieldPosition(
              bankAnchor.z + bankOffset.z,
              fieldMinimum,
              fieldSpan,
            ),
          }
        : initialPositions[cloudIndex];
      const speedHashIndex = isFarCloud ? farBankIndex : cloudIndex;
      const cluster = {
        entity: clusterEntity,
        originY,
        x: initialPosition.x,
        z: initialPosition.z,
        baseScale: scale,
        depthLayerIndex,
        fieldMinimum,
        fieldSpan,
        speedScale:
          (0.94 + (this.#hash(speedHashIndex, 53) % 121) / 1000) *
          depthLayer.speed,
      };
      this.#positionCluster(cluster);
      this.#clusters.push(cluster);
    });
  }

  #positionCluster(cluster) {
    const depthLayer = CLOUD_DEPTH_LAYERS[cluster.depthLayerIndex];
    const { panX, panZ, zoom } = this.#cameraState;
    const displayScale =
      cluster.baseScale * Math.pow(zoom, depthLayer.zoomResponse - 1);
    cluster.entity.setLocalScale(displayScale, displayScale, displayScale);
    cluster.entity.setLocalPosition(
      cluster.x + panX * depthLayer.cameraFollow,
      cluster.originY,
      cluster.z + panZ * depthLayer.cameraFollow,
    );
  }

  #createInitialPositions({
    fieldMinimum,
    fieldSpan,
    count = CLOUD_COUNT,
    seedSalt = 0,
  }) {
    const positions = [];

    for (let cloudIndex = 0; cloudIndex < count; cloudIndex += 1) {
      let bestCandidate = null;
      let bestDistance = Number.NEGATIVE_INFINITY;

      for (
        let candidateIndex = 0;
        candidateIndex < BLUE_NOISE_CANDIDATES;
        candidateIndex += 1
      ) {
        const sampleIndex = cloudIndex * BLUE_NOISE_CANDIDATES + candidateIndex;
        const xFraction = this.#unitHash(sampleIndex, 71 + seedSalt);
        const zFraction = this.#unitHash(sampleIndex, 97 + seedSalt);
        const candidate = {
          xFraction,
          zFraction,
          x: fieldMinimum + xFraction * fieldSpan,
          z: fieldMinimum + zFraction * fieldSpan,
        };
        const nearestDistance = positions.reduce((nearest, position) => {
          const directXDistance = Math.abs(
            candidate.xFraction - position.xFraction,
          );
          const directZDistance = Math.abs(
            candidate.zFraction - position.zFraction,
          );
          const wrappedXDistance = Math.min(
            directXDistance,
            1 - directXDistance,
          );
          const wrappedZDistance = Math.min(
            directZDistance,
            1 - directZDistance,
          );
          return Math.min(
            nearest,
            Math.hypot(wrappedXDistance, wrappedZDistance),
          );
        }, Number.POSITIVE_INFINITY);

        if (nearestDistance <= bestDistance) continue;
        bestCandidate = candidate;
        bestDistance = nearestDistance;
      }

      positions.push(bestCandidate);
    }

    return positions;
  }

  #wrapFieldPosition(value, minimum, span) {
    return minimum + ((((value - minimum) % span) + span) % span);
  }

  #unitHash(index, salt) {
    return this.#hash(index, salt) / 0xffffffff;
  }

  #hash(index, salt) {
    let value = this.#seed ^ salt;
    value = Math.imul(value ^ (index + 101), 2246822519);
    value ^= value >>> 16;
    return value >>> 0;
  }

  #hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
