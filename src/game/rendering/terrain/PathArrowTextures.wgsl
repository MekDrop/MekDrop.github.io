var uRouteMask: texture_2d<f32>;
var uRouteMaskSampler: sampler;
var uRouteHeight: texture_2d<f32>;
var uRouteHeightSampler: sampler;
var uRoutePalette: texture_2d<f32>;
var uRoutePaletteSampler: sampler;
uniform uRouteWorldToMap: mat4x4f;
uniform uRouteMap: vec4f;
uniform uRouteLayers: f32;
uniform uRouteHeightRange: f32;
uniform uRouteVisible: f32;
uniform uRouteTime: f32;
uniform material_diffuse: vec3f;
uniform uPathWear: f32;
uniform uPathWearCenter: vec2f;

fn routePaint() -> vec4f {
  if (uniform.uRouteVisible < 0.5) { return vec4f(0.0); }
  let position = (uniform.uRouteWorldToMap * vec4f(vPositionW, 1.0)).xyz;
  let uv = (position.xz + uniform.uRouteMap.xy) / uniform.uRouteMap.zw;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return vec4f(0.0); }
  if (vNormalW.y < 0.35) { return vec4f(0.0); }
  var paint = vec4f(0.0);
  for (var layer: i32 = 0; layer < i32(uniform.uRouteLayers); layer++) {
    let atlasUv = vec2f(uv.x, (uv.y + f32(layer)) / uniform.uRouteLayers);
    let mask = textureSampleLevel(uRouteMask, uRouteMaskSampler, atlasUv, 0.0);
    let metadata = textureSampleLevel(uRouteHeight, uRouteHeightSampler, atlasUv, 0.0);
    let heightBytes = floor(metadata.rg * 255.0 + 0.5);
    let height = (heightBytes.x * 256.0 + heightBytes.y) / 65535.0 * uniform.uRouteHeightRange;
    if (abs(position.y - height) > 0.14 || mask.r + mask.g < 0.005) { continue; }
    let palette = floor(metadata.b * 255.0 + 0.5);
    var color = textureSampleLevel(uRoutePalette, uRoutePaletteSampler, vec2f(
      metadata.a * 1.35 + uniform.uRouteTime * 0.42, (palette + 0.5) / 16.0
    ), 0.0).rgb;
    color = pow(color, vec3f(2.2));
    let pulse = (sin(uniform.uRouteTime * 4.2) + 1.0) * 0.5;
    paint = vec4f(paint.rgb + color * (mask.r * (1.3 + pulse * 0.45) + mask.g * 0.14),
      max(paint.a, mask.r));
  }
  return paint;
}

fn getAlbedo() {
  dAlbedo = uniform.material_diffuse;
  #ifdef STD_DIFFUSE_TEXTURE
    let uv = {STD_DIFFUSE_TEXTURE_UV};
    var sandstone = {STD_DIFFUSE_TEXTURE_DECODE}(textureSampleBias(
      {STD_DIFFUSE_TEXTURE_NAME}, {STD_DIFFUSE_TEXTURE_NAME}Sampler, uv, uniform.textureBias
    )).{STD_DIFFUSE_TEXTURE_CHANNEL};
    let value = dot(sandstone, vec3f(0.299, 0.587, 0.114));
    sandstone = mix(sandstone, vec3f(value), 0.3);
    dAlbedo *= sandstone;
    let wearOffset = (uv - uniform.uPathWearCenter) * vec2f(1.0, 1.25);
    let wearArea = 1.0 - smoothstep(0.09, 0.29, length(wearOffset));
    let wornTexture = 1.0 - smoothstep(0.7, 0.88, value);
    dAlbedo *= 1.0 - uniform.uPathWear * wearArea * (0.4 + 0.6 * wornTexture);
  #endif
  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= saturate3(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
  dAlbedo *= 1.0 - routePaint().a;
}
