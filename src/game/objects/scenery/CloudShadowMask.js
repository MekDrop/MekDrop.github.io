import { Vec2 } from "playcanvas";
import cloudVoxels from "./CloudVoxelVariants.json";
import skySettings from "./CloudSkySettings.json";

/**
 * Projects the original translucent cloud cubes along the sunlight direction.
 */
export class CloudShadowMask {
  /**
   * Integer arithmetic stays exact in both JavaScript and shader float32.
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  static hash(x, z) {
    const qx = ((Math.floor(x) % 251) + 251) % 251;
    const qz = ((Math.floor(z) % 251) + 251) % 251;
    let value = (qx * 73 + qz * 151 + 19) % 251;
    value = (value * value * 13 + value * 7 + 17) % 65521;

    return ((value * 53 + 113) % 65521) / 65521;
  }

  /**
   * @param {number} x
   * @param {number} z
   * @returns {{x: number, z: number, height: number, scale: number, opacity: number, variant: number}|null}
   * @param {typeof skySettings.upper} bank
   */
  static cloud(x, z, bank = skySettings.upper) {
    const hash = CloudShadowMask.hash;
    const seedX = x + bank.seed[0];
    const seedZ = z + bank.seed[1];
    if (hash(seedX + 47, seedZ + 47) > bank.coverage) {
      return null;
    }
    const shape = hash(seedX, seedZ);
    const layer = Math.floor(hash(seedX + 19, seedZ + 19) * 3);

    return {
      x: (x + 0.1 + shape * 0.8) * bank.spacing,
      z: (z + 0.1 + hash(seedX + 7, seedZ + 7) * 0.8) * bank.spacing,
      height: bank.height * (0.94 + hash(seedX + 29, seedZ + 29) * 0.12),
      scale: [0.56, 0.78, 1][layer] * bank.scale,
      opacity: [0.28, 0.46, 0.7][layer],
      variant: Math.floor(shape * 20),
    };
  }

  /**
   * @param {{minX: number, minZ: number, span: number, resolution: number, slope: import("playcanvas").Vec2}} options
   * @returns {Uint8Array}
   */
  static bake({ minX, minZ, span, resolution, slope }) {
    const transmission = new Float32Array(resolution * resolution).fill(1);
    // Cover the receiver window plus the sunlight offset at cloud altitude.
    const { height, spacing } = skySettings.upper;
    const minCellX = Math.floor((minX + slope.x * height - 20) / spacing);
    const minCellZ = Math.floor((minZ + slope.y * height - 20) / spacing);
    const maxCellX = Math.ceil((minX + span + slope.x * height + 20) / spacing);
    const maxCellZ = Math.ceil((minZ + span + slope.y * height + 20) / spacing);
    for (let x = minCellX; x <= maxCellX; x++) {
      for (let z = minCellZ; z <= maxCellZ; z++) {
        const cloud = CloudShadowMask.cloud(x, z);
        if (!cloud) {
          continue;
        }
        for (const [vx, vy, vz] of cloudVoxels.variants[cloud.variant]) {
          const step = cloudVoxels.cubeStep * cloud.scale;
          const cx = cloud.x + (vx + vz) * Math.SQRT1_2 * step;
          const cz = cloud.z + (-vx + vz) * Math.SQRT1_2 * step;
          const cy = cloud.height + vy * step;
          const half = cloudVoxels.cubeSize * cloud.scale * 0.5;
          const corners = [];
          for (const dx of [-half, half]) {
            for (const dy of [-half, half]) {
              for (const dz of [-half, half]) {
                corners.push(new Vec2(
                  ((cx + dx - (cy + dy) * slope.x - minX) / span) * resolution,
                  ((cz + dz - (cy + dy) * slope.y - minZ) / span) * resolution,
                ));
              }
            }
          }
          CloudShadowMask.#rasterize(transmission, resolution, CloudShadowMask.#hull(corners), cloud.opacity);
        }
      }
    }
    // A separable blur makes broad penumbrae without changing alpha weighting.
    const horizontal = CloudShadowMask.#blur(transmission, resolution, true);
    const blurred = CloudShadowMask.#blur(horizontal, resolution, false);
    const pixels = new Uint8Array(resolution * resolution * 4);
    for (let i = 0; i < blurred.length; i++) {
      const value = Math.round(blurred[i] * 255);
      pixels.set([value, value, value, 255], i * 4);
    }

    return pixels;
  }

  /**
   * @param {Vec2} a
   * @param {Vec2} b
   * @param {Vec2} c
   * @returns {number}
   */
  static #cross(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /**
   * @param {Vec2[]} points
   * @returns {Vec2[]}
   */
  static #hull(points) {
    points.sort(CloudShadowMask.#compare);
    const lower = CloudShadowMask.#halfHull(points);
    const upper = CloudShadowMask.#halfHull([...points].reverse());

    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  /**
   * @param {Vec2} a
   * @param {Vec2} b
   * @returns {number}
   */
  static #compare(a, b) {
    return a.x - b.x || a.y - b.y;
  }

  /**
   * @param {Vec2[]} points
   * @returns {Vec2[]}
   */
  static #halfHull(points) {
    const hull = [];
    for (const point of points) {
      while (hull.length > 1 && CloudShadowMask.#cross(hull.at(-2), hull.at(-1), point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }

    return hull;
  }

  /**
   * @param {Float32Array} pixels
   * @param {number} resolution
   * @param {Vec2[]} polygon
   * @param {number} opacity
   */
  static #rasterize(pixels, resolution, polygon, opacity) {
    const minX = Math.max(0, Math.floor(Math.min(...polygon.map(CloudShadowMask.#x))));
    const maxX = Math.min(resolution - 1, Math.ceil(Math.max(...polygon.map(CloudShadowMask.#x))));
    const minZ = Math.max(0, Math.floor(Math.min(...polygon.map(CloudShadowMask.#z))));
    const maxZ = Math.min(resolution - 1, Math.ceil(Math.max(...polygon.map(CloudShadowMask.#z))));
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const point = new Vec2(x + 0.5, z + 0.5);
        let inside = true;
        for (let edge = 0; edge < polygon.length; edge++) {
          if (CloudShadowMask.#cross(polygon[edge], polygon[(edge + 1) % polygon.length], point) < 0) {
            inside = false;
            break;
          }
        }
        if (inside) {
          pixels[z * resolution + x] *= 1 - opacity;
        }
      }
    }
  }

  /**
   * @param {Vec2} point
   * @returns {number}
   */
  static #x(point) {
    return point.x;
  }

  /**
   * @param {Vec2} point
   * @returns {number}
   */
  static #z(point) {
    return point.y;
  }

  /**
   * @param {Float32Array} source
   * @param {number} resolution
   * @param {boolean} horizontal
   * @returns {Float32Array}
   */
  static #blur(source, resolution, horizontal) {
    const target = new Float32Array(source.length);
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        let value = 0;
        for (let offset = -2; offset <= 2; offset++) {
          const sx = Math.max(0, Math.min(resolution - 1, x + (horizontal ? offset : 0)));
          const sz = Math.max(0, Math.min(resolution - 1, z + (horizontal ? 0 : offset)));
          value += source[sz * resolution + sx];
        }
        target[z * resolution + x] = value / 5;
      }
    }

    return target;
  }
}
