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
          <q-card-section class="side-toolbar__section side-toolbar__logo">
            <img
              class="side-toolbar__logo-image"
              src="/icons/android-chrome-192x192.png"
              alt="MekDrop logo"
            />
            <div class="side-toolbar__logo-text">MekDrop</div>
          </q-card-section>
          <q-separator dark />
          <q-card-section class="side-toolbar__section side-toolbar__menu">
            <template v-for="item in mainMenu" :key="item.url">
              <q-btn
                target="_blank"
                :href="item.url"
                class="side-toolbar__btn side-toolbar__btn--game"
                square
                no-caps
              >
                {{ item.label }}
              </q-btn>
            </template>
            <q-btn
              id="other_links_button"
              square
              class="side-toolbar__btn side-toolbar__btn--game"
              @click="onOtherLinksClicked"
            >
              {{ i18n.t("main_menu.other_links.name") }}
            </q-btn>
          </q-card-section>
          <q-separator dark />
          <q-card-section class="side-toolbar__section side-toolbar__languages">
            <language-switcher id="language_switcher" />
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
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  width: min(240px, 100vw);
  opacity: 0.9;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
}

.side-toolbar__section {
  padding: 0.75rem;
}

.side-toolbar__logo {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.side-toolbar__logo-image {
  width: 64px;
  height: 64px;
  display: block;
}

.side-toolbar__logo-text {
  font-size: 1.15rem;
}

.side-toolbar__menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  overflow-y: auto;
}

.side-toolbar__btn {
  width: 100%;
}

.side-toolbar__btn--game {
  border: 1px solid rgba(104, 255, 222, 0.65);
  background: linear-gradient(
    135deg,
    rgba(22, 46, 52, 0.95),
    rgba(10, 16, 25, 0.95)
  );
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 0 14px rgba(20, 212, 184, 0.2);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    border-color 0.12s ease;
}

.side-toolbar__btn--game .q-btn__content {
  justify-content: flex-start;
  color: #dffcf6;
  font-family: "Courier New", monospace;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.side-toolbar__btn--game:hover {
  border-color: rgba(104, 255, 222, 1);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    0 0 18px rgba(20, 212, 184, 0.42);
  transform: translateX(2px);
}

.side-toolbar__languages {
  margin-top: auto;
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
      i18n,
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
