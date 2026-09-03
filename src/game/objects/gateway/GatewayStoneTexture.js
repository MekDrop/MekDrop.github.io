const TEXTURE_SIZE = 64;

/** Builds small deterministic stone textures used by gateway voxel blocks. */
export class GatewayStoneTexture {
  static create(pc, graphicsDevice, seed = 1) {
    const height = this.#createHeight(seed);
    const diffuse = this.#createTexture(
      pc,
      graphicsDevice,
      `Gateway stone ${seed} diffuse`,
      this.#createDiffusePixels(height),
    );
    const normal = this.#createTexture(
      pc,
      graphicsDevice,
      `Gateway stone ${seed} normal`,
      this.#createNormalPixels(height),
    );
    return { diffuse, normal };
  }

  static #createHeight(seed) {
    const height = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
    for (let y = 0; y < TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < TEXTURE_SIZE; x += 1) {
        const edgeDistance = Math.min(
          x,
          y,
          TEXTURE_SIZE - 1 - x,
          TEXTURE_SIZE - 1 - y,
        );
        const edgeWear = Math.min(1, edgeDistance / 5);
        const grain = this.#noise(x, y, seed);
        const coarse = this.#noise(
          Math.floor(x / 5),
          Math.floor(y / 5),
          seed + 17,
        );
        const firstCrack =
          x > 7 &&
          x < 49 &&
          Math.abs(y - (19 + Math.sin(x * 0.21 + seed) * 2.4)) < 0.72;
        const secondCrack =
          y > 31 &&
          y < 58 &&
          Math.abs(x - (45 + Math.sin(y * 0.24 + seed * 0.7) * 1.8)) < 0.58;
        const crackDepth = firstCrack || secondCrack ? 0.2 : 0;
        height[y * TEXTURE_SIZE + x] =
          0.57 + grain * 0.11 + coarse * 0.09 + edgeWear * 0.13 - crackDepth;
      }
    }
    return height;
  }

  static #createDiffusePixels(height) {
    const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    for (let index = 0; index < height.length; index += 1) {
      const shade = Math.max(105, Math.min(242, 142 + height[index] * 125));
      const pixelIndex = index * 4;
      pixels[pixelIndex] = shade;
      pixels[pixelIndex + 1] = shade;
      pixels[pixelIndex + 2] = Math.min(255, shade + 3);
      pixels[pixelIndex + 3] = 255;
    }
    return pixels;
  }

  static #createNormalPixels(height) {
    const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    const sample = (x, y) =>
      height[
        Math.max(0, Math.min(TEXTURE_SIZE - 1, y)) * TEXTURE_SIZE +
          Math.max(0, Math.min(TEXTURE_SIZE - 1, x))
      ];

    for (let y = 0; y < TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < TEXTURE_SIZE; x += 1) {
        const slopeX = (sample(x + 1, y) - sample(x - 1, y)) * 3.8;
        const slopeY = (sample(x, y + 1) - sample(x, y - 1)) * 3.8;
        const inverseLength = 1 / Math.hypot(slopeX, slopeY, 1);
        const pixelIndex = (y * TEXTURE_SIZE + x) * 4;
        pixels[pixelIndex] = (-slopeX * inverseLength * 0.5 + 0.5) * 255;
        pixels[pixelIndex + 1] = (slopeY * inverseLength * 0.5 + 0.5) * 255;
        pixels[pixelIndex + 2] = inverseLength * 255;
        pixels[pixelIndex + 3] = 255;
      }
    }
    return pixels;
  }

  static #createTexture(pc, graphicsDevice, name, pixels) {
    const texture = new pc.Texture(graphicsDevice, {
      name,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      format: pc.PIXELFORMAT_RGBA8,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      magFilter: pc.FILTER_LINEAR,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      anisotropy: 4,
      mipmaps: true,
    });
    texture.lock().set(pixels);
    texture.unlock();
    return texture;
  }

  static #noise(x, y, seed) {
    let value = Math.imul(x + seed * 31, 374761393);
    value ^= Math.imul(y + seed * 17, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  }
}
