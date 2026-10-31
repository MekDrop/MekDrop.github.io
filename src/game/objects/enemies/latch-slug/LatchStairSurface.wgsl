#ifndef LATCH_STAIR_SURFACE
#define LATCH_STAIR_SURFACE
uniform uStairEdge: vec3f;
uniform uStairDirection: vec3f;
uniform uStairLevels: vec2f;
uniform uStairWeight: f32;
uniform uStairFlow: f32;
uniform uStairSpan: vec4f;
uniform uStairBodyLine: vec2f;
uniform uStairRuns: vec2f;
uniform uStairWorldToBind: mat4x4f;
uniform uStairBindSpan: vec2f;
var<private> stairOriginalPosition: vec3f;
var<private> stairReferencePosition: vec3f;
fn latchStairSurface(p: vec3f) -> vec3f {
    if (uniform.uStairWeight <= 0.0) { return p; }
    let reference = stairReferencePosition + p - stairOriginalPosition;
    let local = (uniform.uStairWorldToBind * vec4f(reference, 1.0)).xyz;
    let v = vec2f(dot(reference - uniform.uStairEdge, uniform.uStairDirection), reference.y);
    var t = clamp((uniform.uStairBindSpan.x - local.z) / max(0.05, uniform.uStairBindSpan.x - uniform.uStairBindSpan.y), 0.0, 1.0);
    t = clamp(t + uniform.uStairFlow * sin(t * 3.14159265), 0.0, 1.0);
    let arc = clamp(mix(uniform.uStairSpan.x, uniform.uStairSpan.y, t), -uniform.uStairRuns.x, uniform.uStairLevels.y-uniform.uStairLevels.x+uniform.uStairRuns.y);
    let rise = uniform.uStairLevels.y - uniform.uStairLevels.x;
    var q: vec2f;
    var n = vec2f(0.0, 1.0);
    if (arc < 0.0) { q = vec2f(arc, uniform.uStairLevels.x); }
    else if (arc < rise) { q = vec2f(0.0, uniform.uStairLevels.x + arc); n = vec2f(-1.0, 0.0); }
    else { q = vec2f(arc - rise, uniform.uStairLevels.y); }
    let radius = min(0.08, rise * 0.3);
    let angle = 1.5707963 * (smoothstep(-radius, radius, arc) - smoothstep(rise - radius, rise + radius, arc));
    n = vec2f(-sin(angle), cos(angle));
    let depth = max(0.008, local.y * 0.55);
    let attached = q + n * depth;
    let result = reference + uniform.uStairDirection * (attached.x - v.x) + vec3f(0.0, attached.y - reference.y, 0.0);
    return mix(p, result, uniform.uStairWeight);
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
