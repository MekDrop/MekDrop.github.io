const TEXTURE_SIZE = 32;

/** Creates a hard-edged stone face matching the game's chunky voxel style. */
export class CastleStoneTexture {
  static create(pc, graphicsDevice) {
    const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    for (let y = 0; y < TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < TEXTURE_SIZE; x += 1) {
        const edge = Math.min(x, y, TEXTURE_SIZE - 1 - x, TEXTURE_SIZE - 1 - y);
        let shade = 222;

        if (edge < 2) {
          shade = 112;
        } else if (x < 6 || y < 6) {
          shade = 255;
        } else if (x >= TEXTURE_SIZE - 6 || y >= TEXTURE_SIZE - 6) {
          shade = 174;
        } else if ((x > 19 && y > 9 && y < 12) || (x > 8 && x < 11 && y > 20)) {
          shade = 178;
        } else if ((x + y * 3) % 17 < 2) {
          shade = 208;
        }

        const index = (y * TEXTURE_SIZE + x) * 4;
        pixels[index] = shade;
        pixels[index + 1] = shade;
        pixels[index + 2] = Math.min(255, shade + 2);
        pixels[index + 3] = 255;
      }
    }

    const texture = new pc.Texture(graphicsDevice, {
      name: "Castle cel-shaded stone",
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      format: pc.PIXELFORMAT_RGBA8,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      magFilter: pc.FILTER_NEAREST,
      minFilter: pc.FILTER_NEAREST,
      mipmaps: false,
    });
    texture.lock().set(pixels);
    texture.unlock();
    return texture;
  }
}
