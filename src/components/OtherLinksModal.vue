<template>
  <q-dialog
    v-model="show"
    square
    class="other-links-modal"
    :class="{ 'full-width': $q.screen.lt.sm }"
    id="extra_links_modal"
  >
    <q-card dark>
      <q-card-section class="row items-center">
        <q-input
          autofocus
          dark
          dense
          filled
          flat
          square
          v-model="searchQuery"
          :placeholder="$t('form.filter')"
          clearable
          class="full-width extra_links_modal__search_field"
          name="search"
          type="search"
        />
      </q-card-section>

      <q-scroll-area class="other-links-modal__scroll-area" dark>
        <q-card-section
          class="scroll q-pt-none extra_links_modal__search-results"
          :class="{
            'extra_links_modal__search-results--non-empty':
              searchResults.length > 0,
            'extra_links_modal__search-results--empty':
              searchResults.length === 0,
          }"
          v-if="!otherLinksStore.isLoading"
        >
          <q-list v-if="searchResults.length > 0">
            <q-item
              v-for="(result, index) in searchResults"
              :key="index"
              dense
              dark
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
            {{ $t("form.no_found") }}
          </div>
        </q-card-section>
        <q-spinner-dots
          class="absolute-center extra_links_modal__loader"
          size="md"
          v-else
        />
      </q-scroll-area>

      <q-card-actions align="right" class="other-links-modal__actions">
        <q-btn dark square :label="$t('form.close')" outline @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss">
.q-dialog:not(.full-width) .q-card {
  width: 500px;
  max-width: 80vw;
}

.q-dialog.full-width .q-card {
  width: 98vw !important;
}

.other-links-modal__scroll-area {
  max-height: 98vh;
  height: 200px;
  margin-right: 1em;

  @media (max-height: 440px) {
    min-height: 50px;
    height: calc(100vh - 250px);
  }
}

.other-links-modal__actions {
  margin-top: auto;
  @media (max-height: 308px) {
    display: none;
  }
}

.other-links-modal .q-dialog__inner {
  padding: 1em;
  min-height: 200px;
}
</style>

<script setup>
import { computed, ref } from "vue";
import { useOtherLinksStore } from "stores/other-links-store";
import { useI18n } from "vue-i18n";

const otherLinksStore = useOtherLinksStore();
const show = ref(false);
const searchQuery = ref("");
const i18n = useI18n();
const close = () => {
  show.value = false;
};

const searchResults = computed(() => {
  return otherLinksStore.search(searchQuery.value);
});

if (!otherLinksStore.isLoaded && !otherLinksStore.isLoading) {
  otherLinksStore.load(i18n);
}
</script>
