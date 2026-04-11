void main() {
  vec2 fragPos = gl_FragCoord.xy;
  vec2 minCorner = uViewport.xy;
  vec2 maxCorner = uViewport.xy + uViewport.zw;
  float inside = step(minCorner.x, fragPos.x) * step(minCorner.y, fragPos.y) *
    step(fragPos.x, maxCorner.x) * step(fragPos.y, maxCorner.y);

  if (inside < 0.5) {
    gl_FragColor = vec4(quantizePalette(drawOutside(fragPos), fragPos), 1.0);
    return;
  }

  vec2 viewportUv = (fragPos - minCorner) / max(uViewport.zw, vec2(1.0));
  vec2 renderResolution = floor(uViewport.zw / max(uPixelScale, 1.0));
  renderResolution = max(renderResolution, uWorldSize);
  vec2 uv = floor(viewportUv * renderResolution) / renderResolution;
  uv += 0.5 / renderResolution;

  vec2 world = vec2(uv.x * uWorldSize.x, uv.y * uWorldSize.y);
  vec3 color = drawBackdrop(world);

  float deathFade = 1.0 - step(0.25, abs(uPlayerState.z - 1.0));
  color = mix(color, vec3(0.10, 0.05, 0.08), deathFade * 0.12);
  color = quantizePalette(color, fragPos);

  gl_FragColor = vec4(color, 1.0);
}
