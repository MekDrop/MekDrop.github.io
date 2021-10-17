import App from '../components/Main.vue';
import '../scss/main.scss';
import { createApp, ref } from 'vue';
import { createI18n, useI18n } from "vue-i18n/index";
import translationsMessages from './translations-loader';

const i18n = createI18n({
    legacy: false,
    locale: localStorage.locale ? localStorage.locale : (
        (typeof translationsMessages[navigator.language]) ? navigator.language : 'en-US'
    ),
    messages: translationsMessages,
    fallbackLocale: 'en-US',
});

const app = createApp({
    setup() {
        const { t } = useI18n()
        const count = ref(0)
        return { count, t }
    }
});
app.component('app', App);
app.use(i18n);

const vm = app.mount('#app');

app.config.globalProperties.$primevue = {
    ripple: true
};