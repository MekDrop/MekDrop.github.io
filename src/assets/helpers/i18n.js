import { Quasar } from "quasar";

const quasarLanguageLoaders = {
  "en-US": () => import("quasar/lang/en-US"),
  lt: () => import("quasar/lang/lt"),
};

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
