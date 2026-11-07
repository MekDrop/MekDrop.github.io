attribute vec3 vertex_position;
uniform mat4 matrix_view;
uniform vec2 uSkyLens;
varying vec3 vSkyDirection;

void main(void) {
  vSkyDirection = vertex_position;
  // Rotation only: the camera is always inside the box, at its center.
  vec3 view = mat3(matrix_view) * vertex_position;
  gl_Position = vec4(view.xy / uSkyLens, -view.z - 0.000001, -view.z);
}
