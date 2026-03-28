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
            <div
              id="other_links_panel"
              class="side-toolbar__other-links side-toolbar__btn--game"
            >
              <div class="side-toolbar__other-links-title">
                {{ i18n.t("main_menu.other_links.name") }}
              </div>
              <q-input
                v-model="otherLinksSearchQuery"
                dark
                dense
                filled
                flat
                square
                clearable
                :placeholder="i18n.t('form.filter')"
                name="search"
                type="search"
                class="full-width side-toolbar__other-links-search"
              />
              <div
                class="side-toolbar__other-links-results extra_links_modal__search-results"
                :class="{
                  'extra_links_modal__search-results--non-empty':
                    otherLinksSearchResults.length > 0,
                  'extra_links_modal__search-results--empty':
                    otherLinksSearchResults.length === 0,
                }"
                v-if="!isOtherLinksLoading"
              >
                <q-list v-if="otherLinksSearchResults.length > 0" dense>
                  <q-item
                    v-for="(result, index) in otherLinksSearchResults"
                    :key="index"
                    dense
                    class="side-toolbar__other-links-item"
                  >
                    <q-item-section side>
                      <q-icon :name="result.icon" size="1em" color="white" />
                    </q-item-section>
                    <q-item-section>
                      <a
                        :href="result.url"
                        target="_blank"
                        rel="external"
                        class="text-white"
                      >
                        {{ result.name }}
                      </a>
                    </q-item-section>
                  </q-item>
                </q-list>
                <div class="text-accent" v-else>
                  {{ i18n.t("form.no_found") }}
                </div>
              </div>
              <q-spinner-dots
                class="side-toolbar__other-links-loader"
                size="md"
                v-else
              />
            </div>
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
  overflow: hidden;
  min-height: 0;
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

.side-toolbar__other-links {
  padding: 0.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.side-toolbar__other-links-title {
  font-family: "Courier New", monospace;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
  color: #dffcf6;
}

.side-toolbar__other-links-search {
  margin-bottom: 0.5rem;
}

.side-toolbar__other-links-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(104, 255, 222, 0.85) rgba(9, 16, 23, 0.85);
}

.side-toolbar__other-links-results::-webkit-scrollbar {
  width: 10px;
}

.side-toolbar__other-links-results::-webkit-scrollbar-track {
  background: linear-gradient(
    180deg,
    rgba(9, 16, 23, 0.85),
    rgba(18, 30, 42, 0.85)
  );
  border-radius: 999px;
}

.side-toolbar__other-links-results::-webkit-scrollbar-thumb {
  background: linear-gradient(
    180deg,
    rgba(91, 255, 227, 0.9),
    rgba(40, 187, 230, 0.95)
  );
  border-radius: 999px;
  border: 2px solid rgba(9, 16, 23, 0.9);
}

.side-toolbar__other-links-results::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    rgba(134, 255, 235, 0.98),
    rgba(63, 205, 245, 0.98)
  );
}

.side-toolbar__other-links-item {
  min-height: 1.8rem;
}

.side-toolbar__other-links-loader {
  display: block;
  margin: 0.75rem auto 0.5rem;
}
</style>

<script>
import { useBackgroundImageStore } from "stores/background-image-store";
import { useOtherLinksStore } from "stores/other-links-store";
import { storeToRefs } from "pinia";
import BackgroundCanvas from "components/BackgroundCanvas.vue";
import LanguageSwitcher from "components/LanguageSwitcher.vue";
import getMetaConfig from "src/assets/config/meta";
import getMainMenu from "src/assets/config/main_menu";
import { useMeta } from "quasar";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { computed, ref, useSSRContext, watch } from "vue";

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
    const { isLoading: isOtherLinksLoading } = storeToRefs(otherLinksStore);
    const i18n = useI18n();
    const route = useRoute();
    const router = useRouter();
    const otherLinksSearchQuery = ref("");
    const ssrContext =
      typeof window === "undefined" ? useSSRContext() : undefined;

    const updateMeta = () => {
      useMeta(getMetaConfig(route, i18n, router, ssrContext));
    };

    const mainMenu = computed(() => {
      return getMainMenu(i18n).filter((item) => !!item);
    });

    const otherLinksSearchResults = computed(() => {
      if (!otherLinksStore.isLoaded || otherLinksStore.isLoading) {
        return [];
      }

      return otherLinksStore.search(otherLinksSearchQuery.value);
    });

    watch(i18n.locale, () => {
      otherLinksStore.reload(i18n);
    });

    if (!otherLinksStore.isLoaded && !otherLinksStore.isLoading) {
      otherLinksStore.load(i18n);
    }

    updateMeta();

    return {
      isLoaded,
      isOtherLinksLoading,
      i18n,
      mainMenu,
      otherLinksSearchQuery,
      otherLinksSearchResults,
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
