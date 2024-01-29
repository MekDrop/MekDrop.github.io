import { boot } from "quasar/wrappers";
import { createI18n } from "vue-i18n";
import messages from "src/i18n";
import { getCurrentLocaleFromRoute } from "src/assets/helpers/route";
import { updateQuasarLanguage } from "assets/helpers/i18n";

export default boot(async ({ app, router, ssrContext }) => {
  const availableLanguages = Object.keys(messages);
  const locale = getCurrentLocaleFromRoute(
    router.currentRoute.value,
    ssrContext,
    availableLanguages
  );

  const i18n = createI18n({
    locale,
    fallbackLocale: "en-US",
    legacy: false,
    globalInjection: true,
    allowComposition: true,
    messages,
  });

  await updateQuasarLanguage(locale, availableLanguages, ssrContext);

  router.beforeEach((to) => {
    i18n.global.locale.value = getCurrentLocaleFromRoute(
      to,
      ssrContext,
      availableLanguages
    );
    updateQuasarLanguage(
      i18n.global.locale.value,
      availableLanguages,
      ssrContext
    );
  });

  app.use(i18n);
});
