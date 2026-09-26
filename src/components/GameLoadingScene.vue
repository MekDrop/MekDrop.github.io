<template>
  <Transition name="game-loading-scene">
    <section
      v-if="active"
      class="game-loading-scene"
      data-game-loading-scene
      :data-loading-phase="phase"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="game-loading-scene__terrain" aria-hidden="true" />
      <div class="game-loading-scene__panel">
        <span class="game-loading-scene__eyebrow" aria-hidden="true">
          {{ t("game.loading.cartography") }}
        </span>
        <strong class="game-loading-scene__label">
          {{ t(`game.loading.${phase}`) }}
        </strong>
        <span class="game-loading-scene__track" aria-hidden="true">
          <i />
        </span>
      </div>
    </section>
  </Transition>
</template>

<script setup>
import { useI18n } from "vue-i18n";

defineProps({
  active: {
    type: Boolean,
    required: true,
  },
  phase: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.game-loading-scene {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #effff3;
  background:
    radial-gradient(circle at 76% 18%, rgba(86, 176, 105, 0.12), transparent 35%),
    linear-gradient(145deg, rgba(3, 6, 4, 0.93), rgba(3, 10, 6, 0.97));
  pointer-events: all;
}

.game-loading-scene__terrain {
  position: absolute;
  inset: -12%;
  background-image:
    repeating-radial-gradient(
      ellipse at 70% 44%,
      transparent 0 26px,
      rgba(128, 210, 125, 0.12) 27px 28px,
      transparent 29px 48px
    ),
    linear-gradient(rgba(128, 210, 125, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(128, 210, 125, 0.055) 1px, transparent 1px);
  background-size: auto, 42px 42px, 42px 42px;
  mask-image: linear-gradient(115deg, transparent 4%, #000 38%, #000 72%, transparent 96%);
  transform: rotate(-4deg) scale(1.08);
  animation: terrain-drift 7s ease-in-out infinite alternate;
}

.game-loading-scene__panel {
  position: relative;
  display: grid;
  width: min(82vw, 330px);
  gap: var(--app-ui-space-sm);
  padding: var(--app-ui-space-lg);
  background: rgba(5, 16, 10, 0.88);
  border: 1px solid rgba(184, 236, 195, 0.36);
  border-left: 3px solid var(--q-positive, #80d27d);
  border-radius: var(--app-ui-border-radius);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.48);
}

.game-loading-scene__eyebrow {
  color: #91bf98;
  font: 700 10px/1.2 var(--app-ui-font-family);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.game-loading-scene__label {
  min-height: 1.45em;
  font: 700 clamp(15px, 2.7vw, 18px) / 1.45 var(--app-ui-font-family);
  letter-spacing: 0.025em;
}

.game-loading-scene__track {
  position: relative;
  display: block;
  height: 3px;
  overflow: hidden;
  background: rgba(184, 236, 195, 0.14);
  border-radius: var(--app-ui-border-radius);
}

.game-loading-scene__track i {
  position: absolute;
  inset: 0 auto 0 0;
  width: 38%;
  background: linear-gradient(90deg, transparent, #b8ecc3, transparent);
  animation: cartographer-scan 1.25s ease-in-out infinite;
}

.game-loading-scene-enter-active,
.game-loading-scene-leave-active {
  transition: opacity 160ms ease;
}

.game-loading-scene-enter-from,
.game-loading-scene-leave-to {
  opacity: 0;
}

@keyframes cartographer-scan {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(365%);
  }
}

@keyframes terrain-drift {
  from {
    transform: rotate(-4deg) translate3d(-1%, -1%, 0) scale(1.08);
  }
  to {
    transform: rotate(-4deg) translate3d(1%, 1%, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-loading-scene__terrain,
  .game-loading-scene__track i {
    animation: none;
  }

  .game-loading-scene__track i {
    left: 31%;
  }

  .game-loading-scene-enter-active,
  .game-loading-scene-leave-active {
    transition: none;
  }
}
</style>
