void getOpacity() {
  float vertical = clamp(length(vUv1) - 1.0, 0.0, 1.0);
  // Only the unsupported terminal tail fades into spray.
  dAlpha = mix(1.0, vVertexColor.a, vertical);
}
