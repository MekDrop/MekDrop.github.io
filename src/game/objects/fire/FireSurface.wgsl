varying vFireSurfacePosition: vec3f;
uniform uFireMin: vec3f;
uniform uFireMax: vec3f;
uniform uFireInnerMin: vec3f;
uniform uFireInnerMax: vec3f;

fn fireSurfaceMask() -> f32 {
  let lower = smoothstep(uniform.uFireMin, uniform.uFireInnerMin, vFireSurfacePosition);
  let upper = vec3f(1.0) - smoothstep(uniform.uFireInnerMax, uniform.uFireMax, vFireSurfacePosition);
  let mask = lower * upper;
  return mask.x * mask.y * mask.z;
}
