<template>
  <q-page class="flex flex-center">
    <q-card class="no-border" flat dark>
      <q-card-section>
        <div class="text-h1 non-selectable first-line">{{ mainConfig.header.first_line }}</div>
        <div class="text-h5 text-justify second-line">{{ mainConfig.header.second_line }}</div>
      </q-card-section>
      <q-card-actions class="actions">
        <q-btn v-for="(item) in mainMenu" :key="item.url" target="_blank" :href="item.url" class="bg-dark" outline square no-caps color="white">
          {{ item.label }}
        </q-btn>
        <q-btn outline square color="secondary">
          ...
        </q-btn>
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
    transition: all 0.3s ease;

    @media (max-width: 412px) {
      transform: scale(0.95);
    }
    @media (max-width: 385px) {
      transform: scale(0.90);
    }
    @media (max-width: 364px) {
      transform: scale(0.80);
    }
    @media (max-width: 329px) {
      transform: scale(0.70);
    }
    @media (max-width: 290px) {
      transform: scale(0.60);
    }
    @media (max-width: 248px) {
      transform: scale(0.50);
    }
  }
</style>

<script setup>
import mainConfig from 'src/config/main'
import getMainMenu from 'src/config/main_menu'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const i18n = useI18n();
const mainMenu = computed(() => {
  return getMainMenu(i18n).filter(
    (item) => !!item
  );
});

</script>
