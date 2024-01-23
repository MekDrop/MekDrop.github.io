<template>
  <div class="absolute-top-right q-pr-sm q-pt-sm">
  <q-fab
    color="primary"
    direction="left"
  >
    <template v-slot:icon>
      <q-avatar v-html="selectedLanguage.iconHTML" size="1.5em" square />
    </template>
    <template v-for="(lang) in languageOptions" :key="lang.value">
      <q-fab-action external-label label-position="top" color="primary" @click="changeLanguage(lang.value)">
        <template v-slot:default>
          <q-avatar v-html="lang.iconHTML" size="1.5em" square class="q-mr-sm" />
          {{ lang.label }}
        </template>
      </q-fab-action>
    </template>
  </q-fab>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { getCountryByAlpha2 } from 'country-locale-map'
import twemoji from 'twemoji'
import { useQuasar } from 'quasar'

const i18n = useI18n();
const q = useQuasar();
const getLanguageEmoji = (lang) => {
  let country = (lang.includes('-') ? lang.split('-')[1] : lang).toUpperCase();
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
      iconHTML: twemoji.parse(emoji),
    }});
});
const selectedLanguage = computed(() => {
  return languageOptions.value.find(
    (item) => item.value === i18n.locale.value
  );
});
const changeLanguage = (locale) => {
  i18n.locale.value = locale;
};

</script>
