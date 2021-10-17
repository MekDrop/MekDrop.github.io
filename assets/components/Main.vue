<template #main>
    <h1>MekDrop.Name</h1>
    <span class="p-float-label">
        <LanguageSwitcher></LanguageSwitcher>
    </span>

    <div class="p-grid p-p-3">
        <div class="p-col">
            <VerticalMenu></VerticalMenu>
        </div>
        <div class="p-col">
            <div class="p-grid">
                <div class="p-col-6">
                    <h2>{{ t('misc.other_places') }}</h2>
                </div>
                <div class="p-col-6">
                    <span class="p-float-label">
                        <AutoComplete :dropdown="true" id="links_filter" type="text" v-model="filter"
                                      :suggestions="filterSuggestions" @complete="searchFilterValue($event)"/>
                        <label for="links_filter">{{ t('form.filter') }}</label>
                    </span>
                </div>
            </div>
            <form v-for="link in links" class="link" :action="link.url" method="get" target="_blank">
                <Button v-tooltip="link.translate ? t(link.name) : link.name" :icon="link.icon" type="submit"
                        class="p-button-link p-button-raised p-button-rounded"/>
            </form>
        </div>
    </div>
</template>

<script>
    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import Tooltip from 'primevue/tooltip';
    import AutoComplete from 'primevue/autocomplete';
    import LanguageSwitcher from './LanguageSwitcher';
    import VerticalMenu from './VerticalMenu';
    import {useI18n} from "vue-i18n/index";

    export default {
        components: {
            Card,
            Button,
            AutoComplete,
            LanguageSwitcher,
            VerticalMenu
        },
        directives: {
            'tooltip': Tooltip
        },
        setup() {
            const {t, locale} = useI18n();
            return {t, locale};
        },
        data: () => {
            return {
                filter: null,
                filterSuggestions: [],
                linkItems: [],
            };
        },
        computed: {
            allFilterSuggestions() {
                var suggestions = [];
                this.linkItems.forEach(
                    linkItem => linkItem._search_data.forEach(
                        (search_data_item) => {
                            if (!suggestions.includes(search_data_item)) {
                                suggestions.push(search_data_item);
                            }
                        }
                    )
                )

                suggestions.sort();
                return suggestions;
            },
            links() {
                if (!this.filter) {
                    return this.linkItems;
                }
                let filter = this.filter.toLowerCase();
                return this.linkItems.filter(
                    (item) => {
                        for(let i = 0; i < item._search_data.length; i++) {
                            if (item._search_data[i].toString().toLowerCase().includes(filter)) {
                                return true;
                            }
                        }
                        return false;
                    }
                );
            }
        },
        async mounted() {
            this.linkItems = await this.getLinkItems();
        },
        methods: {
            searchFilterValue(event) {
                this.filterSuggestions = this.allFilterSuggestions.filter(
                    (text) => text.toLowerCase().includes(event.query.toLowerCase())
                );
            },
            async getLinkItems() {
                let items = await import('../../data/links.yml');
                let ret = [];
                for (let x in items.default) {
                    let item = items.default[x];
                    if (typeof item.name === 'undefined') {
                        item.name = x;
                    }
                    item._search_data = [
                        item.translate ? this.t(item.name) : item.name
                    ];
                    item.tags.forEach(
                        tag => item._search_data.push(
                            this.t('tag.' + tag)
                        )
                    );
                    ret.push(item);
                }

                return ret;
            }
        },
        watch: {
            async locale(oldLocale, newLocale) {
                this.linkItems = await this.getLinkItems();
            }
        }
    };
</script>