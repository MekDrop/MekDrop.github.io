uniform sampler2D uRouteMask;
uniform sampler2D uRouteHeight;
uniform sampler2D uRoutePalette;
uniform mat4 uRouteWorldToMap;
uniform vec4 uRouteMap;
uniform float uRouteLayers;
uniform float uRouteHeightRange;
uniform float uRouteVisible;
uniform float uRouteTime;

vec4 routePaint() {
  if (uRouteVisible < 0.5) return vec4(0.0);
  vec3 position = (uRouteWorldToMap * vec4(vPositionW, 1.0)).xyz;
  vec2 uv = (position.xz + uRouteMap.xy) / uRouteMap.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  // Paint only walkable faces, including the treads of authored stairs.
  if (vNormalW.y < 0.35) return vec4(0.0);
  vec4 paint = vec4(0.0);
  for (int layer = 0; layer < ROUTE_LAYER_COUNT; layer++) {
    vec2 atlasUv = vec2(uv.x, (uv.y + float(layer)) / uRouteLayers);
    vec4 mask = texture2D(uRouteMask, atlasUv);
    vec4 metadata = texture2D(uRouteHeight, atlasUv);
    vec2 heightBytes = floor(metadata.rg * 255.0 + 0.5);
    float height = (heightBytes.x * 256.0 + heightBytes.y) / 65535.0 * uRouteHeightRange;
    if (abs(position.y - height) > 0.14 || mask.r + mask.g < 0.005) continue;
    float palette = floor(metadata.b * 255.0 + 0.5);
    vec3 color = texture2D(uRoutePalette, vec2(
      metadata.a * 1.35 + uRouteTime * 0.42, (palette + 0.5) / 16.0
    )).rgb;
    color = pow(color, vec3(2.2));
    paint.rgb += color * max(0.0, mask.r - mask.g) * 0.8 + vec3(0.85, 0.87, 0.9) * mask.g;
    paint.a = max(paint.a, mask.r);
  }
  return paint;
}
