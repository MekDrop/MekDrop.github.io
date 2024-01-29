import { defineStore } from "pinia";
import lunr from "lunr";
import { computed, ref } from "vue";

export const useOtherLinksStore = defineStore("other-links", () => {
  const isLoading = ref(false);
  const isLoaded = ref(false);

  const index = ref(null);
  const data = ref({});
  const load = async (i18n) => {
    isLoading.value = true;
    isLoaded.value = false;
    data.value = {};

    const { default: getOtherLinks } = await import(
      "src/assets/config/other_links.js"
    );
    const otherLinksConfig = getOtherLinks(i18n);
    for (const linkName in otherLinksConfig) {
      const row = Object.assign({ name: linkName }, otherLinksConfig[linkName]);
      data.value[row.name] = row;
    }
    data.value = Object.keys(data.value)
      .sort()
      .reduce((acc, key) => ((acc[key] = data.value[key]), acc), {});

    index.value = lunr(function () {
      this.field("tags");
      this.field("url");
      this.ref("name");

      for (const linkName in data.value) {
        this.add(data.value[linkName]);
      }
    });

    isLoaded.value = true;
    isLoading.value = false;
  };

  const unload = () => {
    isLoaded.value = false;
    isLoading.value = false;
    index.value = null;
    data.value = {};
  };

  const reload = async (i18n) => {
    unload();
    await load(i18n);
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
    unload,
    reload,
    search,
    isLoading: computed(() => isLoading.value),
    isLoaded: computed(() => isLoaded.value),
  };
});
