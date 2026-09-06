uniform vec3 material_diffuse;
uniform vec3 uGrassHeroPosition;
uniform vec2 uGrassHeroDirection;
uniform float uGrassHeroInfluence;
uniform float uGrassMotionInfluence;

float grassHash(vec2 position) {
  return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453);
}

float grassNoise(vec2 position) {
  vec2 cell = floor(position);
  vec2 blend = fract(position);
  blend = blend * blend * (3.0 - 2.0 * blend);
  float bottom = mix(
    grassHash(cell),
    grassHash(cell + vec2(1.0, 0.0)),
    blend.x
  );
  float top = mix(
    grassHash(cell + vec2(0.0, 1.0)),
    grassHash(cell + vec2(1.0, 1.0)),
    blend.x
  );
  return mix(bottom, top, blend.y);
}

void getAlbedo() {
  dAlbedo = material_diffuse.rgb;

  #ifdef STD_DIFFUSE_TEXTURE
    vec2 grassPosition = vPositionW.xz;
    vec2 windDirection = normalize(vec2(0.78, 0.48));
    float broadBend = grassNoise(grassPosition * 0.72) - 0.5;
    float fineBend = grassNoise(grassPosition * 2.1 + vec2(17.0, 9.0)) - 0.5;

    vec2 heroOffset = grassPosition - uGrassHeroPosition.xz;
    vec2 heroDirection = normalize(uGrassHeroDirection);
    vec2 heroCrossDirection = vec2(-heroDirection.y, heroDirection.x);
    float alongHeroMotion = dot(heroOffset, heroDirection);
    float acrossHeroMotion = dot(heroOffset, heroCrossDirection);
    float heroTrailDistance = length(vec2(
      (alongHeroMotion + 0.22) / 0.72,
      acrossHeroMotion / 0.38
    ));
    float sameLevel = 1.0 - smoothstep(
      0.3,
      0.78,
      abs(vPositionW.y - uGrassHeroPosition.y)
    );
    float heroFalloff =
      (1.0 - smoothstep(0.16, 1.0, heroTrailDistance)) *
      sameLevel *
      uGrassHeroInfluence;
    float brushedFibres = grassNoise(vec2(
      acrossHeroMotion * 34.0,
      alongHeroMotion * 7.0
    ) + vec2(5.0, 13.0));
    float unevenPress = mix(0.86, 1.12, brushedFibres);

    vec2 distortedGrassPosition =
      grassPosition +
      windDirection *
        (broadBend * 0.034 + fineBend * 0.012) *
        uGrassMotionInfluence -
      heroDirection * heroFalloff * unevenPress * 0.12;
    vec2 derivativeX = dFdx(grassPosition);
    vec2 derivativeY = dFdy(grassPosition);
    float worldUnitsPerPixel = max(
      length(derivativeX),
      length(derivativeY)
    );
    float bladeVisibility = 1.0 - smoothstep(
      0.012,
      0.045,
      worldUnitsPerPixel
    );
    float distantTextureBias = smoothstep(
      0.018,
      0.055,
      worldUnitsPerPixel
    ) * 1.25;
    vec2 continuousGrassUv = distortedGrassPosition * 0.32;
    vec3 grassTexture = {STD_DIFFUSE_TEXTURE_DECODE}(
      texture2DBias(
        {STD_DIFFUSE_TEXTURE_NAME},
        continuousGrassUv,
        textureBias + distantTextureBias
      )
    ).{STD_DIFFUSE_TEXTURE_CHANNEL};

    vec2 crossWindDirection = vec2(-windDirection.y, windDirection.x);
    vec2 directionalGrassUv = vec2(
      dot(distortedGrassPosition, crossWindDirection) * 0.88,
      dot(distortedGrassPosition, windDirection) * 0.24 +
        broadBend * 0.012 * uGrassMotionInfluence
    );
    vec3 directionalGrassTexture = {STD_DIFFUSE_TEXTURE_DECODE}(
      texture2DBias(
        {STD_DIFFUSE_TEXTURE_NAME},
        directionalGrassUv,
        textureBias + distantTextureBias
      )
    ).{STD_DIFFUSE_TEXTURE_CHANNEL};
    grassTexture = mix(
      grassTexture,
      directionalGrassTexture,
      bladeVisibility * 0.46
    );

    vec2 bladeSpace = vec2(
      dot(distortedGrassPosition, windDirection),
      dot(distortedGrassPosition, crossWindDirection)
    );
    float broadFibres = grassNoise(
      vec2(bladeSpace.x * 6.0, bladeSpace.y * 27.0) +
      vec2(
        broadBend * 0.4 * uGrassMotionInfluence + heroFalloff * 0.58,
        0.0
      )
    );
    float fineFibres = grassNoise(
      vec2(bladeSpace.x * 11.0, bladeSpace.y * 49.0) +
      vec2(
        fineBend * 0.3 * uGrassMotionInfluence + heroFalloff * 0.32,
        19.0
      )
    );
    float bladeRelief =
      ((broadFibres - 0.5) * 1.35 + (fineFibres - 0.5) * 0.65) *
      bladeVisibility;
    float windSheen =
      (broadBend * 0.032 + fineBend * 0.011) *
      mix(0.65, 1.0, grassNoise(grassPosition * 1.35)) *
      uGrassMotionInfluence;
    float brushedRelief = (brushedFibres - 0.5) * heroFalloff;
    grassTexture *=
      1.0 + bladeRelief * 0.21 + windSheen + brushedRelief * 0.1;
    grassTexture +=
      vec3(0.014, 0.072, 0.009) * max(0.0, bladeRelief);
    grassTexture *= mix(
      vec3(1.0),
      vec3(0.86, 0.94, 0.82),
      heroFalloff * 0.2
    );
    dAlbedo *= grassTexture;
  #endif

  #ifdef STD_DIFFUSE_VERTEX
    dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
  #endif
}
