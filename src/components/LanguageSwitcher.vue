<template>
  <q-select
    v-model="selectedLanguage"
    :options="languageOptions"
    option-value="value"
    emit-value
    map-options
    filled
    dark
    square
    dense
  >
    <template v-slot:option="props">
      <q-item  v-bind="props.itemProps" dense>
        <q-item-section class="text-white text-no-wrap no-wrap block">
          <q-avatar v-html="twemoji.parse(props.opt.emoji)" size="1.5em" square class="q-mr-sm" />
          {{ props.opt.label }}
        </q-item-section>
      </q-item>
    </template>
    <template v-slot:selected-item="props">
      <q-item dense v-bind="props.itemProps">
        <q-item-section>
          <q-avatar v-html="twemoji.parse(props.opt.emoji)" size="1.5em" square />
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
import { getCountryByAlpha2 } from 'country-locale-map';
import twemoji from 'twemoji';
import { useQuasar } from 'quasar'

const i18n = useI18n();
const q = useQuasar();
const selectedLanguage = ref(i18n.locale.value);
const getLanguageEmoji = (lang) => {
  let country = (lang.includes('-') ? lang.split('-')[1] : lang).toUpperCase();
  let data = getCountryByAlpha2(country);

  return data.emoji;
};
const languageOptions = computed(() => {
  return i18n.availableLocales.map((lang) => ({
    value: lang,
    label: i18n.t(`language.${lang}`),
    emoji: getLanguageEmoji(lang),
  }));
});

watch(selectedLanguage, (language) => {
  i18n.locale.value = language;
});

</script>
