attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_color;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uBendHeight;
uniform vec3 uContactLocal;
uniform vec3 uContactDirectionLocal;
uniform float uContactRadius;
uniform float uContactAmount;

varying vec3 vWorldNormal;
varying vec4 vVertexColor;
varying float vTipHeight;

void main(void) {
  float heightAboveRoot = max(vertex_position.y, 0.0);
  float tipHeight = smoothstep(0.015, uBendHeight, heightAboveRoot);
  vec3 contactDelta = vertex_position - uContactLocal;
  float contactDistance = length(contactDelta);
  float contactInfluence = smoothstep(uContactRadius, 0.0, contactDistance) *
      uContactAmount;
  float flexibleSurface = max(0.25, tipHeight);
  vec3 bendDirection = normalize(
      mix(uContactDirectionLocal, contactDelta, 0.35)
  );
  vec3 localPosition = vertex_position;
  localPosition += bendDirection * contactInfluence * flexibleSurface *
      uBendHeight * 0.72;
  localPosition.y -= contactInfluence * flexibleSurface * uBendHeight * 0.34;

  vec4 worldPosition = matrix_model * vec4(localPosition, 1.0);

  vWorldNormal = normalize(mat3(matrix_model) * vertex_normal);
  vVertexColor = vertex_color;
  vTipHeight = tipHeight;
  gl_Position = matrix_viewProjection * worldPosition;
}
