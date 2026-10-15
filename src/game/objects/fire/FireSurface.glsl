varying vec3 vFireSurfacePosition;
uniform vec3 uFireMin;
uniform vec3 uFireMax;
uniform vec3 uFireInnerMin;
uniform vec3 uFireInnerMax;

float fireSurfaceMask() {
  vec3 lower = smoothstep(uFireMin, uFireInnerMin, vFireSurfacePosition);
  vec3 upper = vec3(1.0) - smoothstep(uFireInnerMax, uFireMax, vFireSurfacePosition);
  vec3 mask = lower * upper;
  return mask.x * mask.y * mask.z;
}
