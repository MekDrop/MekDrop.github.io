void drawGoal(inout vec3 color, vec2 world) {
  if (uGoal.w < 0.5) {
    return;
  }

  float doorHeight = uGoal.z;
  vec4 frame = vec4(uGoal.x - 3.1, uGoal.y, 6.2, doorHeight);
  vec4 panel = vec4(uGoal.x - 2.25, uGoal.y + 0.8, 4.5, max(1.0, doorHeight - 1.4));
  float frameMask = rectBorderMask(world, frame, 0.85);
  float panelMask = rectMask(world, panel);
  float panelInset = rectBorderMask(world, panel, 0.6);
  float slit = rectMask(world, vec4(uGoal.x - 0.18, uGoal.y + doorHeight * 0.55, 0.36, max(1.6, doorHeight * 0.28)));
  float knob = circleMask(world, vec2(uGoal.x + 1.3, uGoal.y + doorHeight * 0.40), 0.46);
  float beaconPulse = 0.45 + 0.55 * sin(uTime * 5.5);
  float beacon = ringMask(world, vec2(uGoal.x, uGoal.y + doorHeight + 2.1), 1.2 + beaconPulse * 0.55, 0.55);

  applyLayer(color, vec3(0.73, 0.57, 0.31), frameMask);
  applyLayer(color, vec3(0.28, 0.19, 0.14), panelMask * 0.95);
  applyLayer(color, vec3(0.47, 0.29, 0.18), panelInset * 0.82);
  applyLayer(color, vec3(0.90, 0.69, 0.23), slit * 0.72);
  applyLayer(color, vec3(0.98, 0.85, 0.51), knob);
  applyLayer(color, vec3(0.84, 0.55, 0.25), beacon * 0.6);
}
