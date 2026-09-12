import { isArray, isString } from "./types.js";

export function colorFromHex(pc, value) {
  return new pc.Color(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  );
}

export function colorFromValue(pc, value, fallback = 0xffffff) {
  if (value instanceof pc.Color) {
    return value.clone();
  }
  if (isArray(value)) {
    return new pc.Color(value[0] ?? 1, value[1] ?? 1, value[2] ?? 1);
  }

  const parsed = isString(value)
    ? Number.parseInt(value.replace(/^#/, ""), 16)
    : value;
  return colorFromHex(pc, Number.isFinite(parsed) ? parsed : fallback);
}

export function shadeHexColor(value, shade) {
  const red = Math.round(((value >> 16) & 0xff) * shade);
  const green = Math.round(((value >> 8) & 0xff) * shade);
  const blue = Math.round((value & 0xff) * shade);
  return (red << 16) | (green << 8) | blue;
}
