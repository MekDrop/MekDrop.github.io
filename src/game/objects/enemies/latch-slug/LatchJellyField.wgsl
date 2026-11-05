#ifndef LATCH_JELLY_FIELD
#define LATCH_JELLY_FIELD
uniform uWorldToJelly: mat4x4f;
uniform uJellyView: vec3f;
uniform uJellyCenter: vec3f;
uniform uJellyRadius: vec3f;
uniform uJellyMotion: vec4f;
uniform uJellyLag: vec3f;
uniform uJellyCloudColor: vec3f;
fn latchJellyDensity() -> f32 {
    var point = (uniform.uWorldToJelly * vec4f(vPositionW, 1.0)).xyz;
    var direction = (uniform.uWorldToJelly * vec4f(normalize(vPositionW - uniform.uJellyView), 0.0)).xyz;
    var origin = (point - uniform.uJellyCenter) / uniform.uJellyRadius;
    var ray = normalize(direction / uniform.uJellyRadius);
    var density = 0.0;
    var phase = uniform.uJellyMotion.x;
    for (var i = 0; i < 9; i = i + 1) {
        var seed = f32(i) + 1.0;
        var center = vec3f(sin(seed * 2.4), sin(seed * 4.7), cos(seed * 2.9)) * vec3f(0.46, 0.34, 0.46);
        center += 0.035 * sin(vec3f(seed, seed * 2.0, seed * 3.0) + phase * vec3f(0.7, 0.5, 0.6));
        center += uniform.uJellyLag / uniform.uJellyRadius;
        center *= min(1.0, 0.68 / max(length(center), 0.001));
        var angle = seed * 1.7 + phase * 0.12;
        var c = cos(angle);
        var s = sin(angle);
        var p = origin - center;
        let rotatedP = mat2x2f(vec2f(c, -s), vec2f(s, c)) * p.xz;
        p = vec3f(rotatedP.x, p.y, rotatedP.y);
        var d = ray;
        let rotatedD = mat2x2f(vec2f(c, -s), vec2f(s, c)) * d.xz;
        d = vec3f(rotatedD.x, d.y, rotatedD.y);
        var inverseRay = mix(vec3f(-1.0), vec3f(1.0), step(vec3f(0.0), d)) / max(abs(d), vec3f(0.0001));
        var extent = vec3f(0.065, 0.075, 0.055) * (0.8 + 0.35 * sin(seed * 3.0));
        var a = (-extent - p) * inverseRay;
        var b = (extent - p) * inverseRay;
        var nearPlane = min(a, b);
        var farPlane = max(a, b);
        var entry = max(max(nearPlane.x, nearPlane.y), nearPlane.z);
        var exit = min(min(farPlane.x, farPlane.y), farPlane.z);
        // Ray intersections give the inclusions depth/parallax under the closed skin.
        var thickness = max(0.0, exit - max(entry, 0.0));
        density = max(density, smoothstep(0.0, 0.035, thickness) * exp(-max(entry, 0.0) * 0.65));
    }
    return clamp(density, 0.0, 1.0);
}
#endif
