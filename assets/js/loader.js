export function loadData(dataName) {
    return import(/* webpackChunkName: "data/[request]" */`../../data/${dataName}.yml`);
};

export const SUPPORTED_LOCALES = require.context('yaml-loader!../../translations/', false, /\.yml$/)
    .keys()
    .map(
        e => e.substr(2).replace(/([^\.]+)\.([a-z]+)/, '$1')
    )
;

export async function loadTranslations() {

    let lang = {};
    for(let i = 0; i < SUPPORTED_LOCALES.length; i++) {
        let locale = SUPPORTED_LOCALES[i];
        lang[locale] = await import(/* webpackChunkName: "translation/[request]" */`../../translations/${locale}.yml`);
    }

    return lang;
}