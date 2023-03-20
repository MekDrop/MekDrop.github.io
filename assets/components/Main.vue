<template #main>
    <div class="p-grid">
        <div class="p-md-8 p-md-offset-2 p-sm-12 p-sm-offset-0 mk_base">
            <header class="p-d-flex p-jc-between">
                <div class="p-d-inline-flex p-ai-center">
                    <OwnGravatar/>
                    <h1 class="mk_no_selectable">MekDrop <span style="opacity: 0.2;">[Raimondas Rimkevičius]</span></h1>
                </div>
                <div class="p-as-center">
                    <LanguageSwitcher></LanguageSwitcher>
                </div>
            </header>

            <div class="p-grid">
                <div class="p-col-12 p-sm-12 p-md-6">
                    <VerticalMenu></VerticalMenu>
                </div>
                <div class="p-col-12 p-sm-12 p-md-6 p-mt-2">
                    <div class="p-d-flex p-jc-between p-ai-end">
                        <h2>{{ t('misc.other_places') }}</h2>
                        <div class="p-field mk-sm-hidden p-mr-2">
                            <div class="p-float-label">
                                <AutoComplete :dropdown="true"
                                              :suggestions="filterSuggestions"
                                              @complete="searchFilterValue($event)"
                                              id="links_filter"
                                              type="text"
                                              v-model="filter"
                                />
                                <label for="links_filter">{{ t('form.filter') }}</label>
                            </div>
                        </div>
                    </div>
                    <div class="p-d-flex p-ai-center p-flex-wrap">
                        <a :href="link.url" class="p-mr-2 p-mb-2" target="_blank" v-for="link in links">
                            <Chip :icon="link.icon" :label="link.translate ? t(link.name) : link.name"/>
                        </a>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<script>
    import AutoComplete from 'primevue/autocomplete';
    import LanguageSwitcher from './LanguageSwitcher';
    import VerticalMenu from './VerticalMenu';
    import {useI18n} from "vue-i18n/index";
    import {defineAsyncComponent} from 'vue';
    import {loadData} from "../js/loader";
    import Chip from 'primevue/chip';

    export default {
        components: {
            Chip,
            AutoComplete,
            LanguageSwitcher,
            VerticalMenu,
            OwnGravatar: defineAsyncComponent(
                () => import('./OwnGravatar')
            )
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
                        for (let i = 0; i < item._search_data.length; i++) {
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
                let items = (await loadData('links')).default;
                let ret = [];
                for (let x in items) {
                    let item = items[x];
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
