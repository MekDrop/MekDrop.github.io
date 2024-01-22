<template>
  <q-page class="flex flex-center">
    <q-card class="no-border" flat dark>
      <q-card-section>
        <div class="text-h1 non-selectable first-line">{{ mainConfig.header.first_line }}</div>
        <div class="text-h5 text-justify second-line">{{ mainConfig.header.second_line }}</div>
      </q-card-section>
      <q-card-actions class="actions">
        <q-btn href="https://blog.mekdrop.name" flat square no-caps color="accent" v-for="(item) in mainMenu" :key="item.url">
          {{ item.label }}
        </q-btn>
        <q-btn outline square color="secondary">
          ...
        </q-btn>
        <language-switcher />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<style lang="scss">
  .second-line {
    text-align-last: left;
  }
  .first-line {
    font-family: 'Itim', cursive;
  }
  .actions {
    justify-content: space-between;
  }
  .q-card {
    opacity: 0.9;
    border-radius: 0;
  }
</style>

<script setup>
import mainConfig from 'src/config/main';
import LanguageSwitcher from 'components/LanguageSwitcher.vue'
import getMainMenu from 'src/config/main_menu';
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const i18n = useI18n();
const mainMenu = computed(() => {
  return getMainMenu(i18n).filter(
    (item) => !!item
  );
});

</script>
