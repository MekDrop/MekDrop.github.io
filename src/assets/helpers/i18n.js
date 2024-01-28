import { Quasar } from 'quasar'

export async function updateQuasarLanguage (language, availableLanguages, ssrContext) {
  let module;
  if (availableLanguages.includes(language)) {
    module = await import(`../../../node_modules/quasar/lang/${language}.mjs`);
    Quasar.lang.set(module.default, ssrContext);
  }
};
