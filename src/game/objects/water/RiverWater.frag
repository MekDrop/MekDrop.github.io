uniform vec3 material_diffuse;
uniform float uRiverTime;
uniform sampler2D uHeroReflection;
uniform mat4 uHeroReflectionMatrix;
uniform vec4 uHeroWater;
uniform vec4 uRiverRocks[18];
uniform int uRiverRockCount;
uniform vec4 uCascadeImpacts[32];
uniform vec4 uCascadeFlows[32];
uniform int uCascadeImpactCount;
uniform sampler2D uRiverFlowMap;
uniform sampler2D uCascadeCurrentMap;
uniform sampler2D uRiverBankMap;
uniform vec2 uRiverMapSize;

float paintedHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float paintedNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(paintedHash(i), paintedHash(i + vec2(1.0, 0.0)), f.x),
    mix(paintedHash(i + vec2(0.0, 1.0)), paintedHash(i + 1.0), f.x), f.y);
}

// Two overlapping advection phases hide the reset while the texture follows
// the spatial current, including backward spread and bank-driven turns.
float currentNoise(vec2 position, vec2 velocity, float frequency) {
  float phase = fract(uRiverTime * 2.0);
  float nextPhase = fract(uRiverTime * 2.0 + 0.5);
  float first = paintedNoise((position - velocity * phase * 0.5) * frequency);
  float second = paintedNoise((position - velocity * nextPhase * 0.5) * frequency);
  return mix(first, second, abs(phase - 0.5) * 2.0);
}

// Broad, antialiased paint shapes stay readable at the normal game zoom.
float paintedEdge(float edge, float value) {
  float aa = max(0.015, fwidth(value));
  return smoothstep(edge - aa, edge + aa, value);
}

