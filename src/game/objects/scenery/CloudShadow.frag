#ifndef CLOUD_SUN_TRANSMISSION
#define CLOUD_SUN_TRANSMISSION
uniform sampler2D uCloudShadowTexture;
uniform vec4 uCloudShadowBounds;
uniform vec4 uCloudShadowProjection;
uniform vec3 uCloudSunDirection;

float cloudSunTransmission(vec3 position, vec3 lightDirection) {
  if (dot(lightDirection, uCloudSunDirection) < 0.999) return 1.0;
  vec2 projected = position.xz - position.y * uCloudShadowProjection.xy
      - uCloudShadowProjection.zw;
  vec2 uv = (projected - uCloudShadowBounds.xy) * uCloudShadowBounds.z;
  vec2 margin = min(uv, 1.0 - uv);
  float border = smoothstep(0.0, 0.02, min(margin.x, margin.y));
  float transmission = texture2D(uCloudShadowTexture, clamp(uv, 0.0, 1.0)).r;
  return mix(1.0, transmission, uCloudShadowBounds.w * border);
}
#endif
