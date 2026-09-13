uniform vec3 material_diffuse;
uniform float uRiverTime;
uniform sampler2D uHeroReflection;
uniform mat4 uHeroReflectionMatrix;
uniform vec4 uHeroWater;
uniform vec4 uRiverRocks[18];
uniform int uRiverRockCount;
uniform sampler2D uRiverFlowMap;
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
    surfaceUv = vec2(
      0.5 + route.w * (0.5 - length(offset)),
      route.x + progress
    );
  }
  vec2 flowDirection = normalize(mix(outgoing, fallFlow, vertical));
  float horizontalTop = (1.0 - vertical) *
    (1.0 - step(0.01, vVertexColor.r));
  vec2 uv = mix(surfaceUv, vUv0, max(vertical, horizontalTop));
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
  float warp = sin(downstream * 4.2 + across * 3.0) * 0.035 +
    (paintedNoise(vec2(across * 4.0, downstream * 2.1)) - 0.5) * 0.085;
  float bank = min(across, 1.0 - across);
  float bankFoam = 1.0 - paintedEdge(0.055 + warp, bank);
  float streak = sin((across + warp) * 23.0 + sin(downstream * 2.1) * 0.7);
  float breaks = paintedNoise(vec2(across * 8.0 + 13.0, downstream * 3.0));
  float streamFoam = paintedEdge(0.82, streak) * paintedEdge(0.47, breaks);
  float flecks = paintedEdge(0.78, paintedNoise(vec2(across * 13.0, downstream * 8.0)));
  float foam = max(bankFoam * 0.94, max(streamFoam, flecks * 0.75));
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
      float lateral = abs(dot(offset, crossFlow));
      float churn = sin(distanceToRock * 38.0 - uRiverTime * 7.0 + across * 8.0);
      float contact = 1.0 - smoothstep(0.035, 0.11, abs(distanceToRock - rock.w));
      float wake = smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.32, 0.7, along));
      wake *= 1.0 - smoothstep(rock.w * 0.65, rock.w + along * 0.25, lateral);
      float wakeBreak = smoothstep(0.06, 0.18,
        sin(along * 29.0 - uRiverTime * 7.0 + lateral * 16.0));
      foam = max(foam, max(contact * (0.76 + churn * 0.14), wake * wakeBreak * 0.82));
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

  // Impact foam belongs to the receiving surface; it cannot hover or flicker.
  float impact = (1.0 - vertical) * smoothstep(0.4, 0.86, vVertexColor.b);
  foam = max(foam, paintedEdge(0.35, impact + (wash - 0.5) * 0.42) * impact);
  foam *= 1.0 - depth;
  water = mix(water, teal * 0.64, depth);
  // A restrained reflected sky and sun glint, following the animated surface normal.
  vec3 normal = normalize(cross(dFdx(vPositionW), dFdy(vPositionW)));
  vec3 view = normalize(view_position - vPositionW);
  if (dot(normal, view) < 0.0) {
    normal = -normal;
  }
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
