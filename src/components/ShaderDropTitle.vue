<template>
  <div class="shader-drop-title" aria-label="MekDrop">
    <canvas ref="canvasRef" class="shader-drop-title__canvas" />
    <span class="shader-drop-title__text">MekDrop</span>
  </div>
</template>

<style scoped>
.shader-drop-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.shader-drop-title__canvas {
  width: 46px;
  height: 46px;
  display: block;
}

.shader-drop-title__text {
  font-family: "Courier New", monospace;
  font-size: 1.22rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: linear-gradient(90deg, #85fff4, #a3c8ff, #85fff4);
  background-size: 200% 100%;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  animation: shader-drop-title-text-flow 4s linear infinite;
}

@keyframes shader-drop-title-text-flow {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const canvasRef = ref(null);
let animationFrameId = 0;
let glContext = null;
let shaderProgram = null;
let positionBuffer = null;
let timeUniformLocation = null;
let resolutionUniformLocation = null;
let resizeHandler = null;
let startTime = 0;

const vertexShaderSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453123);
}

float sdEgg(vec2 p, float ra, float rb) {
  const float k = 1.7320508;
  p.x = abs(p.x);
  return ((p.y < 0.0)
      ? length(p) - rb
      : ((k * (p.x + ra) < p.y)
          ? length(vec2(p.x, p.y - k * ra))
          : length(vec2(p.x + ra, p.y)) - 2.0 * ra)) -
    rb;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= 1.08;

  float warp = 0.026 * sin(u_time * 2.1 + p.y * 8.0);
  p.x += warp;

  float drop = sdEgg(p + vec2(0.0, 0.09), 0.23, 0.49);

  float fillMask = smoothstep(0.02, -0.012, drop);
  float edgeGlow = smoothstep(0.06, 0.0, abs(drop));
  float ripple = 0.5 + 0.5 * sin(u_time * 4.6 + p.y * 12.0 + p.x * 7.0);

  float vertical = clamp((p.y + 0.75) / 1.7, 0.0, 1.0);
  vec3 innerA = vec3(0.07, 0.63, 0.84);
  vec3 innerB = vec3(0.48, 0.83, 0.98);
  vec3 inner = mix(innerB, innerA, vertical);
  inner += vec3(0.08, 0.14, 0.17) * (ripple - 0.5);

  float spec = smoothstep(0.26, -0.48, p.y + p.x * 0.78) * fillMask;
  vec3 color = inner * fillMask;
  color += vec3(0.86, 0.98, 1.0) * spec * 0.46;
  color += vec3(0.56, 0.96, 1.0) * edgeGlow * 0.23;

  float burstSeed = floor(u_time * 0.75);
  float burst = step(0.8, hash11(burstSeed + 3.2));
  float rapidSeed = floor(u_time * 34.0) + burstSeed * 17.0;
  float rapid = step(0.6, hash11(rapidSeed));
  float flicker = mix(1.0, mix(0.18, 1.32, rapid), burst);
  float basePulse = 0.93 + 0.07 * sin(u_time * 2.4);
  color *= basePulse * flicker;

  float alpha = clamp(fillMask + edgeGlow * 0.28, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

const createProgram = (gl) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
  );

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) {
      gl.deleteShader(vertexShader);
    }
    if (fragmentShader) {
      gl.deleteShader(fragmentShader);
    }
    return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
};

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas || !glContext) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  glContext.viewport(0, 0, canvas.width, canvas.height);
};

const render = (timestamp) => {
  if (!glContext || !shaderProgram || !canvasRef.value) {
    return;
  }

  if (startTime === 0) {
    startTime = timestamp;
  }

  const elapsedSeconds = (timestamp - startTime) / 1000;
  glContext.useProgram(shaderProgram);
  glContext.uniform1f(timeUniformLocation, elapsedSeconds);
  glContext.uniform2f(
    resolutionUniformLocation,
    canvasRef.value.width,
    canvasRef.value.height,
  );
  glContext.clearColor(0, 0, 0, 0);
  glContext.clear(glContext.COLOR_BUFFER_BIT);
  glContext.drawArrays(glContext.TRIANGLE_STRIP, 0, 4);

  animationFrameId = requestAnimationFrame(render);
};

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  glContext = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
  });

  if (!glContext) {
    return;
  }

  shaderProgram = createProgram(glContext);
  if (!shaderProgram) {
    return;
  }

  positionBuffer = glContext.createBuffer();
  glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    glContext.STATIC_DRAW,
  );

  const positionAttributeLocation = glContext.getAttribLocation(
    shaderProgram,
    "a_position",
  );
  timeUniformLocation = glContext.getUniformLocation(shaderProgram, "u_time");
  resolutionUniformLocation = glContext.getUniformLocation(
    shaderProgram,
    "u_resolution",
  );

  glContext.useProgram(shaderProgram);
  glContext.enableVertexAttribArray(positionAttributeLocation);
  glContext.vertexAttribPointer(
    positionAttributeLocation,
    2,
    glContext.FLOAT,
    false,
    0,
    0,
  );

  resizeHandler = () => {
    resizeCanvas();
  };
  resizeCanvas();
  window.addEventListener("resize", resizeHandler);
  animationFrameId = requestAnimationFrame(render);
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
  }

  if (glContext && positionBuffer) {
    glContext.deleteBuffer(positionBuffer);
  }
  if (glContext && shaderProgram) {
    glContext.deleteProgram(shaderProgram);
  }
});
</script>
