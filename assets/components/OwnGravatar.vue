<template>
    <Avatar :image="url" shape="square"></Avatar>
</template>

<script>
    import Avatar from 'primevue/avatar';
    import {md5} from 'hash-wasm';
    import {loadData} from "../js/loader";

    const GRAVATAR_BASE_URL = 'https://www.gravatar.com/avatar/';

    export default {
        components: {
            Avatar,
        },
        data() {
            return {
                url: GRAVATAR_BASE_URL,
            }
        },
        async mounted() {
            let linksData = await loadData('links');
            let email = linksData.email.handle.toString();
            let hash = await md5(email);
            this.url = GRAVATAR_BASE_URL + hash;
        }
    };
</script>