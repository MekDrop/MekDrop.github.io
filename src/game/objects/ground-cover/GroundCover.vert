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
uniform float uBendHeight;
uniform float uFlexibility;
uniform float uAmbientMotion;
uniform vec4 uFlowerFoot0;
uniform vec4 uFlowerFoot1;
uniform vec2 uFlowerFootDirection;

varying vec3 vWorldNormal;
varying vec4 vVertexColor;
varying float vTipHeight;

vec3 compressFlowerContact(vec3 position, vec3 origin, vec4 foot) {
  // A geometric contact correction for worker latency and initial spawn.
  // Only the boot footprint is pressed down; outer petals remain visible.
  vec2 delta = position.xz - foot.xz;
  vec2 across = vec2(uFlowerFootDirection.y, -uFlowerFootDirection.x);
  vec2 outside = abs(vec2(dot(delta, across), dot(delta, uFlowerFootDirection))) - vec2(0.095, 0.13);
  float contact = 1.0 - smoothstep(0.0, 0.025, max(outside.x, outside.y));
  float enabled = foot.w * step(origin.y, foot.y + 0.6) * step(foot.y, position.y + 0.0175);
  position.y = mix(position.y, min(position.y, max(origin.y + 0.001, foot.y - 0.0175)), contact * enabled);
  return position;
}

void main(void) {
  mat4 instanceMatrix = mat4(
      instance_line1,
      instance_line2,
      instance_line3,
      instance_line4
  );
  vec3 instanceOrigin = instanceMatrix[3].xyz;
  vec3 instanceOffset = mat3(instanceMatrix) * vertex_position;
  float heightAboveGround = max(instanceOffset.y, 0.0);
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
      flexibleTip *
      uAmbientMotion;

  vec3 localPosition = instanceOffset + instanceOrigin;
  localPosition.xz += windOffset;
  localPosition = compressFlowerContact(localPosition, instanceOrigin, uFlowerFoot0);
  localPosition = compressFlowerContact(localPosition, instanceOrigin, uFlowerFoot1);

  vec4 worldPosition = matrix_model * vec4(localPosition, 1.0);
  vec3 localNormal = normalize(mat3(instanceMatrix) * vertex_normal);
  vWorldNormal = normalize(
      mat3(matrix_model) * localNormal
  );
  vVertexColor = vertex_color;
  vTipHeight = tipHeight;
  gl_Position = matrix_viewProjection * worldPosition;
}
