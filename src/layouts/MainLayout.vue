<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <background-canvas class="absolute-top-left" v-if="isLoaded" />
      <div class="absolute-top-right z-top block q-ma-sm">
        <language-switcher />
      </div>
      <router-view  v-if="isLoaded" />
    </q-page-container>
  </q-layout>
</template>

<script>
import { useBackgroundImageStore } from 'stores/background-image-store'
import { storeToRefs } from 'pinia'
import BackgroundCanvas from 'components/BackgroundCanvas.vue'
import LanguageSwitcher from 'components/LanguageSwitcher.vue'

export default {
  components: {
    BackgroundCanvas,
    LanguageSwitcher,
  },
  preFetch({store}) {
    const backgroundImageStore = useBackgroundImageStore(store);

    return backgroundImageStore.load();
  },
  setup() {
    const backgroundImageStore = useBackgroundImageStore();
    const {isLoaded} = storeToRefs(backgroundImageStore);

    return {
      isLoaded,
    };
  }
}
</script>