void getAlbedo() {
  float metadataLength = length(vUv1);
  float vertical = clamp(metadataLength - 1.0, 0.0, 1.0);
  vec2 fallFlow = vUv1 / max(metadataLength, 0.0001);
  vec2 gridPosition = vPositionW.xz + uRiverMapSize * 0.5;
  // Keep the terminal edge in its final cell. Letting floor() step outside
  // the flow map resets the local coordinate while the texture stays clamped,
  // producing a one-pixel paint seam where the surface meets the waterfall.
  vec2 cell = clamp(
    floor(gridPosition),
    vec2(0.0),
    uRiverMapSize - vec2(1.0)
  );
  vec2 local = gridPosition - cell - 0.5;
  vec4 route = texture2D(uRiverFlowMap, (cell + 0.5) / uRiverMapSize);
  vec2 outgoing = route.yz;
  vec2 surfaceFlow = outgoing;
  vec2 surfaceUv = vec2(
    0.5 + dot(local, vec2(-outgoing.y, outgoing.x)),
    route.x + 0.5 + dot(local, outgoing)
  );
  if (abs(route.w) > 0.5) {
    vec2 incoming = vec2(outgoing.y, -outgoing.x) * route.w;
    vec2 offset = local - (outgoing - incoming) * 0.5;
    float along = max(0.0, dot(offset, incoming));
    float before = max(0.0, -dot(offset, outgoing));
    float progress = atan(along, max(0.000001, before)) / 1.57079632679;
    vec2 tangent = vec2(-offset.y, offset.x) * route.w;
    surfaceFlow = length(tangent) > 0.0001 ? normalize(tangent) : outgoing;
    surfaceUv = vec2(
      0.5 + route.w * (0.5 - length(offset)),
      route.x + progress
    );
  }
  vec2 flowDirection = normalize(mix(surfaceFlow, fallFlow, vertical));
  float horizontalTop = (1.0 - vertical) *
    (1.0 - step(0.01, vVertexColor.r));
  vec2 uv = mix(surfaceUv, vUv0, max(vertical, horizontalTop));
  // Bend the moving paint around exposed stones, using a local stream
  // function. Flow divides upstream, accelerates along the flanks, and
  // converges again downstream instead of sliding straight through the rock.
  float bankAcross = uv.x;
  vec2 obstacleOffset = vec2(0.0);
  vec2 acrossFlow = vec2(-flowDirection.y, flowDirection.x);
  for (int rockIndex = 0; rockIndex < 18; rockIndex++) {
    if (rockIndex >= uRiverRockCount) {
      break;
    }
    vec4 rock = uRiverRocks[rockIndex];
    vec2 offset = vPositionW.xz - rock.xz;
    float radius = rock.w * 1.08;
    float distanceSquared = dot(offset, offset);
    float influence = radius * radius / max(distanceSquared, radius * radius);
    influence *= 1.0 - smoothstep(radius * 1.6, radius + 0.65, sqrt(distanceSquared));
    influence *= 1.0 - smoothstep(0.04, 0.12, abs(vPositionW.y - rock.y));
    obstacleOffset += vec2(dot(offset, acrossFlow), dot(offset, flowDirection) * 0.18) * influence;
  }
  // Only the moving ribbons bend: warping the broad color wash made a lens.
  vec2 foamUv = uv - obstacleOffset * horizontalTop;
  vec4 currentSample = texture2D(uCascadeCurrentMap, gridPosition / uRiverMapSize);
  float wetCoverage = max(currentSample.a, 0.001);
  vec2 impactVelocity = (currentSample.rg * 255.0 - 128.0) / (127.0 * wetCoverage);
  float cascadeChurn = clamp(currentSample.b / wetCoverage, 0.0, 1.0) * horizontalTop;
  float impactWash = currentNoise(vPositionW.xz, impactVelocity, 5.2);
  float impactBubbles = currentNoise(vPositionW.xz + 17.3, impactVelocity, 12.0);
  float cascadeFoam = paintedEdge(0.58, impactBubbles) * 0.76;
  // Backwash reaches every closed landing edge, including the far wall of
  // an L turn. Broken crests roll back from the wall into the local current.
  vec4 closedBanks = texture2D(uRiverBankMap, (cell + 0.5) / uRiverMapSize);
  vec4 bankDistances = vec4(0.5 + local.x, 0.5 - local.x, 0.5 + local.y, 0.5 - local.y);
  vec4 wallDistances = mix(vec4(2.0), bankDistances, closedBanks);
  float wallDistance = min(min(wallDistances.x, wallDistances.y),
    min(wallDistances.z, wallDistances.w));
  float wallEnvelope = 1.0 - smoothstep(0.035, 0.2, wallDistance);
  float wallCrest = sin(wallDistance * 42.0 - uRiverTime * 7.0 + impactBubbles * 3.0);
  float brokenCrest = paintedEdge(0.35, impactBubbles);
  float backwashFoam = wallEnvelope * brokenCrest *
    (0.35 + paintedEdge(0.45, wallCrest) * 0.5);
  cascadeFoam = max(cascadeFoam, backwashFoam);
  for (int impactIndex = 0; impactIndex < 32; impactIndex++) {
    if (impactIndex >= uCascadeImpactCount) {
      break;
    }
    vec4 impact = uCascadeImpacts[impactIndex];
    vec4 impactFlow = uCascadeFlows[impactIndex];
    vec2 offset = vPositionW.xz - impact.xz;
    float sameSurface = horizontalTop *
      (1.0 - smoothstep(0.04, 0.12, abs(vPositionW.y - impact.y)));
    float alongJet = dot(offset, impactFlow.xy);
    float acrossJet = dot(offset, vec2(-impactFlow.y, impactFlow.x));
    float core = (1.0 - smoothstep(0.06, 0.26, abs(alongJet))) *
      (1.0 - smoothstep(0.38, 0.54, abs(acrossJet)));
    cascadeFoam = max(cascadeFoam,
      core * (0.3 + impactBubbles * 0.55) * sameSurface * impact.w);
  }
  float across = uv.x;
  float downstream = uv.y - uRiverTime * 0.72;
  float depth = (1.0 - vertical) * vVertexColor.r;
  float lip = vertical * smoothstep(0.0, 0.75, vVertexColor.b);
  float falling = vertical * vVertexColor.g;

  // A gouache palette: shaded teal, mint, pale aqua, warm white.
  vec3 teal = vec3(0.15, 0.39, 0.38);
  vec3 mint = vec3(0.28, 0.58, 0.55);
  vec3 aqua = vec3(0.44, 0.69, 0.65);
  vec3 white = vec3(0.77, 0.85, 0.81);
  float wash = paintedNoise(vec2(across * 3.6, downstream * 1.5));
  float patches = paintedEdge(0.47, wash);
  vec3 water = mix(mint, aqua, patches * 0.55);
  water = mix(water, teal, (1.0 - paintedEdge(0.28, wash)) * 0.55);

  // Broken ribbons follow route coordinates through every corner.
  float foamAcross = foamUv.x;
  float foamDownstream = foamUv.y - uRiverTime * 0.72;
  float warp = sin(foamDownstream * 4.2 + foamAcross * 3.0) * 0.035 +
    (paintedNoise(vec2(foamAcross * 4.0, foamDownstream * 2.1)) - 0.5) * 0.085;
  float bank = min(bankAcross, 1.0 - bankAcross);
  float bankFoam = 1.0 - paintedEdge(0.055 + warp, bank);
  float streak = sin((foamAcross + warp) * 23.0 + sin(foamDownstream * 2.1) * 0.7);
  float breaks = paintedNoise(vec2(foamAcross * 8.0 + 13.0, foamDownstream * 3.0));
  float streamFoam = paintedEdge(0.82, streak) * paintedEdge(0.47, breaks);
  float flecks = paintedEdge(0.78, paintedNoise(vec2(foamAcross * 13.0, foamDownstream * 8.0)));
  float foam = max(bankFoam * 0.94, max(streamFoam, flecks * 0.75));
  float sourceEnvelope =
    (1.0 - vertical) *
    (1.0 - step(0.01, vVertexColor.r)) *
    clamp(vVertexColor.g, 0.0, 1.0);
  float sourceProgress = clamp(vVertexColor.b / 0.3764706, 0.0, 1.0);
  float sourceFlowPhase = sourceProgress * 14.0 - uRiverTime * 7.4;
  float sourcePressure = 0.52 + sin(sourceFlowPhase) * 0.29;
  sourcePressure += sin(
    sourceProgress * 25.0 - uRiverTime * 10.7 + across * 2.2
  ) * 0.14;
  sourcePressure += sin(
    sourceProgress * 7.0 - uRiverTime * 4.3 + 1.9
  ) * 0.09;
  sourcePressure = clamp(sourcePressure, 0.0, 1.0);
  float sourceEnergy = 1.0 - smoothstep(0.34, 0.96, sourceProgress);
  float sourceCrests = paintedEdge(0.67, sourcePressure);
  float outletBand = smoothstep(0.72, 0.97, sourceEnvelope);
  float fixedAcrossNoise = paintedNoise(vec2(across * 7.0 + 31.0, 4.7));
  float foamFlicker = sin(
    uRiverTime * 5.8 + across * 8.5 + fixedAcrossNoise * 2.8
  ) * 0.5 + 0.5;
  float brokenAcross = 0.72 + paintedEdge(0.48, foamFlicker) * 0.28;
  float sourceFoam = max(
    outletBand * (0.28 + brokenAcross * 0.18),
    sourceEnvelope * sourceEnergy * sourceCrests * brokenAcross * 0.88
  );
  foam = max(foam, sourceFoam);
  water = mix(
    water,
    aqua,
    outletBand * 0.08 + sourceEnvelope * sourceCrests * 0.16
  );
  if (vertical < 0.5 && depth < 0.01) {
    vec2 flow = flowDirection;
    vec2 crossFlow = vec2(-flow.y, flow.x);
    for (int rockIndex = 0; rockIndex < 18; rockIndex++) {
      if (rockIndex >= uRiverRockCount) {
        break;
      }
      vec4 rock = uRiverRocks[rockIndex];
      vec2 offset = vPositionW.xz - rock.xz;
      float distanceToRock = length(offset);
      if (distanceToRock > 0.8 || abs(vPositionW.y - rock.y) > 0.08) {
        continue;
      }
      float along = dot(offset, flow);
      float lateral = dot(offset, crossFlow);
      vec2 foamPosition = vec2(lateral * 23.0, (along - uRiverTime * 0.72) * 9.0);
      float churn = paintedNoise(foamPosition + rock.xz * 17.0);
      // Water piles up only against the upstream face, never in a full ring.
      float contact = 1.0 - smoothstep(0.02, 0.065, abs(distanceToRock - rock.w));
      contact *= 1.0 - smoothstep(-rock.w * 0.65, 0.0, along);
      contact *= 0.42 + churn * 0.28;

      // Separate, uneven trails peel off the sides and drift downstream.
      // Signed lateral noise avoids mirrored chevrons and transverse wave bands.
      float wake = smoothstep(-rock.w * 0.25, rock.w * 0.5, along) *
        (1.0 - smoothstep(0.22, 0.65, along));
      float trailOffset = rock.w * (0.8 - smoothstep(0.0, 0.65, along) * 0.3);
      float drift = (paintedNoise(foamPosition * vec2(0.45, 0.55) + 7.3) - 0.5) * 0.055;
      float trail = 1.0 - smoothstep(0.015, 0.055, abs(abs(lateral + drift) - trailOffset));
      float wakeBreak = smoothstep(0.42, 0.7, churn);
      foam = max(foam, max(contact, wake * trail * wakeBreak * 0.68));
    }
  }

  // Warped, elongated paint patches split, join, and end at different heights.
  // Evaluate derivatives for every fragment; WebGPU requires uniform control flow.
  vec2 fallPosition = vec2(across * 5.2, downstream * 0.85);
  vec2 drift = vec2(
    paintedNoise(fallPosition * vec2(0.56, 0.73) + vec2(8.3, 2.7)),
    paintedNoise(fallPosition * vec2(0.81, 0.49) + vec2(3.1, 19.4))
  ) - 0.5;
  vec2 tornPosition = fallPosition + drift * vec2(1.65, 0.75);
  float broadPaint = paintedNoise(tornPosition * vec2(1.0, 0.65));
  float tornPaint = paintedNoise(
    tornPosition * vec2(2.3, 1.8) + vec2(21.4, 5.9)
  );
  float channels = broadPaint * 0.72 + tornPaint * 0.28;
  // Trace narrow channel boundaries instead of whitening one whole side of a
  // binary noise threshold. At 1x that old mask collapsed into broad flashing
  // bands because the fall is only a few pixels wide.
  float channelBoundary = 1.0 - abs(channels - 0.5) * 2.0;
  float boundaryFoam = paintedEdge(0.74, channelBoundary) * 0.58;
  float ribbonWarp =
    (broadPaint - 0.5) * 0.13 + sin(downstream * 1.7) * 0.025;
  float ribbon = sin((across + ribbonWarp) * 18.0);
  float ribbonBreaks = paintedEdge(0.43, tornPaint);
  float fallFoam = max(
    0.12,
    max(boundaryFoam, paintedEdge(0.82, ribbon) * ribbonBreaks * 0.82)
  );
  float fleckPaint = paintedNoise(
    tornPosition * vec2(3.3, 3.8) + vec2(4.9, 11.2)
  );
  float foamChips = paintedEdge(0.77, fleckPaint) * 0.42;
  float edgeSurge = (1.0 - paintedEdge(0.045 + tornPaint * 0.09, bank)) *
    paintedEdge(0.53, broadPaint) * 0.86;
  fallFoam = max(fallFoam, max(foamChips, edgeSurge));
  foam = mix(foam, fallFoam, lip);
  vec3 fallWater = mix(mint, aqua, paintedEdge(0.43, tornPaint) * 0.72);
  water = mix(water, fallWater, lip * 0.85);

  // Replace both color and foam motion near the landing. Merely distorting
  // route UVs still makes water enter from the cliff instead of the impact.
  foam = mix(foam, cascadeFoam, cascadeChurn);
  vec3 impactWater = mix(teal, aqua, 0.2 + paintedEdge(0.46, impactWash) * 0.65);
  water = mix(water, impactWater, cascadeChurn);
  foam *= 1.0 - depth;
  water = mix(water, teal * 0.64, depth);
  // A restrained reflected sky and sun glint, following the animated surface normal.
  vec3 normal = normalize(cross(dFdx(vPositionW), dFdy(vPositionW)));
  vec3 view = normalize(view_position - vPositionW);
  if (dot(normal, view) < 0.0) {
    normal = -normal;
  }
  // Side streamlines keep their depth through the spillway. Advect along
  // the mesh arc so they first travel forward, then bend downward with it.
  float sheetFacing = abs(dot(normal, vec3(fallFlow.x, 0.0, fallFlow.y)));
  float sheetSide = vertical * (1.0 - smoothstep(0.15, 0.65, sheetFacing)) *
    (1.0 - abs(normal.y));
  vec2 sidePosition = vec2(
    vVertexColor.r * 3.2,
    (vUv0.y - uRiverTime * 0.72) * 4.0
  );
  float sideWarp = paintedNoise(sidePosition * vec2(0.7, 0.55) + 12.4);
  vec2 sideFlow = sidePosition + vec2((sideWarp - 0.5) * 0.8, 0.0);
  float sideChannels = paintedNoise(sideFlow);
  float sideBreaks = paintedNoise(sideFlow * vec2(1.8, 2.5) + 4.7);
  float sideFoam = paintedEdge(0.59, sideChannels) *
    paintedEdge(0.36, sideBreaks) * 0.76;
  sideFoam = max(sideFoam, paintedEdge(0.8, sideBreaks) * 0.45);
  vec3 sideWater = mix(teal, aqua, 0.35 + sideChannels * 0.55);
  foam = mix(foam, sideFoam, sheetSide);
  water = mix(water, sideWater, sheetSide);
  vec3 reflected = reflect(-view, normal);
  float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
  float horizon = 1.0 - smoothstep(0.0, 0.85, abs(reflected.y));
  vec3 sky = mix(vec3(0.32, 0.55, 0.65), vec3(0.67, 0.79, 0.80), horizon);
  float reflection = (0.045 + fresnel * 0.12) * (1.0 - depth) * mix(1.0, 0.4, lip);
  water = mix(water, sky, reflection);
  vec3 sun = normalize(vec3(-0.45, 0.82, 0.35));
  float glint = pow(max(dot(reflected, sun), 0.0), 64.0);
  water = mix(water, vec3(0.86, 0.91, 0.85), glint * 0.16 * (1.0 - depth));
  float tail = smoothstep(0.72, 1.0, falling);
  // Palette values are display colors; convert once for the renderer's linear output.
  dAlbedo = pow(mix(water, white, clamp(foam + tail * 0.08, 0.0, 1.0)), vec3(2.2));
  // Texture derivatives must stay under uniform control flow on WebGPU.
  // Mask the submerged volume in the result instead of branching on vertex depth.
  if (uHeroWater.w > 0.5) {
    vec2 fromHero = vPositionW.xz - uHeroWater.xz;
    // uHeroWater stores x, surface elevation, z, active.
    float distanceToHead = length(fromHero);
    float sameSurface = 1.0 - smoothstep(0.04, 0.12, abs(vPositionW.y - uHeroWater.y));
    sameSurface *= 1.0 - vertical;
    sameSurface *= 1.0 - smoothstep(0.01, 0.08, depth);
    float nearby = (1.0 - smoothstep(0.4, 0.95, distanceToHead)) * sameSurface;
    vec4 projected = uHeroReflectionMatrix * vec4(vPositionW, 1.0);
    vec2 reflectedUv = projected.xy / projected.w * 0.5 + 0.5;
    reflectedUv += vec2(
      sin(vPositionW.z * 32.0 - uRiverTime * 5.0),
      sin(vPositionW.x * 26.0 - uRiverTime * 3.7)
    ) * 0.007;
    float inFrame = step(0.0, reflectedUv.x) * step(reflectedUv.x, 1.0) *
      step(0.0, reflectedUv.y) * step(reflectedUv.y, 1.0);
    vec4 face = texture2D(uHeroReflection, reflectedUv);
    vec3 reflectedFace = pow(face.rgb, vec3(2.2)) * vec3(0.62, 0.82, 0.80);
    dAlbedo = mix(dAlbedo, reflectedFace,
      face.a * nearby * inFrame * 0.3 * (1.0 - foam * 0.6));
    float ripple = sin(distanceToHead * 37.0 - uRiverTime * 6.0);
    float collar = smoothstep(0.18, 0.26, distanceToHead) *
      (1.0 - smoothstep(0.32, 0.55, distanceToHead));
    dAlbedo = mix(dAlbedo, pow(white, vec3(2.2)),
      paintedEdge(0.78, ripple) * collar * sameSurface * 0.22);
  }
}
