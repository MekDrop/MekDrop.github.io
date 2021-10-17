<template>
    <Card v-for="menuItem in mainMenuItems">
        <template #header>
            <img alt="user header" :src="menuItem.image">
        </template>
        <template #title>
            <a :href="menuItem.url" :target="menuItem.external ? '_blank' : '_self'">{{ t(menuItem.name) }}</a>
        </template>
        <template #content>
            <div>{{ t(menuItem.description) }}</div>
        </template>
    </Card>
</template>

<script>

import MainMenuItems from "../../data/main_menu.yml";
import Card from "primevue/card";
import Tooltip from "primevue/tooltip";
import { useI18n } from "vue-i18n/index";

export default {
    components: {
        Card,
    },
    directives: {
        'tooltip': Tooltip
    },
    setup() {
        const { t } = useI18n();
        return { t };
    },
    data: () => {
        return {
            mainMenuItems: MainMenuItems.items,
        };
    },
}
</script>