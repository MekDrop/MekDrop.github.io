uniform float uRiverVertical;

void getOpacity() {
  // Only the unsupported terminal tail fades into spray.
  dAlpha = mix(1.0, vVertexColor.a, uRiverVertical);
}
