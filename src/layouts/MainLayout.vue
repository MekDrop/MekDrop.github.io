<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-no-ssr>
        <background-canvas
          class="absolute-top-left background-canvas"
          v-if="isLoaded"
          id="background"
        />
        <q-card
          class="side-toolbar no-border bg-dark text-white"
          flat
          dark
          id="side_toolbar"
        >
          <q-card-section class="side-toolbar__section">
            <language-switcher id="language_switcher" direction="right" />
          </q-card-section>
          <q-separator dark />
          <q-card-section class="side-toolbar__section side-toolbar__menu">
            <template v-for="item in mainMenu" :key="item.url">
              <q-btn
                target="_blank"
                :href="item.url"
                color="white"
                class="bg-dark side-toolbar__btn"
                outline
                square
                no-caps
              >
                {{ item.label }}
              </q-btn>
            </template>
            <q-btn
              id="other_links_button"
              outline
              square
              color="white"
              class="bg-dark side-toolbar__btn"
              @click="onOtherLinksClicked"
            >
              ...
            </q-btn>
          </q-card-section>
        </q-card>
      </q-no-ssr>
      <router-view v-if="isLoaded" />
    </q-page-container>
  </q-layout>
</template>

<style>
.background-canvas {
  position: fixed;
}

.side-toolbar {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 100;
  width: min(220px, calc(100vw - 2rem));
  opacity: 0.9;
  border-radius: 0;
}

.side-toolbar__section {
  padding: 0.75rem;
}

.side-toolbar__menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.side-toolbar__btn {
  width: 100%;
}

@media (max-width: 600px) {
  .side-toolbar {
    top: auto;
    bottom: 1rem;
  }
}
</style>

<script>
import { useBackgroundImageStore } from "stores/background-image-store";
import { useOtherLinksStore } from "stores/other-links-store";
import { storeToRefs } from "pinia";
import BackgroundCanvas from "components/BackgroundCanvas.vue";
import LanguageSwitcher from "components/LanguageSwitcher.vue";
import OtherLinksModal from "components/OtherLinksModal.vue";
import getMetaConfig from "src/assets/config/meta";
import getMainMenu from "src/assets/config/main_menu";
import { useMeta } from "quasar";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { computed, useSSRContext, watch } from "vue";

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
    const otherLinksStore = useOtherLinksStore();
    const { isLoaded } = storeToRefs(backgroundImageStore);
    const q = useQuasar();
    const i18n = useI18n();
    const route = useRoute();
    const router = useRouter();
    const ssrContext =
      typeof window === "undefined" ? useSSRContext() : undefined;

    const updateMeta = () => {
      useMeta(getMetaConfig(route, i18n, router, ssrContext));
    };

    const mainMenu = computed(() => {
      return getMainMenu(i18n).filter((item) => !!item);
    });

    const onOtherLinksClicked = () => {
      q.dialog({
        component: OtherLinksModal,
        progress: true,
      });
    };

    watch(i18n.locale, () => {
      otherLinksStore.unload();
    });

    updateMeta();

    return {
      isLoaded,
      mainMenu,
      onOtherLinksClicked,
      updateMeta,
    };
  },
  watch: {
    $route() {
      this.updateMeta();
    },
  },
};
</script>
