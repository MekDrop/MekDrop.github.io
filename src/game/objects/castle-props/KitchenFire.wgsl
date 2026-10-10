varying vHearthPosition: vec3f;
uniform uHearthTime: f32;

fn hearthNoise(p: vec2f) -> f32 {
  let cell = floor(p);
  let fraction = fract(p);
  let f = fraction * fraction * (3.0 - 2.0 * fraction);
  let h = fract(sin(vec4f(
    dot(cell, vec2f(127.1, 311.7)),
    dot(cell + vec2f(1.0, 0.0), vec2f(127.1, 311.7)),
    dot(cell + vec2f(0.0, 1.0), vec2f(127.1, 311.7)),
    dot(cell + vec2f(1.0), vec2f(127.1, 311.7))
  )) * 43758.5453);
  return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}

fn hearthFire() -> vec4f {
  let p = vHearthPosition;
  let mask = (1.0 - smoothstep(0.32, 0.37, abs(p.x))) *
    smoothstep(0.25, 0.31, p.y) * (1.0 - smoothstep(0.79, 0.84, p.y)) *
    (1.0 - smoothstep(0.08, 0.16, p.z)) * smoothstep(-0.32, -0.24, p.z);
  let uv = vec2f(p.x / 0.35, (p.y - 0.28) / 0.48);
  let t = uniform.uHearthTime;
  let noise = hearthNoise(vec2f(uv.x * 5.0, uv.y * 5.0 - t * 2.8));
  let bend = sin(uv.y * 5.0 - t * 3.2) * uv.y * 0.14;
  let field = 1.0 - uv.y - abs(uv.x + bend) * 0.47 +
    (noise - 0.5) * 0.62;
  // Crisp color bands use the castle brazier's orange/yellow palette.
  let flame = smoothstep(0.20, 0.22, field);
  let outerColor = mix(vec3f(0.74, 0.025, 0.0), vec3f(1.0, 0.24, 0.012), step(0.36, field));
  let color = mix(outerColor, vec3f(1.0, 0.56, 0.08), step(0.64, field));
  return vec4f(color * flame * 1.18, mask);
}
