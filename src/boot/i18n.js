import { boot } from 'quasar/wrappers'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'
import { watch } from 'vue'
import { Quasar, useMeta } from 'quasar'
import getMetaConfig from 'src/config/meta'
import { getCurrentLocaleFromRoute } from 'src/helpers/route'

export default boot(({ app, router, ssrContext, route }) => {

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
