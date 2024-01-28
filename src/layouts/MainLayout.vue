<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-no-ssr>
        <background-canvas
          class="absolute-top-left background-canvas"
          v-if="isLoaded"
          id="background"
        />
        <language-switcher id="language_switcher" />
      </q-no-ssr>
      <router-view v-if="isLoaded" />
    </q-page-container>
  </q-layout>
</template>

<style>
.background-canvas {
  position: fixed;
}
</style>

<script>
import { useBackgroundImageStore } from "stores/background-image-store";
import { storeToRefs } from "pinia";
import BackgroundCanvas from "components/BackgroundCanvas.vue";
import LanguageSwitcher from "components/LanguageSwitcher.vue";
import getMetaConfig from "src/assets/config/meta";
import { useMeta } from "quasar";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useSSRContext } from "vue";

export default {
  components: {
    BackgroundCanvas,
    LanguageSwitcher,
  },
  mounted() {
    if (!this.ssrContext) {
      const backgroundImageStore = useBackgroundImageStore();
      if (!backgroundImageStore.isLoaded) {
        backgroundImageStore.load();
      }
    }
  },
  setup() {
    const backgroundImageStore = useBackgroundImageStore();
    const { isLoaded } = storeToRefs(backgroundImageStore);
    const i18n = useI18n();
    const route = useRoute();
    const router = useRouter();
    const ssrContext =
      typeof window === "undefined" ? useSSRContext() : undefined;

    const updateMeta = () => {
      useMeta(getMetaConfig(route, i18n, router, ssrContext));
    };

    updateMeta();

    return {
      isLoaded,
      updateMeta,
      reloadBackground: backgroundImageStore.load,
    };
  },
  watch: {
    $route() {
      this.updateMeta();
    },
  },
};
</script>
