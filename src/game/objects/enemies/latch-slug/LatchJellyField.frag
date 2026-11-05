#ifndef LATCH_JELLY_FIELD
#define LATCH_JELLY_FIELD
uniform mat4 uWorldToJelly;
uniform vec3 uJellyView;
uniform vec3 uJellyCenter;
uniform vec3 uJellyRadius;
uniform vec4 uJellyMotion;
uniform vec3 uJellyLag;
uniform vec3 uJellyCloudColor;
float latchJellyDensity() {
    vec3 point = (uWorldToJelly * vec4(vPositionW, 1.0)).xyz;
    vec3 direction = (uWorldToJelly * vec4(normalize(vPositionW - uJellyView), 0.0)).xyz;
    vec3 origin = (point - uJellyCenter) / uJellyRadius;
    vec3 ray = normalize(direction / uJellyRadius);
    float density = 0.0;
    float phase = uJellyMotion.x;
    for (int i = 0; i < 9; ++i) {
        float seed = float(i) + 1.0;
        vec3 center = vec3(sin(seed * 2.4), sin(seed * 4.7), cos(seed * 2.9)) * vec3(0.46, 0.34, 0.46);
        center += 0.035 * sin(vec3(seed, seed * 2.0, seed * 3.0) + phase * vec3(0.7, 0.5, 0.6));
        center += uJellyLag / uJellyRadius;
        center *= min(1.0, 0.68 / max(length(center), 0.001));
        float angle = seed * 1.7 + phase * 0.12;
        float c = cos(angle);
        float s = sin(angle);
        vec3 p = origin - center;
        p.xz = mat2(c, -s, s, c) * p.xz;
        vec3 d = ray;
        d.xz = mat2(c, -s, s, c) * d.xz;
        vec3 inverseRay = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), d)) / max(abs(d), vec3(0.0001));
        vec3 extent = vec3(0.065, 0.075, 0.055) * (0.8 + 0.35 * sin(seed * 3.0));
        vec3 a = (-extent - p) * inverseRay;
        vec3 b = (extent - p) * inverseRay;
        vec3 nearPlane = min(a, b);
        vec3 farPlane = max(a, b);
        float entry = max(max(nearPlane.x, nearPlane.y), nearPlane.z);
        float exit = min(min(farPlane.x, farPlane.y), farPlane.z);
        // Ray intersections give the inclusions depth/parallax under the closed skin.
        float thickness = max(0.0, exit - max(entry, 0.0));
        density = max(density, smoothstep(0.0, 0.035, thickness) * exp(-max(entry, 0.0) * 0.65));
    }
    return clamp(density, 0.0, 1.0);
}
#endif
