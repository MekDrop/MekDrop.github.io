float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

vec3 mono(float value) {
  return vec3(0.94, 0.88, 0.76) * value;
}

vec2 paletteUv(float index) {
  float x = mod(index, 16.0);
  float y = floor(index / 16.0);
  return vec2((x + 0.5) / 16.0, (y + 0.5) / 16.0);
}

float bayer4(vec2 point) {
  vec2 cell = mod(floor(point), 4.0);
  if (cell.y < 0.5) {
    if (cell.x < 0.5) return 0.0;
    if (cell.x < 1.5) return 8.0;
    if (cell.x < 2.5) return 2.0;
    return 10.0;
  }
  if (cell.y < 1.5) {
    if (cell.x < 0.5) return 12.0;
    if (cell.x < 1.5) return 4.0;
    if (cell.x < 2.5) return 14.0;
    return 6.0;
  }
  if (cell.y < 2.5) {
    if (cell.x < 0.5) return 3.0;
    if (cell.x < 1.5) return 11.0;
    if (cell.x < 2.5) return 1.0;
    return 9.0;
  }
  if (cell.x < 0.5) return 15.0;
  if (cell.x < 1.5) return 7.0;
  if (cell.x < 2.5) return 13.0;
  return 5.0;
}

vec3 quantizePalette(vec3 color, vec2 point) {
  vec3 candidate = clamp(color, 0.0, 1.0);
  float dither = (bayer4(point) / 16.0) - 0.46875;
  candidate = clamp(candidate + dither / 255.0, 0.0, 1.0);

  float bestDistance = 999.0;
  vec3 bestColor = candidate;
  for (int i = 0; i < 256; i++) {
    vec3 paletteColor = texture2D(uPalette, paletteUv(float(i))).rgb;
    vec3 delta = candidate - paletteColor;
    float distanceSq = dot(delta, delta);
    if (distanceSq < bestDistance) {
      bestDistance = distanceSq;
      bestColor = paletteColor;
    }
  }
  return bestColor;
}

void applyLayer(inout vec3 color, vec3 layer, float alpha) {
  color = mix(color, layer, saturate(alpha));
}

float rectMask(vec2 point, vec4 rect) {
  return step(rect.x, point.x) * step(rect.y, point.y) *
    step(point.x, rect.x + rect.z) * step(point.y, rect.y + rect.w);
}

float rectBorderMask(vec2 point, vec4 rect, float width) {
  vec4 inner = vec4(
    rect.x + width,
    rect.y + width,
    max(0.0, rect.z - width * 2.0),
    max(0.0, rect.w - width * 2.0)
  );
  return max(0.0, rectMask(point, rect) - rectMask(point, inner));
}

float circleMask(vec2 point, vec2 center, float radius) {
  return 1.0 - step(radius, distance(point, center));
}

float ringMask(vec2 point, vec2 center, float radius, float width) {
  return max(0.0, circleMask(point, center, radius) - circleMask(point, center, max(0.0, radius - width)));
}

float lineMask(vec2 point, vec2 a, vec2 b, float width) {
  vec2 pa = point - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return 1.0 - step(width, length(pa - ba * h));
}

float ellipseMask(vec2 point, vec2 center, vec2 radius) {
  vec2 local = (point - center) / max(radius, vec2(0.001));
  return 1.0 - step(1.0, dot(local, local));
}

float checker(vec2 point, float scale) {
  vec2 cell = floor(point / scale);
  return mod(cell.x + cell.y, 2.0);
}

float cloudMask(vec2 point, vec2 center, vec2 scale) {
  float puffA = ellipseMask(point, center + vec2(-scale.x * 0.24, 0.0), vec2(scale.x * 0.42, scale.y * 0.30));
  float puffB = ellipseMask(point, center + vec2(scale.x * 0.04, scale.y * 0.12), vec2(scale.x * 0.46, scale.y * 0.34));
  float puffC = ellipseMask(point, center + vec2(scale.x * 0.34, 0.0), vec2(scale.x * 0.38, scale.y * 0.28));
  float base = rectMask(point, vec4(center.x - scale.x * 0.50, center.y - scale.y * 0.18, scale.x, scale.y * 0.32));
  return saturate(puffA + puffB + puffC + base);
}
