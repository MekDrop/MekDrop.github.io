<template>
  <span v-if="mood && mood.kind !== HERO_MOOD.CALM" class="q-sr-only"
    :data-hero-mood="mood.kind" role="status" aria-live="polite">{{ label }}</span>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { HERO_MOOD } from "src/game/enum/HeroMood.js";

const props = defineProps({ mood: { type: Object, default: null } });
const { t } = useI18n();
const label = computed(() => t(`game.patting.${props.mood?.kind}`, {
  bonus: Math.round(((props.mood?.speedMultiplier ?? 1) - 1) * 100),
}));
</script>
