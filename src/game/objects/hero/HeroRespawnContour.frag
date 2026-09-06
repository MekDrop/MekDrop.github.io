uniform float uTime;
uniform float uReveal;
uniform float uBaseHeight;
uniform float uHeroHeight;

varying float vWorldHeight;
varying vec3 vWorldPosition;

float hash(vec3 point) {
  return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main(void) {
  float normalizedHeight =
      clamp((vWorldHeight - uBaseHeight) / uHeroHeight, 0.0, 1.0);
  float shimmer = hash(floor(vWorldPosition * 22.0) + floor(uTime * 18.0));
  float raggedEdge = (shimmer - 0.5) * 0.075;

  if (normalizedHeight > uReveal + raggedEdge) discard;

  float scanDistance = abs(normalizedHeight - uReveal);
  float scanGlow = 1.0 - smoothstep(0.0, 0.12, scanDistance);
  float pulse = sin(uTime * 19.0 + vWorldPosition.y * 13.0) * 0.5 + 0.5;
  vec3 contourColor = mix(
      vec3(0.05, 0.52, 1.0),
      vec3(0.72, 0.95, 1.0),
      scanGlow * 0.72 + pulse * 0.18
  );
  float fadeOut = 1.0 - smoothstep(0.72, 1.0, uReveal);
  float alpha = (0.38 + scanGlow * 0.58 + pulse * 0.12) * fadeOut;

  gl_FragColor = vec4(contourColor, alpha);
}
