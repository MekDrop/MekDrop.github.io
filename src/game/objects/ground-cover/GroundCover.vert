attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_color;
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;
uniform vec3 uHeroPosition;
uniform vec2 uHeroDirection;
uniform float uHeroInfluence;
uniform float uBendHeight;
uniform float uFlexibility;
uniform float uFlattening;

varying vec3 vWorldNormal;
varying vec4 vVertexColor;
varying float vTipHeight;

void main(void) {
  mat4 instanceMatrix = mat4(
      instance_line1,
      instance_line2,
      instance_line3,
      instance_line4
  );
  vec3 instanceOrigin = instanceMatrix[3].xyz;
  vec3 localPosition = mat3(instanceMatrix) * vertex_position + instanceOrigin;
  float heightAboveGround = max(localPosition.y - instanceOrigin.y, 0.0);
  float tipHeight = smoothstep(0.015, uBendHeight, heightAboveGround);
  float flexibleTip = tipHeight * tipHeight * uFlexibility;

  vec2 windDirection = normalize(vec2(0.82, 0.48));
  float broadWind = sin(
      uTime * 1.45 + instanceOrigin.x * 0.72 + instanceOrigin.z * 0.51
  );
  float fineWind = sin(
      uTime * 2.35 - instanceOrigin.x * 1.17 + instanceOrigin.z * 0.83
  );
  vec2 windOffset =
      windDirection *
      (broadWind * 0.09 + fineWind * 0.04) *
      uBendHeight *
      flexibleTip;

  vec2 heroOffset = instanceOrigin.xz - uHeroPosition.xz;
  float heroDistance = length(heroOffset);
  float sameLevel = 1.0 - smoothstep(
      0.58,
      0.9,
      abs(instanceOrigin.y - uHeroPosition.y)
  );
  float heroFalloff =
      (1.0 - smoothstep(0.16, 1.12, heroDistance)) *
      sameLevel *
      uHeroInfluence;
  vec2 awayFromHero =
      heroDistance > 0.001 ? heroOffset / heroDistance : -uHeroDirection;
  vec2 heroPushDirection = normalize(
      awayFromHero + uHeroDirection * (0.24 + heroFalloff * 0.12)
  );
  vec2 heroOffsetAmount =
      heroPushDirection * heroFalloff * flexibleTip * uBendHeight * 0.95;

  localPosition.xz += windOffset + heroOffsetAmount;
  localPosition.y -= heroFalloff * tipHeight * uFlattening;

  vec4 worldPosition = matrix_model * vec4(localPosition, 1.0);
  vWorldNormal = normalize(
      mat3(matrix_model) * mat3(instanceMatrix) * vertex_normal
  );
  vVertexColor = vertex_color;
  vTipHeight = tipHeight;
  gl_Position = matrix_viewProjection * worldPosition;
}
