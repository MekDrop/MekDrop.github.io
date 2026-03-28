<template>
  <div class="language-switcher">
    <template v-for="lang in languageOptions" :key="lang.value">
      <q-btn
        :data-locale="lang.value"
        class="language-switcher__btn"
        :color="lang.value === i18n.locale.value ? 'primary' : 'white'"
        text-color="white"
        :outline="lang.value !== i18n.locale.value"
        square
        no-caps
        align="left"
        :to="{ name: 'index', params: { lang: lang.value } }"
      >
        <q-avatar v-html="lang.iconHTML" size="1.5em" square class="q-mr-sm" />
        {{ lang.label }}
      </q-btn>
    </template>
  </div>
</template>

<style>
.language-switcher {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.language-switcher__btn {
  width: 100%;
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
