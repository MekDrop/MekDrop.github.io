attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 instance_line1;
attribute vec4 instance_line2;
attribute vec4 instance_line3;
attribute vec4 instance_line4;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform vec2 uCloudYaw;

varying vec3 vCubePosition;
varying vec3 vWorldNormal;

void main(void) {
  mat4 instanceMatrix = mat4(
      instance_line1,
      instance_line2,
      instance_line3,
      instance_line4
  );
  vec3 cubeOffset = instanceMatrix[3].xyz;
  vec3 orientedOffset = vec3(
      uCloudYaw.x * cubeOffset.x + uCloudYaw.y * cubeOffset.z,
      cubeOffset.y,
      -uCloudYaw.y * cubeOffset.x + uCloudYaw.x * cubeOffset.z
  );
  vec3 localPosition = mat3(instanceMatrix) * vertex_position + orientedOffset;
  vec4 worldPosition = matrix_model * vec4(localPosition, 1.0);

  vCubePosition = vertex_position;
  vWorldNormal = normalize(mat3(matrix_model) * vertex_normal);
  gl_Position = matrix_viewProjection * worldPosition;
}
