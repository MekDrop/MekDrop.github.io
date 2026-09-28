import { defineStore } from "pinia";
import lunr from "lunr";
import { computed, ref } from "vue";

/**
 * @typedef {{name: string, url: string, icon: string, tags: string[], search_words: string[], handle?: string, translate?: boolean}} OtherLink
 */

/**
 * @typedef {Record<string, OtherLink>} OtherLinkMap
 */

export const useOtherLinksStore = defineStore("other-links", () => {
  const isLoading = ref(false);
  const isLoaded = ref(false);

  const index = ref(null);
  const data = ref({});
  /**
   *
   * @param {import("vue-i18n").Composer} i18n
   */
  const load = async (i18n) => {
    isLoading.value = true;
    isLoaded.value = false;
    data.value = {};

    const { default: getOtherLinks } =
      await import("src/assets/config/other_links.js");
    const otherLinksConfig = getOtherLinks(i18n);
    for (const linkName in otherLinksConfig) {
      const row = Object.assign({ name: linkName }, otherLinksConfig[linkName]);
      if (row.tags) {
        row.tags = row.tags.map(/**
         *
         * @param {string} tag
         */
        (tag) =>
          i18n.te(`tag.${tag}`) ? i18n.t(`tag.${tag}`) : tag,
        );
      }
      row.search_words = (row.name + " " + row.tags.join(" ")).split(" ");
      data.value[row.name] = row;
    }

    data.value = Object.keys(data.value)
      .sort()
      .reduce(/**
       *
       * @param {OtherLinkMap} acc
       * @param {string} key
       */
      (acc, key) => ((acc[key] = data.value[key]), acc), {});

    index.value = lunr(function () {
      this.field("tags");
      this.field("url");
      this.field("search_words", 10);
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

  /**
   *
   * @param {import("vue-i18n").Composer} i18n
   */
  const reload = async (i18n) => {
    unload();
    await load(i18n);
  };

  /**
   *
   * @param {string} term
   */
  const search = (term) => {
    if (!term) {
      return Object.values(data.value);
    }

    const searchTerm = `*${lunr.utils.asString(term)}* ${lunr.utils.asString(term)}~1`;

    const results = index.value.search(searchTerm);
    return results.map(/**
     *
     * @param {import("lunr").Index.Result} result
     */
    (result) => data.value[result.ref]);
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
