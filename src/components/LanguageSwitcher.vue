<template>
  <div class="language-switcher">
    <template v-for="lang in languageOptions" :key="lang.value">
      <q-btn
        :data-locale="lang.value"
        class="language-switcher__btn"
        :class="{
          'language-switcher__btn--active': lang.value === i18n.locale.value,
        }"
        dense
        flat
        :title="lang.label"
        :aria-label="lang.label"
        :to="languageRoute(lang.value)"
      >
        <q-avatar v-html="lang.iconHTML" size="1.5em" />
      </q-btn>
    </template>
  </div>
</template>

<style>
.language-switcher {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  flex-wrap: nowrap;
  gap: var(--app-ui-space-sm);
}

.language-switcher__btn {
  min-width: 3rem;
  min-height: 3rem;
  border: 1px solid rgba(150, 255, 224, 0.42);
  border-radius: var(--app-ui-border-radius);
  background: transparent;
  color: #d9ffe8;
}

.language-switcher__btn--active {
  border-color: rgba(245, 255, 250, 0.95);
}

.language-switcher__btn .q-avatar {
  border-radius: var(--app-ui-border-radius);
  filter: grayscale(1) contrast(1.1) brightness(1.15);
  opacity: 0.9;
}
</style>

<script setup>
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { getCountryByAlpha2 } from "country-locale-map";
import twemoji from "twemoji";

const i18n = useI18n({ useScope: "global" });
const route = useRoute();
const languageRoute = (lang) => ({
  name: route.params.mapName ? "map" : "index",
  params: {
    lang,
    ...(route.params.mapName ? { mapName: route.params.mapName } : {}),
  },
  query: route.query,
  hash: route.hash,
});
const getLanguageEmoji = (lang) => {
  let country = (lang.includes("-") ? lang.split("-")[1] : lang).toUpperCase();
  let data = getCountryByAlpha2(country);

  return data.emoji;
};
const languageOptions = computed(() => {
  return i18n.availableLocales.map((lang) => {
    const emoji = getLanguageEmoji(lang);
    return {
      value: lang,
      label: i18n.t(`language.${lang}`),
      emoji,
      iconHTML: twemoji.parse(emoji, {
        base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
      }),
    };
  });
});
</script>
