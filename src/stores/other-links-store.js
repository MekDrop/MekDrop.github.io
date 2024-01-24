import { defineStore } from 'pinia'
import lunr from 'lunr'
import { computed, ref } from 'vue'
import otherLinksConfig from 'src/config/other_links.yml'

export const useOtherLinksStore = defineStore('other-links', () => {

  const isLoading = ref(false);
  const isLoaded = ref(false);

  const index = ref(null);
  const data = ref({});
  const load = async () => {
    isLoading.value = true;
    data.value = {};
    for (const linkName in otherLinksConfig) {
      const row = Object.assign({name: linkName}, otherLinksConfig[linkName]);
      data.value[row.name] = row;
    }
    data.value = Object.keys(data.value).sort().reduce((acc, key) => (acc[key] = data.value[key], acc), {});

    index.value = lunr(function () {
      this.field('tags');
      this.field('url');
      this.ref('name');

      for (const linkName in data.value) {
        this.add(data.value[linkName]);
      }
    });

    isLoaded.value = true;
    isLoading.value = false;
  };

  const search = (term) => {
    if (!term) {
      return Object.values(data.value);
    }

    const results = index.value.search(`*${term}*`);
    return results.map((result) => data.value[result.ref]);
  };

  return {
    index,
    load,
    search,
    isLoading: computed(() => isLoading.value),
    isLoaded: computed(() => isLoaded.value),
  };
});
