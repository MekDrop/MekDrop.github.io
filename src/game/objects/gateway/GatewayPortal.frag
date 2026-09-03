uniform float uTime;
uniform vec3 uColor;

varying vec2 vUv;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);

  return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)),
          hash(cell + vec2(1.0, 1.0)), local.x),
      local.y);
}

void main(void) {
  vec2 fallingUv = vec2(vUv.x * 3.4, vUv.y * 5.2 + uTime * 0.58);
  float broadFlow = noise(fallingUv + vec2(sin(uTime * 0.31), 0.0));
  float fineFlow =
      noise(fallingUv * 2.15 + vec2(-uTime * 0.24, uTime * 0.18));
  float current = sin(vUv.y * 23.0 + uTime * 3.1 + broadFlow * 4.2 +
                      sin(vUv.x * 8.0) * 0.8);
  float brightCurrent = smoothstep(0.48, 0.96, current * 0.5 + 0.5);
  float suspendedLight =
      smoothstep(0.62, 0.92, broadFlow * 0.7 + fineFlow * 0.3);
  float edgeGlow = smoothstep(0.72, 0.98, abs(vUv.x * 2.0 - 1.0));
  float shimmer = 0.92 + sin(uTime * 1.7 + vUv.y * 7.0) * 0.08;
  vec3 color = mix(uColor * 0.7, mix(uColor, vec3(1.0), 0.72),
                   brightCurrent * 0.72 + suspendedLight * 0.28);
  float alpha =
      (0.26 + broadFlow * 0.16 + brightCurrent * 0.22 + edgeGlow * 0.08) *
      shimmer;

  gl_FragColor = vec4(color, alpha);
}
