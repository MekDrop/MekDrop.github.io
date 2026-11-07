#ifndef CLOUD_SUN_TRANSMISSION
#define CLOUD_SUN_TRANSMISSION
var uCloudShadowTexture: texture_2d<f32>;
var uCloudShadowTextureSampler: sampler;
uniform uCloudShadowBounds: vec4f;
uniform uCloudShadowProjection: vec4f;
uniform uCloudSunDirection: vec3f;

fn cloudSunTransmission(position: vec3f, lightDirection: vec3f) -> f32 {
  if (dot(lightDirection, uniform.uCloudSunDirection) < 0.999) { return 1.0; }
  let projected = position.xz - position.y * uniform.uCloudShadowProjection.xy
      - uniform.uCloudShadowProjection.zw;
  let uv = (projected - uniform.uCloudShadowBounds.xy) * uniform.uCloudShadowBounds.z;
  let margin = min(uv, vec2f(1.0) - uv);
  let border = smoothstep(0.0, 0.02, min(margin.x, margin.y));
  let transmission = textureSampleLevel(uCloudShadowTexture, uCloudShadowTextureSampler,
      clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0).r;
  return mix(1.0, transmission, uniform.uCloudShadowBounds.w * border);
}
#endif
