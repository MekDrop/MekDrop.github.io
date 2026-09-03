export const GATEWAY_BANNER_SIGNS = [
  "✧",
  "◇",
  "◎",
  "※",
  "⌁",
  "⟡",
  "⋈",
  "≋",
  "⊹",
  "◌",
  "⧫",
  "⟁",
];

/** Creates a transparent texture containing one decorative Unicode glyph. */
export class GatewayBannerSign {
  static createTexture(pc, graphicsDevice, symbol) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, size, size);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font =
      "700 82px 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif";
    context.lineJoin = "round";
    context.lineWidth = 7;
    context.strokeStyle = "rgba(28, 50, 65, 0.45)";
    context.strokeText(symbol, size / 2, size / 2 + 3);
    context.fillStyle = "#eaf8ff";
    context.fillText(symbol, size / 2, size / 2 + 3);

    const texture = new pc.Texture(graphicsDevice, {
      name: `Gateway banner sign ${symbol}`,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      magFilter: pc.FILTER_LINEAR,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      anisotropy: 4,
      mipmaps: true,
    });
    texture.setSource(canvas);
    return texture;
  }
}
