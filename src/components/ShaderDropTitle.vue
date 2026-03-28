<template>
  <div class="shader-drop-title" aria-label="MekDrop">
    <span class="shader-drop-title__text">MekDrop</span>
  </div>
</template>

<style scoped>
.shader-drop-title {
  display: flex;
  align-items: center;
  justify-content: center;
}

.shader-drop-title__text {
  font-family: "Courier New", monospace;
  font-size: 1.52rem;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  background: linear-gradient(90deg, #85fff4, #a3c8ff, #85fff4);
  background-size: 200% 100%;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 14px rgba(133, 255, 244, 0.25);
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
