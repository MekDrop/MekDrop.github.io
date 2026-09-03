const TEXTURE_SIZE = 32;

export class HeroPaintedTexture {
  static create(pc, graphicsDevice, name, color) {
    const baseRed = (color >> 16) & 0xff;
    const baseGreen = (color >> 8) & 0xff;
    const baseBlue = color & 0xff;
    const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    const salt = [...name].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );

    for (let y = 0; y < TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < TEXTURE_SIZE; x += 1) {
        const u = x / (TEXTURE_SIZE - 1);
        const v = y / (TEXTURE_SIZE - 1);
        const highlightDistance = Math.hypot(u - 0.27, v - 0.2);
        const paintedHighlight = Math.max(0, 1 - highlightDistance * 3.4);
        const lowerOcclusion = Math.max(0, v - 0.58) * 0.28;
        const sideOcclusion = Math.max(0, u - 0.7) * 0.13;
        const brushNoise =
          (((x * 17 + y * 31 + salt * 7) % 11) - 5) * 0.004;
        const shade =
          0.9 +
          (1 - v) * 0.08 +
          paintedHighlight * 0.2 -
          lowerOcclusion -
          sideOcclusion +
          brushNoise;
        const index = (y * TEXTURE_SIZE + x) * 4;
        pixels[index] = Math.min(255, Math.round(baseRed * shade));
        pixels[index + 1] = Math.min(255, Math.round(baseGreen * shade));
        pixels[index + 2] = Math.min(255, Math.round(baseBlue * shade));
        pixels[index + 3] = 255;
      }
    }

    const texture = new pc.Texture(graphicsDevice, {
      name: `Hero hand-painted ${name}`,
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      format: pc.PIXELFORMAT_RGBA8,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      magFilter: pc.FILTER_LINEAR,
      minFilter: pc.FILTER_LINEAR,
      mipmaps: false,
    });
    texture.lock().set(pixels);
    texture.unlock();
    return texture;
  }
}
