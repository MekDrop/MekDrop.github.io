uniform float uTime;
uniform vec3 uColor;

varying vec2 vUv;
varying float vSurfaceWave;

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
  vec2 centered = vUv - vec2(0.5);
  float radius = length(centered);
  float angle = atan(centered.y, centered.x);
  vec2 swirlUv = centered * 7.0;
  swirlUv += vec2(cos(angle + uTime * 0.23), sin(angle - uTime * 0.19)) *
             (0.18 + radius * 0.34);
  float broadFlow = noise(swirlUv + vec2(uTime * 0.12, -uTime * 0.16));
  float fineFlow = noise(swirlUv * 2.35 + vec2(-uTime * 0.31, uTime * 0.27));

  float ripple = sin(radius * 46.0 - uTime * 4.4 + broadFlow * 5.0);
  float rippleCrest = pow(ripple * 0.5 + 0.5, 7.0);
  float caustic = smoothstep(0.72, 0.97, broadFlow * 0.56 + fineFlow * 0.44);
  float pulseAge = fract(uTime * 0.16);
  float pulseRadius = pulseAge * 0.72;
  float pulse = 1.0 - smoothstep(0.0, 0.035, abs(radius - pulseRadius));
  pulse *= 1.0 - pulseAge;
  float edgeDistance = min(
      min(vUv.x, 1.0 - vUv.x),
      min(vUv.y, 1.0 - vUv.y)
  );
  float edgeGlow = 1.0 - smoothstep(0.0, 0.12, edgeDistance);
  float surfaceHighlight = clamp(abs(vSurfaceWave) * 24.0, 0.0, 1.0);

  float lightAmount =
      clamp(rippleCrest * 0.56 + caustic * 0.34 + pulse * 0.72 +
                surfaceHighlight * 0.2,
            0.0,
            1.0);
  vec3 deepColor = uColor * (0.28 + broadFlow * 0.16);
  vec3 crestColor = mix(uColor * 0.9, vec3(0.88, 0.96, 1.0), 0.28);
  vec3 color = mix(deepColor, crestColor, lightAmount);
  float alpha =
      0.32 + broadFlow * 0.08 + rippleCrest * 0.1 + pulse * 0.16 +
      edgeGlow * 0.12;

  gl_FragColor = vec4(color, min(alpha, 0.72));
}
