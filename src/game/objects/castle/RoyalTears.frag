uniform float uTime;
uniform float uPhase;
uniform float uPrincess;
uniform float uWipeAt;
uniform float uRareDrop;
varying vec2 vUv;

void main(void) {
  vec2 p = vec2((vUv.x - 0.5) * 0.12, vUv.y * 0.52);
  float flow = uTime + uPhase;
  float fall = fract(flow);
  float distanceToTear;
  if (uPrincess > 0.5) {
    // A bead pools against the lower eyelid, then the cloth clears that eye.
    float age = fract(uTime - uWipeAt);
    float wetness = smoothstep(0.045, 0.62, age)
        * (1.0 - smoothstep(0.955, 1.0, age));
    vec2 bead = p - vec2(0.0, 0.004);
    vec2 radius = vec2(0.005 + 0.010 * wetness, 0.003 + 0.007 * wetness);
    distanceToTear = (length(bead / radius) - 1.0) * 0.008;
    if (wetness < 0.04) {
      distanceToTear = 1.0;
    }
    // An occasional tiny overflow immediately before the right-cheek dab.
    float spill = (fract(uTime) - 0.16) / 0.11;
    if (uRareDrop > 0.5 && spill > 0.0 && spill < 1.0) {
      vec2 drop = p - vec2(0.0, spill * 0.24);
      distanceToTear = min(distanceToTear,
          (length(drop / vec2(0.007, 0.012)) - 1.0) * 0.008);
    }
  } else {
    // Moisture gathers at the eyelid before it becomes heavy enough to fall.
    float wetness = smoothstep(0.0, 0.38, fall)
        * (1.0 - smoothstep(0.42, 0.50, fall));
    vec2 bead = p - vec2(0.0, 0.004);
    vec2 radius = vec2(0.004 + 0.010 * wetness, 0.003 + 0.007 * wetness);
    distanceToTear = (length(bead / radius) - 1.0) * 0.008;
    if (wetness < 0.035) {
      distanceToTear = 1.0;
    }
    if (fall > 0.45 && fall < 0.84) {
      float descent = (fall - 0.45) / 0.39;
      vec2 drop = p - vec2(0.001 * sin(descent * 6.2831853), descent * 0.36);
      float taper = mix(0.005, 0.011, clamp(drop.y / 0.035 + 0.5, 0.0, 1.0));
      distanceToTear = min(distanceToTear,
          (length(drop / vec2(taper, 0.020)) - 1.0) * 0.01);
    }
    if (fall >= 0.84) {
      discard;
    }
  }
  if (distanceToTear > 0.0) {
    discard;
  }

  // Opaque color bands keep the cel edges crisp and avoid alpha sorting.
  vec3 color = vec3(0.28, 0.45, 0.56);
  if (p.x < 0.002) {
    color = vec3(0.48, 0.64, 0.72);
  }
  float glint = step(0.62, fract(p.y * 9.0 - flow));
  if (p.x < -0.001 && p.x > -0.004 && glint > 0.5) {
    color = vec3(0.72, 0.81, 0.84);
  }
  if (distanceToTear > -0.0015) {
    color = vec3(0.19, 0.32, 0.40);
  }
  gl_FragColor = vec4(color, 1.0);
}
