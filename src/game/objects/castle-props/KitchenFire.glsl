varying vec3 vHearthPosition;
uniform float uHearthTime;

float hearthNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 h = fract(sin(vec4(
    dot(cell, vec2(127.1, 311.7)),
    dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7)),
    dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7)),
    dot(cell + vec2(1.0), vec2(127.1, 311.7))
  )) * 43758.5453);
  return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}

vec4 hearthFire() {
  vec3 p = vHearthPosition;
  // Model-space bounds keep the fire attached through rotation and island motion.
  float mask = (1.0 - smoothstep(0.32, 0.37, abs(p.x))) *
    smoothstep(0.25, 0.31, p.y) * (1.0 - smoothstep(0.79, 0.84, p.y)) *
    (1.0 - smoothstep(0.08, 0.16, p.z)) * smoothstep(-0.32, -0.24, p.z);
  vec2 uv = vec2(p.x / 0.35, (p.y - 0.28) / 0.48);
  float t = uHearthTime;
  float noise = hearthNoise(vec2(uv.x * 5.0, uv.y * 5.0 - t * 2.8));
  float fine = hearthNoise(vec2(uv.x * 13.0 + noise, uv.y * 11.0 - t * 4.5));
  float bend = sin(uv.y * 5.0 - t * 3.2) * uv.y * 0.14;
  float field = 1.0 - uv.y - abs(uv.x + bend) * 0.47 +
    (noise - 0.5) * 0.62 + (fine - 0.5) * 0.18;
  float flame = smoothstep(0.16, 0.29, field);
  float core = smoothstep(0.63, 0.95, field);
  vec3 color = mix(vec3(1.0, 0.075, 0.003), vec3(1.0, 0.48, 0.025),
    smoothstep(0.23, 0.52, field));
  color = mix(color, vec3(1.0, 0.85, 0.32), core);
  return vec4(color * flame * 1.4, mask);
}
