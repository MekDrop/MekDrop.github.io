#ifndef LATCH_STAIR_SURFACE
#define LATCH_STAIR_SURFACE
uniform vec3 uStairEdge;
uniform vec3 uStairDirection;
uniform vec2 uStairLevels;
uniform float uStairWeight;
uniform float uStairRootHeight;
vec3 stairOriginalPosition;
vec3 latchStairSurface(vec3 p) {
    if (uStairWeight <= 0.0) return p;
    // A vertical shear bends the authored body with determinant one.
    float along = dot(p - uStairEdge, uStairDirection);
    float rise = uStairLevels.y - uStairLevels.x;
    float radius = min(0.08, rise * 0.3);
    float support = mix(uStairLevels.x, uStairLevels.y, smoothstep(-radius, radius, along));
    return p + vec3(0.0, (support - uStairRootHeight) * uStairWeight, 0.0);
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
