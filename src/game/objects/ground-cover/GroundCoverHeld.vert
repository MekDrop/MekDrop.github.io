attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_color;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uBendHeight;

varying vec3 vWorldNormal;
varying vec4 vVertexColor;
varying float vTipHeight;

void main(void) {
  vec4 worldPosition = matrix_model * vec4(vertex_position, 1.0);
  float heightAboveRoot = max(
      worldPosition.y - matrix_model[3].y,
      0.0
  );

  vWorldNormal = normalize(mat3(matrix_model) * vertex_normal);
  vVertexColor = vertex_color;
  vTipHeight = smoothstep(0.015, uBendHeight, heightAboveRoot);
  gl_Position = matrix_viewProjection * worldPosition;
}
