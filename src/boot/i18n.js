import { boot } from 'quasar/wrappers'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'
import { watch } from 'vue'
import { Quasar } from 'quasar'

export default boot(({ app }) => {
  const i18n = createI18n({
    locale: 'en-US',
    globalInjection: true,
    messages
  });

  watch(i18n.global.locale, async (language) => {
    const module = await import(`../../node_modules/quasar/lang/${language}.mjs`);
    Quasar.lang.set(module.default);
  });

  i18n.global.locale.value = Quasar.lang.getLocale();

  app.use(i18n)
})
