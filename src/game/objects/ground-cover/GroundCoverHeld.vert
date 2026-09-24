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
  vWorldNormal = normalize(mat3(matrix_model) * vertex_normal);
  vVertexColor = vertex_color;
  vTipHeight = smoothstep(
      0.015,
      uBendHeight,
      max(vertex_position.y, 0.0)
  );
  gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
}
