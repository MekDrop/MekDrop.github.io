import * as THREE from "three";

export const PALETTE_SIZE = 16;

const PALETTE_RAMPS = [
  [[10, 16, 34], [26, 42, 74], [58, 89, 138], [148, 198, 239]],
  [[8, 18, 44], [18, 52, 104], [48, 113, 172], [144, 218, 248]],
  [[10, 26, 20], [22, 64, 46], [58, 122, 84], [154, 215, 147]],
  [[22, 34, 18], [58, 86, 34], [116, 152, 56], [208, 232, 123]],
  [[34, 24, 14], [78, 48, 24], [145, 88, 44], [221, 165, 98]],
  [[38, 22, 18], [88, 42, 30], [156, 78, 52], [232, 158, 108]],
  [[42, 20, 24], [92, 36, 44], [166, 72, 82], [238, 146, 156]],
  [[34, 18, 42], [74, 34, 88], [132, 71, 154], [209, 154, 226]],
  [[18, 22, 44], [42, 50, 94], [79, 96, 168], [164, 184, 237]],
  [[22, 20, 24], [54, 50, 58], [108, 102, 116], [196, 190, 203]],
  [[44, 34, 22], [100, 76, 34], [176, 128, 54], [244, 202, 118]],
  [[42, 26, 10], [102, 54, 16], [190, 102, 26], [252, 180, 76]],
  [[26, 18, 12], [72, 40, 20], [135, 77, 39], [212, 150, 96]],
  [[30, 16, 12], [79, 27, 22], [150, 58, 42], [228, 126, 92]],
  [[46, 18, 14], [108, 30, 22], [191, 58, 40], [248, 118, 92]],
  [[14, 14, 18], [36, 36, 52], [82, 84, 112], [218, 221, 236]],
];

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
const lerp = (start, end, alpha) => start + (end - start) * alpha;
const lerpColor = (start, end, alpha) => [
  lerp(start[0], end[0], alpha),
  lerp(start[1], end[1], alpha),
  lerp(start[2], end[2], alpha),
];
const sampleRamp = (stops, t) => {
  const maxIndex = stops.length - 1;
  const scaled = Math.min(maxIndex, Math.max(0, t)) * maxIndex;
  const index = Math.min(maxIndex - 1, Math.floor(scaled));
  const alpha = scaled - index;
  return lerpColor(stops[index], stops[index + 1], alpha);
};

export const SNES_PALETTE = Array.from({ length: PALETTE_SIZE * PALETTE_SIZE }, (_, index) => {
  const row = Math.floor(index / PALETTE_SIZE);
  const column = index % PALETTE_SIZE;
  const color = sampleRamp(PALETTE_RAMPS[row], column / (PALETTE_SIZE - 1));
  return [
    clampByte(color[0]),
    clampByte(color[1]),
    clampByte(color[2]),
  ];
});

export const SNES_PALETTE_CSS = SNES_PALETTE.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);

export const createPaletteTexture = () => {
  const data = new Uint8Array(PALETTE_SIZE * PALETTE_SIZE * 4);

  for (let i = 0; i < SNES_PALETTE.length; i++) {
    const offset = i * 4;
    const [r, g, b] = SNES_PALETTE[i];
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, PALETTE_SIZE, PALETTE_SIZE, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
