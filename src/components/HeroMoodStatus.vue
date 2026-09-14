<template>
  <div v-if="mood && mood.kind !== HERO_MOOD.CALM" class="hero-mood"
    :class="`hero-mood--${mood.kind}`" :data-hero-mood="mood.kind">
    <span class="hero-mood__announcement" role="status" aria-live="polite">{{ label }}</span>
    <span v-if="mood.screen" class="hero-mood__particle" aria-hidden="true"
      :style="{ left: `${mood.screen.x}px`, top: `${mood.screen.y - mood.screen.radius - 14}px` }">
      <span class="hero-mood__growth" :style="{ transform: `scale(${symbolScale})` }">
        <Transition name="mood-symbol" mode="out-in">
          <i :key="symbol" class="hero-mood__symbol">
            <span class="hero-mood__motion">{{ symbol }}</span>
          </i>
        </Transition>
      </span>
    </span>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { HERO_MOOD } from "src/game/enum/HeroMood.js";

const props = defineProps({ mood: { type: Object, default: null } });
const { t } = useI18n();
const symbol = computed(() => props.mood?.kind === HERO_MOOD.HAPPY ? "♥"
  : props.mood?.kind === HERO_MOOD.ANGRY ? "💢" : "!");
const symbolScale = computed(() => 1 + (props.mood?.reactionProgress ?? 0) * 0.9);
const label = computed(() => t(`game.patting.${props.mood?.kind}`, {
  bonus: Math.round(((props.mood?.speedMultiplier ?? 1) - 1) * 100),
}));
</script>

<style scoped lang="scss">
.hero-mood {
  --mood-color: #98edaf;
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.hero-mood--agitated { --mood-color: #ffd27b; }
.hero-mood--angry { --mood-color: #ff958b; }
.hero-mood__announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.hero-mood__particle {
  position: absolute;
  transform: translate(-50%, -100%);
  color: var(--mood-color);
  font: 900 25px/1 sans-serif;
  text-shadow: 0 2px 3px #000, 0 0 10px #0008;
}
.hero-mood__growth {
  display: block;
  transform-origin: center bottom;
  transition: transform 160ms ease-out;
}
.hero-mood__symbol {
  display: block;
  font-style: normal;
  transform-origin: center bottom;
}
.hero-mood__motion {
  display: block;
  animation: pat-float 900ms ease-in-out infinite alternate;
}
.hero-mood--angry .hero-mood__motion {
  animation: pat-shake 180ms ease-in-out infinite alternate;
}
.mood-symbol-leave-active {
  transition: transform 120ms ease-in, opacity 120ms ease-in;
}
.mood-symbol-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.3) rotate(12deg);
}
.mood-symbol-enter-active {
  animation: mood-symbol-pop 280ms ease-out;
}
@keyframes mood-symbol-pop {
  0% { opacity: 0; transform: scale(0.25) rotate(-18deg); }
  65% { opacity: 1; transform: scale(1.22) rotate(5deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes pat-float { to { transform: translateY(-8px) scale(1.12); } }
@keyframes pat-shake { to { transform: rotate(12deg) scale(1.15); } }
@media (prefers-reduced-motion: reduce) {
  .hero-mood__growth { transition: none; }
  .hero-mood__motion,
  .mood-symbol-enter-active { animation: none !important; }
  .mood-symbol-leave-active { transition: none; }
}
</style>
