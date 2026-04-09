vec3 drawBackdrop(vec2 world) {
  float horizon = world.y / max(uWorldSize.y, 1.0);
  return mix(vec3(0.43, 0.64, 0.84), vec3(0.59, 0.78, 0.93), horizon);
}

vec3 drawOutside(vec2 fragPos) {
  vec2 uv = fragPos / max(uResolution, vec2(1.0));
  float vignette = saturate(1.0 - dot(uv - 0.5, uv - 0.5) * 1.8);
  return vec3(0.12, 0.18, 0.24) * vignette;
}
