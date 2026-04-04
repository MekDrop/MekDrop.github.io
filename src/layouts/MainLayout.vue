<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-no-ssr>
        <div class="layout-shell">
          <q-card
            class="side-toolbar no-border text-white"
            flat
            id="side_toolbar"
          >
            <q-card-section class="side-toolbar__section side-toolbar__logo">
              <shader-drop-title />
            </q-card-section>
            <q-separator class="side-toolbar__rule" />
            <q-card-section class="side-toolbar__section side-toolbar__menu">
              <template v-for="item in mainMenu" :key="item.url">
                <q-btn
                  target="_blank"
                  :href="item.url"
                  class="side-toolbar__btn side-toolbar__btn--game"
                  square
                  no-caps
                  flat
                >
                  {{ item.label }}
                </q-btn>
              </template>
              <q-separator class="side-toolbar__rule side-toolbar__section-separator" />
              <div id="other_links_panel" class="side-toolbar__other-links">
                <q-input
                  v-model="otherLinksSearchQuery"
                  dense
                  outlined
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
            <q-separator class="side-toolbar__rule" />
            <q-card-section class="side-toolbar__section side-toolbar__languages">
              <language-switcher id="language_switcher" />
            </q-card-section>
          </q-card>
          <div class="layout-shell__game" id="background">
            <background-canvas />
          </div>
        </div>
      </q-no-ssr>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style>
.layout-shell {
  display: grid;
  grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr);
  gap: clamp(1.25rem, 3vw, 3rem);
  min-height: 100vh;
  width: 100%;
  padding: clamp(1rem, 2vw, 2rem);
  background:
    linear-gradient(rgba(150, 255, 224, 0.08), rgba(150, 255, 224, 0.08))
      0 0 / 100% 1px no-repeat,
    linear-gradient(90deg, rgba(150, 255, 224, 0.08), rgba(150, 255, 224, 0.08))
      0 0 / 1px 100% no-repeat,
    radial-gradient(circle at top, rgba(110, 255, 230, 0.06), transparent 42%),
    #050505;
  box-sizing: border-box;
}

.layout-shell__game {
  position: relative;
  min-width: 0;
  min-height: calc(100vh - (2 * clamp(1rem, 2vw, 2rem)));
  border: 1px solid rgba(150, 255, 224, 0.42);
  overflow: hidden;
}

.layout-shell__game::before,
.layout-shell__game::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 1;
}

.layout-shell__game::before {
  inset: 1rem;
  border: 1px solid rgba(150, 255, 224, 0.22);
}

.layout-shell__game::after {
  left: 1rem;
  right: 1rem;
  top: 3.25rem;
  border-top: 1px solid rgba(150, 255, 224, 0.18);
}

.side-toolbar {
  position: relative;
  z-index: 10;
  width: 100%;
  min-height: calc(100vh - (2 * clamp(1rem, 2vw, 2rem)));
  opacity: 1;
  background: transparent !important;
  border: 1px solid rgba(150, 255, 224, 0.42);
  border-radius: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
  box-shadow: none;
}

.side-toolbar__section {
  padding: 1.3rem 1.35rem;
}

.side-toolbar__logo {
  padding-top: 1.6rem;
  padding-bottom: 1.35rem;
}

.side-toolbar__menu {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.side-toolbar__btn {
  width: 100%;
  min-height: 3rem;
}

.side-toolbar__btn--game {
  border: 1px solid rgba(150, 255, 224, 0.52);
  background: transparent;
  transition:
    color 0.12s ease,
    border-color 0.12s ease,
    letter-spacing 0.12s ease;
}

.side-toolbar__btn--game .q-btn__content {
  justify-content: space-between;
  color: #d9ffe8;
  font-family: "Courier New", monospace;
  font-weight: 700;
  letter-spacing: 0.18em;
  font-size: 0.8rem;
}

.side-toolbar__btn--game:hover {
  border-color: rgba(220, 255, 242, 0.95);
  color: #ffffff;
}

.side-toolbar__btn--game:hover .q-btn__content {
  letter-spacing: 0.22em;
}

.side-toolbar__languages {
  margin-top: auto;
}

.side-toolbar__other-links {
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.side-toolbar__rule {
  background: rgba(150, 255, 224, 0.28);
}

.side-toolbar__section-separator {
  margin: 0.35rem 0 0.55rem;
}

.side-toolbar__other-links-search {
  margin-bottom: 0.75rem;
}

.side-toolbar__other-links-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(150, 255, 224, 0.75) transparent;
}

.side-toolbar__other-links-results::-webkit-scrollbar {
  width: 7px;
}

.side-toolbar__other-links-results::-webkit-scrollbar-track {
  background: transparent;
}

.side-toolbar__other-links-results::-webkit-scrollbar-thumb {
  background: rgba(150, 255, 224, 0.75);
  border-radius: 0;
  border: 0;
}

.side-toolbar__other-links-results::-webkit-scrollbar-thumb:hover {
  background: rgba(220, 255, 242, 0.9);
}

.side-toolbar__other-links-item {
  min-height: 2.1rem;
  padding: 0;
  color: #d9ffe8;
}

.side-toolbar__other-links-loader {
  display: block;
  margin: 1rem auto 0.5rem;
  color: #d9ffe8;
}

.side-toolbar__other-links-search .q-field__control {
  border-radius: 0;
  color: #d9ffe8;
  background: transparent !important;
}

.side-toolbar__other-links-search .q-field__native,
.side-toolbar__other-links-search .q-field__input,
.side-toolbar__other-links-search .q-field__label,
.side-toolbar__other-links-search .q-icon,
.side-toolbar__other-links-search input::placeholder {
  color: rgba(217, 255, 232, 0.78) !important;
  font-family: "Courier New", monospace;
  letter-spacing: 0.14em;
}

.side-toolbar__other-links-search.q-field--focused .q-field__control,
.side-toolbar__other-links-search:hover .q-field__control {
  color: #ffffff;
}

.side-toolbar__other-links-item .q-item__section--side {
  color: rgba(217, 255, 232, 0.72);
  min-width: 1.25rem;
}

.side-toolbar__other-links-item a {
  color: #d9ffe8;
  text-decoration: none;
  letter-spacing: 0.12em;
  font-family: "Courier New", monospace;
}

.side-toolbar__other-links-item a:hover {
  color: #ffffff;
}

.side-toolbar__other-links-results .text-accent {
  color: rgba(217, 255, 232, 0.72) !important;
  letter-spacing: 0.12em;
  font-family: "Courier New", monospace;
}

@media (max-width: 900px) {
  .layout-shell {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 0.85rem;
  }

  .side-toolbar,
  .layout-shell__game {
    min-height: auto;
  }

  .layout-shell__game {
    min-height: 58vh;
  }
}

@media (max-width: 600px) {
  .side-toolbar__section {
    padding: 1rem;
  }

  .side-toolbar__btn--game .q-btn__content {
    font-size: 0.72rem;
    letter-spacing: 0.14em;
  }
}
</style>

<script>
import { useOtherLinksStore } from "stores/other-links-store";
import { storeToRefs } from "pinia";
import BackgroundCanvas from "components/BackgroundCanvas.vue";
import LanguageSwitcher from "components/LanguageSwitcher.vue";
import ShaderDropTitle from "components/ShaderDropTitle.vue";
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
    ShaderDropTitle,
  },
  setup() {
    const otherLinksStore = useOtherLinksStore();
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
