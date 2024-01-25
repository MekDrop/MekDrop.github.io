<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container  >
      <background-canvas class="absolute-top-left background-canvas" v-if="isLoaded" />
      <language-switcher />
      <router-view  v-if="isLoaded" />
    </q-page-container>
  </q-layout>
</template>

<style>
.background-canvas {
  position: fixed;
}
</style>

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
  methods: {
    onClick() {
      alert('ddd');
    }
  },
  preFetch({store}) {
    const backgroundImageStore = useBackgroundImageStore(store);

    return backgroundImageStore.isLoaded ? null : backgroundImageStore.load();
  },
  setup() {
    const backgroundImageStore = useBackgroundImageStore();
    const {isLoaded} = storeToRefs(backgroundImageStore);

    return {
      isLoaded,
      reloadBackground: backgroundImageStore.load,
    };
  }
}
</script>
