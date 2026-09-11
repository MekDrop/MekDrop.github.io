export function colorFromHex(pc, value) {
  return new pc.Color(
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  );
}

export function shadeHexColor(value, shade) {
  const red = Math.round(((value >> 16) & 0xff) * shade);
  const green = Math.round(((value >> 8) & 0xff) * shade);
  const blue = Math.round((value & 0xff) * shade);
  return (red << 16) | (green << 8) | blue;
}
