import App from '../components/Main.vue';
import '../scss/main.scss';
import { createApp, ref } from 'vue';
import { createI18n, useI18n } from "vue-i18n/index";
import PrimeVue from 'primevue/config';
import {loadTranslations} from "./loader";

const locale = localStorage.locale ? localStorage.locale : navigator.language;

Promise.all([loadTranslations()]).then(
    ([translations]) => {
        const i18n = createI18n({
            legacy: false,
            locale,
            messages: translations,
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
        app.use(PrimeVue, {
            ripple: true,
            inputStyle: 'nofilled',
        });

        const vm = app.mount('#app');
    }
);