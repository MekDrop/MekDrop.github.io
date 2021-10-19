<template #main>
    <div class="p-grid">
        <div class="p-md-8 p-md-offset-2 p-sm-12 p-sm-offset-0 mk_base">
            <div class="p-d-flex p-jc-between">
                <h1>
                    <OwnGravatar /> MekDrop
                </h1>
                <div class="p-as-center">
                    <LanguageSwitcher></LanguageSwitcher>
                </div>
            </div>
            <Divider></Divider>

            <div class="p-grid">
                <div class="p-col-12 p-sm-12 p-md-6">
                    <VerticalMenu></VerticalMenu>
                </div>
                <div class="p-col-12 p-sm-12 p-md-6">
                    <div class="p-d-flex p-jc-between">
                        <h2>{{ t('misc.other_places') }}</h2>
                        <div class="p-field mk-sm-hidden">
                            <div class="p-float-label">
                                <AutoComplete :dropdown="true" id="links_filter" type="text" v-model="filter"
                                              :suggestions="filterSuggestions" @complete="searchFilterValue($event)"/>
                                <label for="links_filter">{{ t('form.filter') }}</label>
                            </div>
                        </div>
                    </div>
                    <span class="p-buttonset">
                        <form v-for="link in links" class="link" :action="link.url" method="get" target="_blank">
                            <Button :icon="link.icon"
                                    type="submit"
                                    class="p-button-info p-button-sm"
                                    :label="link.translate ? t(link.name) : link.name"
                            />
                        </form>
                    </span>
                </div>
            </div>

        </div>
    </div>
</template>

<script>
    import Button from 'primevue/button';
    import Tooltip from 'primevue/tooltip';
    import AutoComplete from 'primevue/autocomplete';
    import LanguageSwitcher from './LanguageSwitcher';
    import VerticalMenu from './VerticalMenu';
    import {useI18n} from "vue-i18n/index";
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import { defineAsyncComponent } from 'vue';
    import { loadData } from "../js/loader";

    export default {
        components: {
            Button,
            AutoComplete,
            LanguageSwitcher,
            VerticalMenu,
            Divider,
            Tag,
            OwnGravatar: defineAsyncComponent(
                () => import('./OwnGravatar')
            )
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