varying vLanternPosition: vec3f;
uniform uLanternTime: f32;

fn getEmission() {
  let p = vLanternPosition;
  let t = uniform.uLanternTime;
  let sway = sin(t * 4.7) * 0.012 + sin(t * 7.3) * 0.006;
  let height = 0.15 + sin(t * 5.1) * 0.012;
  let horizontal = vec2f(p.x - sway, p.z - 0.047 - sway * 0.6);
  let radius = length(horizontal);
  let rise = sin(p.y * 85.0 - t * 9.0 + p.x * 32.0) * 0.12;
  let vertical = (p.y - height) / 0.045;
  let radial = radius / 0.075;
  let heat = exp(-vertical * vertical - radial * radial);
  let flicker = 0.9 + sin(t * 11.7) * 0.08 + sin(t * 19.1) * 0.04;
  let strength = max(0.0, heat * (1.0 + rise)) * flicker;
  let front = (1.0 - smoothstep(0.058, 0.066, abs(p.x))) *
    smoothstep(-0.040, -0.027, p.z) * (1.0 - smoothstep(0.113, 0.128, p.z));
  let side = smoothstep(0.065, 0.069, abs(p.x)) *
    (1.0 - smoothstep(0.073, 0.079, abs(p.x))) *
    smoothstep(-0.024, -0.012, p.z) * (1.0 - smoothstep(0.099, 0.112, p.z));
  let pane = max(front, side) * smoothstep(0.091, 0.103, p.y) *
    (1.0 - smoothstep(0.204, 0.218, p.y));
  dEmission = (vec3f(0.22, 0.028, 0.001) +
    mix(vec3f(1.8, 0.22, 0.008), vec3f(2.8, 1.15, 0.12), strength) * strength) * pane;
}
