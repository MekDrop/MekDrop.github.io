<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <background-canvas class="absolute-top-left" v-if="isLoaded" />
      <router-view  v-if="isLoaded" />
    </q-page-container>
  </q-layout>
</template>

<script>
import { useBackgroundImageStore } from 'stores/background-image-store'
import { storeToRefs } from 'pinia'
import BackgroundCanvas from 'components/BackgroundCanvas.vue';

export default {
  components: {
    BackgroundCanvas,
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
