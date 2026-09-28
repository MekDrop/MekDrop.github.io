import { Quasar } from "quasar";

const quasarLanguageLoaders = {
  "en-US": () => import("quasar/lang/en-US.js"),
  lt: () => import("quasar/lang/lt.js"),
};

/**
 *
 * @param {string} language
 * @param {string[]} availableLanguages
 * @param {NonNullable<import("@quasar/app-vite").HasSsrParam["ssrContext"]>|null} ssrContext
 */
export async function updateQuasarLanguage(
  language,
  availableLanguages,
  ssrContext,
) {
  if (!availableLanguages.includes(language)) {
    return;
  }

  const loadLanguage = quasarLanguageLoaders[language];
  if (!loadLanguage) {
    return;
  }

  const module = await loadLanguage();
  Quasar.lang.set(module.default, ssrContext);
}
