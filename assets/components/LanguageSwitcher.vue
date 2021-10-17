<template>
    <Dropdown v-model="locale" :options="availableLocales" :filter="false" :showClear="false" >
        <template #value="slotProps">
            <span :class="'flag-icon flag-icon-' + getLangName(slotProps.value)"></span>
            {{t('language.' + slotProps.value)}}
        </template>
        <template #option="slotProps">
            <span :class="'flag-icon flag-icon-' + getLangName(slotProps.option)"></span>
            {{t('language.' + slotProps.option)}}
        </template>
    </Dropdown>
</template>

<script>
    import Dropdown from 'primevue/dropdown';
    import { useI18n } from "vue-i18n/index";

    export default {
        components: {
            Dropdown,
        },
        setup() {
            const { t, availableLocales, locale } = useI18n();
            return { t, availableLocales, locale };
        },
        methods: {
            getLangName(langStr) {
                if (!langStr) {
                    return 'en';
                }
                return langStr.split('-')[1].toLowerCase();
            },
        },
        watch: {
            locale(newLocale, oldLocale) {
                localStorage.locale = newLocale;
            }
        }
    };
</script>