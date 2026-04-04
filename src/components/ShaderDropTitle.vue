<template>
  <div class="shader-drop-title" aria-label="MekDrop">
    <span class="shader-drop-title__text">MekDrop</span>
  </div>
</template>

<style scoped>
.shader-drop-title {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 4.5rem;
  border: 1px solid rgba(150, 255, 224, 0.42);
  padding: 0.9rem 1rem;
  position: relative;
}

.shader-drop-title__text {
  font-family: "Courier New", monospace;
  font-size: clamp(1.2rem, 1rem + 0.9vw, 1.8rem);
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #e6fff0;
}

.shader-drop-title::before,
.shader-drop-title::after {
  content: "";
  position: absolute;
  left: 0.65rem;
  right: 0.65rem;
  height: 1px;
  background: rgba(150, 255, 224, 0.22);
}

.shader-drop-title::before {
  top: 0.4rem;
}

.shader-drop-title::after {
  bottom: 0.4rem;
}
</style>
