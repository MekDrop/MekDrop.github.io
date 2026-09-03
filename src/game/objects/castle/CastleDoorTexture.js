const TEXTURE_SIZE = 64;
const PLANK_COUNT = 4;

/** Creates hand-painted vertical timber planks for the castle's arched doors. */
export class CastleDoorTexture {
  static create(pc, graphicsDevice) {
    const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    const plankWidth = TEXTURE_SIZE / PLANK_COUNT;

    for (let y = 0; y < TEXTURE_SIZE; y += 1) {
      for (let x = 0; x < TEXTURE_SIZE; x += 1) {
        const plank = Math.floor(x / plankWidth);
        const plankX = x % plankWidth;
        const seam = plankX < 1 || plankX >= plankWidth - 1;
        const highlight = plankX >= 2 && plankX <= 4;
        const grain =
          Math.sin(y * 0.42 + plank * 1.9 + x * 0.08) * 7 +
          Math.sin(y * 0.13 - x * 0.17) * 5;
        const knotX = plankX - plankWidth * 0.55;
        const knotY = ((y + plank * 13) % 37) - 18;
        const knotDistance = Math.sqrt(knotX * knotX * 1.8 + knotY * knotY);
        let shade = 1 + grain / 100 + (plank % 2 === 0 ? -0.05 : 0.04);

        if (seam) shade *= 0.48;
        else if (highlight) shade *= 1.12;
        if (knotDistance > 3 && knotDistance < 5) shade *= 0.68;
        if (knotDistance <= 3) shade *= 0.82;

        const index = (y * TEXTURE_SIZE + x) * 4;
        pixels[index] = Math.max(42, Math.min(205, 154 * shade));
        pixels[index + 1] = Math.max(22, Math.min(126, 78 * shade));
        pixels[index + 2] = Math.max(12, Math.min(72, 36 * shade));
        pixels[index + 3] = 255;
      }
    }

    const texture = new pc.Texture(graphicsDevice, {
      name: "Castle hand-painted wood",
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
