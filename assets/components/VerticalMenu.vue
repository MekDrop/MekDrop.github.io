<template>
    <div class="vertical-menu">
        <a :href="menuItem.url" :target="menuItem.external ? '_blank' : '_self'"
           class="vertical-menu-item p-d-flex p-mb-1 p-ai-center" v-for="menuItem in mainMenuItems">>
            <Image :alt="t(menuItem.name)" :src="menuItem.image.src" class="p-mr-2 p-mb-1 p-mt-2" heigth="100"
                   width="100"></Image>
            <div class="info">
                <h3 class="p-mt-0">{{ t(menuItem.name) }}</h3>
                <div>{{ t(menuItem.description) }}</div>
            </div>
        </a>
    </div>
</template>

<script>

    import {useI18n} from "vue-i18n/index";
    import Image from 'primevue/image';
    import {loadData} from "../js/loader";

    export default {
        components: {
            Image
        },
        setup() {
            const {t} = useI18n();
            return {t};
        },
        data: () => {
            return {
                mainMenuItems: [],
            };
        },
        async mounted() {
            this.mainMenuItems = (await loadData('main_menu')).default.items;
        }
    }
</script>