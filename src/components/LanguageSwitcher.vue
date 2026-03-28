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
        square
        unelevated
        :title="lang.label"
        :aria-label="lang.label"
        :to="{ name: 'index', params: { lang: lang.value } }"
      >
        <q-avatar v-html="lang.iconHTML" size="1.5em" square />
      </q-btn>
    </template>
  </div>
</template>

<style>
.language-switcher {
  display: flex;
  flex-direction: row;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 0.5rem;
}

.language-switcher__btn {
  min-width: 2.35rem;
  border: 1px solid rgba(135, 235, 255, 0.35);
  background: rgba(15, 20, 30, 0.9);
}

.language-switcher__btn--active {
  border-color: rgba(135, 235, 255, 0.95);
  box-shadow: 0 0 12px rgba(135, 235, 255, 0.45);
}
</style>

<script setup>
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { getCountryByAlpha2 } from "country-locale-map";
import twemoji from "twemoji";

const i18n = useI18n({ useScope: "global" });
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
