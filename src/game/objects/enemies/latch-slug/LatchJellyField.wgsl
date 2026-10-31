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
    let point = (uniform.uWorldToJelly * vec4f(vPositionW, 1.0)).xyz;
    let direction = normalize((uniform.uWorldToJelly * vec4f(normalize(vPositionW - uniform.uJellyView), 0.0)).xyz);
    var density = 0.0;
    let phase = uniform.uJellyMotion.x;
    for (var i = 0; i < 5; i = i + 1) {
        var q = (point + direction * (0.035 + f32(i) * 0.065) - uniform.uJellyCenter - uniform.uJellyLag) / uniform.uJellyRadius;
        q.y = q.y - uniform.uJellyMotion.y * 0.16;
        let boundary = 1.0 - smoothstep(0.72, 1.03, length(q));
        let flow = q + 0.18 * sin(q.yzx * 2.2 + vec3f(phase * 0.8, phase * 0.65 + 2.0, -phase * 0.6));
        var cloud = sin(flow.x * 3.1 + phase * 0.6) + sin(flow.y * 3.7 - phase * 0.48) + sin(flow.z * 3.3 + phase * 0.52);
        cloud = cloud + 0.55 * sin(dot(flow, vec3f(2.3, -3.0, 2.7)) - phase * 0.9);
        density = density + smoothstep(0.25, 1.7, cloud) * boundary * 0.32;
    }
    return clamp(density, 0.0, 1.0);
}
#endif
