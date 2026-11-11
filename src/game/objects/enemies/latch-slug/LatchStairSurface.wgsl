#ifndef LATCH_STAIR_SURFACE
#define LATCH_STAIR_SURFACE
uniform uStairEdge: vec3f;
uniform uStairDirection: vec3f;
uniform uStairLevels: vec2f;
uniform uStairWeight: f32;
uniform uStairRootHeight: f32;
var<private> stairOriginalPosition: vec3f;
fn latchStairSurface(p: vec3f) -> vec3f {
    if (uniform.uStairWeight <= 0.0) { return p; }
    // A vertical shear bends the authored body with determinant one.
    let along = dot(p - uniform.uStairEdge, uniform.uStairDirection);
    let rise = uniform.uStairLevels.y - uniform.uStairLevels.x;
    let radius = min(0.08, rise * 0.3);
    let support = mix(uniform.uStairLevels.x, uniform.uStairLevels.y, smoothstep(-radius, radius, along));
    return p + vec3f(0.0, (support - uniform.uStairRootHeight) * uniform.uStairWeight, 0.0);
}
fn latchStairNormal(normal: vec3f) -> vec3f {
    if (uniform.uStairWeight <= 0.0) { return normal; }
    var axis = vec3f(1.0, 0.0, 0.0);
    if (abs(normal.y) < 0.9) { axis = vec3f(0.0, 1.0, 0.0); }
    let tangent = normalize(cross(normal, axis));
    let bitangent = cross(normal, tangent);
    let t = latchStairSurface(stairOriginalPosition + tangent * 0.004) - latchStairSurface(stairOriginalPosition - tangent * 0.004);
    let b = latchStairSurface(stairOriginalPosition + bitangent * 0.004) - latchStairSurface(stairOriginalPosition - bitangent * 0.004);
    let warped = cross(t, b);
    if (length(warped) > 0.000001) { return normalize(warped); }
    return normal;
}
#endif
