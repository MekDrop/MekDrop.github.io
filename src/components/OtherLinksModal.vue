<template>
  <q-dialog v-model="show" square :class="{'full-width': $q.screen.lt.sm}">
    <q-card dark>
      <q-card-section class="row items-center">
        <q-input autofocus dark dense filled flat square v-model="searchQuery" :placeholder="$t('form.filter')" clearable class="full-width" />
      </q-card-section>

      <q-card-section class="scroll q-pt-none" style="max-height: 98vh; height: 200px; margin-right: 1em;">
        <q-list v-if="searchResults.length > 0">
          <q-item v-for="(result, index) in searchResults" :key="index" dense dark>
            <q-item-section side>
              <q-icon :name="result.icon" size="1em" color="white" />
            </q-item-section>
            <q-item-section>
              <a :href="result.url" target="_blank" rel="nofollow" class="text-white">
                {{ result.name }}
              </a>
            </q-item-section>
          </q-item>
        </q-list>
        <div class="text-accent" v-else>
          {{ $t('form.no_found') }}
        </div>
      </q-card-section>

      <q-card-actions align="right" style="margin-top: auto;">
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
  width: 98vw!important;
}
</style>

<script setup>
import { computed, ref } from 'vue'
import { useOtherLinksStore } from 'stores/other-links-store'
import { useI18n } from 'vue-i18n'

const otherLinksStore = useOtherLinksStore();
const show = ref(false);
const searchQuery = ref('');
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
