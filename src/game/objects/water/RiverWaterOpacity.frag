uniform float uRiverVertical;

void getOpacity() {
  float waterDepth = clamp(vVertexColor.r, 0.0, 1.0);
  float riverVolumeOpacity = mix(0.93, 0.97, waterDepth);
  float cascadeImpact = smoothstep(0.65, 0.95, vVertexColor.b);
  riverVolumeOpacity = mix(riverVolumeOpacity, 0.99, cascadeImpact);

  float waterfallFace = clamp(vVertexColor.a, 0.0, 1.0);
  float waterfallOpacity = mix(0.9, 0.95, waterfallFace);
  float waterfallEdge =
    smoothstep(0.0, 0.09, vVertexColor.r) *
    smoothstep(0.0, 0.09, 1.0 - vVertexColor.r);
  waterfallOpacity *= mix(0.84, 1.0, waterfallEdge);

  dAlpha = mix(
    riverVolumeOpacity,
    waterfallOpacity * waterfallFace,
    uRiverVertical
  );
  float waterfallLipSurface =
    uRiverVertical *
    (1.0 - smoothstep(0.08, 0.72, vVertexColor.b));
  dAlpha = mix(dAlpha, 0.93, waterfallLipSurface);
  float springSource =
    (1.0 - uRiverVertical) *
    (1.0 - waterDepth) *
    smoothstep(0.35, 0.92, vVertexColor.g);
  dAlpha = mix(dAlpha, 0.88, springSource);
}
