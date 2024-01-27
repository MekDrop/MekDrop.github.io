import { boot } from 'quasar/wrappers'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'
import { watch } from 'vue'
import { Quasar } from 'quasar'
import { getCurrentLocaleFromRoute } from 'src/assets/helpers/route'

export default boot(({ app, router, ssrContext }) => {

  const i18n = createI18n({
    locale: getCurrentLocaleFromRoute(router.currentRoute.value),
    fallbackLocale: 'en-US',
    legacy: false,
    globalInjection: true,
    allowComposition: true,
    messages
  });

  watch(i18n.global.locale, async (language) => {
    if (!language) {
      return;
    }

    const module = await import(`../../node_modules/quasar/lang/${language}.mjs`);
    Quasar.lang.set(module.default, ssrContext);
  });

  router.beforeEach((to) => {
    i18n.global.locale.value = getCurrentLocaleFromRoute(to);
  });

  app.use(i18n)
})
