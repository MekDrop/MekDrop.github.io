<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-no-ssr>
        <background-canvas class="absolute-top-left background-canvas" v-if="isLoaded" />
        <language-switcher />
      </q-no-ssr>
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
import getMetaConfig from 'src/config/meta'
import { useMeta } from 'quasar'

export default {
  components: {
    BackgroundCanvas,
    LanguageSwitcher,
  },
  methods: {
    updateMeta() {
      const i18n = {
        t: this.$t,
        locale:this.$i18n.locale,
        availableLocales:this.$i18n.availableLocales,
      };

      useMeta(getMetaConfig(
        this.$route,
        i18n,
        this.$router,
        this.ssrContext,
      ));
    },
  },
  mounted() {
    if (!this.ssrContext) {
      const backgroundImageStore = useBackgroundImageStore();
      if (!backgroundImageStore.isLoaded) {
        backgroundImageStore.load();
      }
    }

    this.updateMeta();
  },
  setup() {
    const backgroundImageStore = useBackgroundImageStore();
    const {isLoaded} = storeToRefs(backgroundImageStore);

    return {
      isLoaded,
      reloadBackground: backgroundImageStore.load,
    };
  },
  watch: {
    $route(to) {
      this.updateMeta();
    }
  }
}
</script>
