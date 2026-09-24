import meadowGrassModelUrl from "../../models/ground-cover/meadow-grass.glb?url";
import cloverModelUrl from "../../models/ground-cover/clover-patch.glb?url";
import { GrassCarpetLayout } from "./GrassCarpetLayout.js";
import vertexShader from "./GrassCarpet.vert?raw";
import fragmentShader from "./GrassCarpet.frag?raw";
import normalShader from "./GrassCarpetNormal.frag?raw";

const BASE_FADE_START_ZOOM = 1;
const BASE_FADE_END_ZOOM = 1.22;
const DETAIL_FADE_START_ZOOM = 1.5;
const DETAIL_FADE_END_ZOOM = 2.25;

function revealAtZoom(zoom, start, end) {
  const progress = Math.max(0, Math.min(1, (zoom - start) / (end - start)));
  return progress * progress * (3 - 2 * progress);
}

export class GrassCarpet {
  static get modelUrls() {
    return [meadowGrassModelUrl, cloverModelUrl];
  }

  #entity;
  #material;
  #variantMap;
  #batches = [];

  constructor({
    pc,
    device,
    mapData,
    modelLibrary,
    tileColors,
    variantForTile,
    zoom = 1,
  }) {
    this.#variantMap = new pc.Texture(device, {
      name: "Grass tile variants",
      width: mapData.cols,
      height: mapData.rows,
      format: pc.PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
      minFilter: pc.FILTER_NEAREST,
      magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });
    const variants = this.#variantMap.lock();
    for (let row = 0; row < mapData.rows; row += 1) {
      for (let col = 0; col < mapData.cols; col += 1) {
        const offset = (row * mapData.cols + col) * 4;
        variants[offset] = variantForTile(
          col,
          row,
          mapData.heightmap[row][col] - 1,
        );
        variants[offset + 3] = 255;
      }
    }
    this.#variantMap.unlock();
    this.#entity = new pc.Entity("Short grass carpet");
    this.#material = new pc.StandardMaterial();
    this.#material.name = "Short living grass";
    this.#material.gloss = 0;
    this.#material.useMetalness = true;
    this.#material.metalness = 0;
    this.#material.cull = pc.CULLFACE_NONE;
    this.#material.twoSidedLighting = true;
    this.#material.setParameter("uGrassBroadleaf", 0);
    this.#material.setParameter("uGrassVariantMap", this.#variantMap);
    this.#material.setParameter(
      "uGrassVariantColors[0]",
      new Float32Array(tileColors.flat()),
    );
    this.#material.setParameter("uGrassVariantMapSize", [
      mapData.cols,
      mapData.rows,
    ]);
    this.#material.setParameter("uGrassBoundaryExtension", [0, 0, 0, 0]);
    this.#material.setParameter("uGrassGridOffset", [
      (mapData.cols - 1) / 2,
      (mapData.rows - 1) / 2,
    ]);
    this.#material.setParameter("uGrassWindDirection", [1, 0]);
    this.#material.setParameter("uGrassWindStrength", 0);
    this.#material.setParameter("uGrassLodReveal", 1);
    this.#material.shaderChunks.glsl.set("transformVS", vertexShader);
    this.#material.shaderChunks.glsl.set("diffusePS", fragmentShader);
    this.#material.shaderChunks.glsl.set("normalMapPS", normalShader);
    this.#material.update();

    const chunks = new Map();
    const matrix = new pc.Mat4();
    const position = new pc.Vec3();
    const rotation = new pc.Quat();
    const scale = new pc.Vec3();
    for (const placement of GrassCarpetLayout.create(mapData)) {
      const key = `${placement.chunk}:${placement.detail}:${placement.broadleaf}:${placement.castleRearGrass}:${placement.boundaryExtension}`;
      const chunk = chunks.get(key) ?? {
        matrices: [],
        placements: [],
        detail: placement.detail,
        castleRearGrass: placement.castleRearGrass,
        broadleaf: placement.broadleaf,
        boundaryExtension: placement.boundaryExtension,
      };
      rotation.setFromEulerAngles(0, placement.rotation, 0);
      matrix.setTRS(
        position.set(placement.x, placement.y, placement.z),
        rotation,
        scale.set(placement.width, placement.height, placement.width),
      );
      chunk.matrices.push(...matrix.data);
      chunk.placements.push(placement);
      chunks.set(key, chunk);
    }
    for (const [key, chunk] of chunks) {
      const modelUrl = chunk.broadleaf ? cloverModelUrl : meadowGrassModelUrl;
      const batch = modelLibrary.instantiateMergedBatch(
        modelUrl,
        chunk.matrices,
        {
          name: `Short grass ${key}`,
          material: this.#material,
          castShadows: false,
          receiveShadows: true,
          dynamic: true,
        },
      );
      // Instanced models otherwise have only the source clump's bounds. Bound
      // each terrain patch so offscreen grass can be culled as one draw call.
      const minimum = new pc.Vec3(Infinity, Infinity, Infinity);
      const maximum = new pc.Vec3(-Infinity, -Infinity, -Infinity);
      for (const placement of chunk.placements) {
        minimum.min(
          position.set(
            placement.x - 0.25,
            placement.y - 0.15,
            placement.z - 0.25,
          ),
        );
        maximum.max(
          position.set(
            placement.x + 0.25,
            placement.y + Math.max(0.2, placement.height + 0.05),
            placement.z + 0.25,
          ),
        );
      }
      const bounds = new pc.BoundingBox();
      bounds.setMinMax(minimum, maximum);
      for (const instance of batch.entity.render.meshInstances) {
        instance.setParameter("uGrassBroadleaf", chunk.broadleaf ? 1 : 0);
        instance.setParameter(
          "uGrassBoundaryExtension",
          chunk.boundaryExtension,
        );
        instance.cull = true;
        instance.setCustomAabb(bounds);
      }
      this.#entity.addChild(batch.entity);
      this.#batches.push({
        ...batch,
        placements: chunk.placements,
        detail: chunk.detail,
        castleRearGrass: chunk.castleRearGrass,
      });
    }
    this.zoom = zoom;
  }

  set zoom(value) {
    const baseReveal = revealAtZoom(
      value,
      BASE_FADE_START_ZOOM,
      BASE_FADE_END_ZOOM,
    );
    const detailReveal = revealAtZoom(
      value,
      DETAIL_FADE_START_ZOOM,
      DETAIL_FADE_END_ZOOM,
    );
    for (const batch of this.#batches) {
      const reveal = batch.detail
        ? detailReveal
        : batch.castleRearGrass
          ? 1
          : baseReveal;
      batch.entity.enabled = reveal > 0;
      if (reveal > 0) {
        for (const instance of batch.entity.render.meshInstances) {
          instance.setParameter("uGrassLodReveal", reveal);
        }
      }
    }
  }

  get entity() {
    return this.#entity;
  }

  get material() {
    return this.#material;
  }

  clearAt({ x, y, z }, radius = 0.65) {
    for (const { vertexBuffer, placements } of this.#batches) {
      const indices = [];
      placements.forEach((placement, index) => {
        if (
          Math.abs(placement.y - y) < 0.25 &&
          Math.hypot(placement.x - x, placement.z - z) < radius
        ) {
          indices.push(index);
        }
      });
      if (!indices.length) {
        continue;
      }
      const storage = vertexBuffer.lock();
      const data =
        storage instanceof Float32Array ? storage : new Float32Array(storage);
      for (const index of indices) {
        data[index * 16 + 13] = -10000;
      }
      vertexBuffer.unlock();
    }
  }

  supportPointsWithin({ x, y, z }, radius) {
    const points = [];
    for (const { placements } of this.#batches) {
      for (const placement of placements) {
        if (
          Math.abs(placement.y - y) <= 0.08 &&
          Math.hypot(placement.x - x, placement.z - z) <= radius
        ) {
          points.push({ x: placement.x, y: placement.y, z: placement.z });
        }
      }
    }
    return points;
  }

  destroy() {
    this.#entity.destroy();
    for (const { vertexBuffer } of this.#batches) {
      vertexBuffer.destroy();
    }
    this.#batches = [];
    this.#material.destroy();
    this.#variantMap.destroy();
  }
}
