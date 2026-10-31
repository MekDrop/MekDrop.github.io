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
    vec3 direction = normalize((uWorldToJelly * vec4(normalize(vPositionW - uJellyView), 0.0)).xyz);
    float density = 0.0;
    float phase = uJellyMotion.x;
    for (int i = 0; i < 5; ++i) {
        vec3 q = (point + direction * (0.035 + float(i) * 0.065) - uJellyCenter - uJellyLag) / uJellyRadius;
        q.y -= uJellyMotion.y * 0.16;
        float boundary = 1.0 - smoothstep(0.72, 1.03, length(q));
        vec3 flow = q + 0.18 * sin(q.yzx * 2.2 + vec3(phase * 0.8, phase * 0.65 + 2.0, -phase * 0.6));
        float cloud = sin(flow.x * 3.1 + phase * 0.6) + sin(flow.y * 3.7 - phase * 0.48) + sin(flow.z * 3.3 + phase * 0.52);
        cloud += 0.55 * sin(dot(flow, vec3(2.3, -3.0, 2.7)) - phase * 0.9);
        density += smoothstep(0.25, 1.7, cloud) * boundary * 0.32;
    }
    return clamp(density, 0.0, 1.0);
}
#endif
