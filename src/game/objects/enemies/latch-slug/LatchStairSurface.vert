#ifndef LATCH_STAIR_SURFACE
#define LATCH_STAIR_SURFACE
uniform vec3 uStairEdge;
uniform vec3 uStairDirection;
uniform vec2 uStairLevels;
uniform float uStairWeight;
uniform float uStairFlow;
uniform vec4 uStairSpan;
uniform vec2 uStairBodyLine;
uniform vec2 uStairRuns;
uniform mat4 uStairWorldToBind;
uniform vec2 uStairBindSpan;
vec3 stairOriginalPosition;
vec3 stairReferencePosition;
vec3 latchStairSurface(vec3 p) {
    if (uStairWeight <= 0.0) return p;
    vec3 reference = stairReferencePosition + p - stairOriginalPosition;
    vec3 local = (uStairWorldToBind * vec4(reference, 1.0)).xyz;
    vec2 v = vec2(dot(reference - uStairEdge, uStairDirection), reference.y);
    float t = clamp((uStairBindSpan.x - local.z) / max(0.05, uStairBindSpan.x - uStairBindSpan.y), 0.0, 1.0);
    t = clamp(t + uStairFlow * sin(t * 3.14159265), 0.0, 1.0);
    float arc = clamp(mix(uStairSpan.x, uStairSpan.y, t), -uStairRuns.x, uStairLevels.y-uStairLevels.x+uStairRuns.y);
    float rise = uStairLevels.y - uStairLevels.x;
    vec2 q;
    vec2 n = vec2(0.0, 1.0);
    if (arc < 0.0) { q = vec2(arc, uStairLevels.x); }
    else if (arc < rise) { q = vec2(0.0, uStairLevels.x + arc); n = vec2(-1.0, 0.0); }
    else { q = vec2(arc - rise, uStairLevels.y); }
    float radius = min(0.08, rise * 0.3);
    float angle = 1.5707963 * (smoothstep(-radius, radius, arc) - smoothstep(rise - radius, rise + radius, arc));
    n = vec2(-sin(angle), cos(angle));
    float depth = max(0.008, local.y * 0.55);
    vec2 attached = q + n * depth;
    vec3 result = reference + uStairDirection * (attached.x - v.x) + vec3(0.0, attached.y - reference.y, 0.0);
    return mix(p, result, uStairWeight);
}
vec3 latchStairNormal(vec3 normal) {
    if (uStairWeight <= 0.0) return normal;
    vec3 axis = abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(normal, axis));
    vec3 bitangent = cross(normal, tangent);
    vec3 t = latchStairSurface(stairOriginalPosition + tangent * 0.004) - latchStairSurface(stairOriginalPosition - tangent * 0.004);
    vec3 b = latchStairSurface(stairOriginalPosition + bitangent * 0.004) - latchStairSurface(stairOriginalPosition - bitangent * 0.004);
    vec3 warped = cross(t, b);
    return length(warped) > 0.000001 ? normalize(warped) : normal;
}
#endif
