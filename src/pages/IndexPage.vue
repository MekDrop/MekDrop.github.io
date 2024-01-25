<template>
  <q-page class="flex flex-center">
    <q-card class="no-border" flat dark ref="main_card">
      <q-card-section>
        <div class="text-h1 non-selectable first-line" @dblclick="reloadBackground">{{ mainConfig.header.first_line }}</div>
        <div class="text-h5 non-selectable text-justify second-line">{{ mainConfig.header.second_line }}</div>
      </q-card-section>
      <q-card-actions class="actions">
        <template v-for="(item) in mainMenu" :key="item.url">
          <q-btn target="_blank" :href="item.url" color="white" class="bg-dark" :class="extraButtonClasses" outline square no-caps>
            {{ item.label }}
          </q-btn>
        </template>
        <q-btn outline square color="white" class="bg-dark" :class="extraButtonClasses" @click="onOtherLinksClicked">
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
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { animateCSS } from 'src/helpers/animate'
import OtherLinksModal from 'components/OtherLinksModal.vue'
import { useOtherLinksStore } from 'stores/other-links-store'
import { useBackgroundImageStore } from 'stores/background-image-store'

const i18n = useI18n();
const q = useQuasar();
const otherLinksStore = useOtherLinksStore();
const main_card = ref(null);
const mainMenu = computed(() => {
  return getMainMenu(i18n).filter(
    (item) => !!item
  );
});

const extraButtonClasses = computed(() => {
  return {
    'full-width q-mb-sm': q.screen.lt.sm,
  };
});

const onOtherLinksClicked = () => {
  q.dialog({
    component: OtherLinksModal,
    progress: true,
  });
};

const reloadBackground = () => {
  const backgroundImageStore = useBackgroundImageStore();
  backgroundImageStore.load();
};

watch(i18n.locale,() => {
  otherLinksStore.unload();
  animateCSS(main_card.value.$el, 'flipInX');
});

</script>
