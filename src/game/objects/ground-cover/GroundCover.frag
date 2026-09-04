uniform vec3 uColorBoost;
uniform vec3 uLightDirection;

varying vec3 vWorldNormal;
varying vec4 vVertexColor;
varying float vTipHeight;

void main(void) {
  vec3 normal = normalize(vWorldNormal);
  if (!gl_FrontFacing) normal = -normal;
  float diffuseLight = max(dot(normal, normalize(uLightDirection)), 0.0);
  float lightAmount = 0.76 + diffuseLight * 0.24;
  float tipLight = vTipHeight * 0.035;
  vec3 color = vVertexColor.rgb * uColorBoost * (lightAmount + tipLight);
  gl_FragColor = vec4(color, vVertexColor.a);
}
