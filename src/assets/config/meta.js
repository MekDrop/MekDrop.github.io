import { getRouteUrl } from 'src/assets/helpers/route'
import { unref } from 'vue'

export default function (route, i18n, router, ssrContext) {
  let ret = [];

  switch (route.name) {
    case "index":
      const fullUrl = getRouteUrl({
        name: route.name,
        params: {
          lang: unref(i18n.locale),
        }
      }, router,ssrContext);

      ret = {
        link: {
          preconnect_1: {
            rel: 'preconnect',
            href: 'https://fonts.googleapis.com',
          },
          preconnect_2: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossOrigin: true,
          },
          itim_font: {
            href: 'https://fonts.googleapis.com/css2?family=Itim&display=swap',
            rel: 'stylesheet'
          },
          canonical: {
            href: fullUrl,
            rel: 'canonical',
          },
      },
        title: i18n.t('meta.title'),
        meta: {
          title: {
            name: 'title',
            content: i18n.t('meta.title'),
          },
          description: {
            name: 'description',
            content: i18n.t('meta.description'),
          },
          og_type: {
            property: "og:type",
            content: "website",
          },
          og_url: {
            property: "og:url",
            content: fullUrl,
          },
          og_title: {
            property: 'og:title',
            content: i18n.t('meta.title'),
          },
          og_description: {
            property: 'og:description',
            content: i18n.t('meta.description'),
          },
          og_image: {
            property: 'og:image',
            content: '',
          },
          twitter_card: {
            property: "twitter:card",
            content: "summary_large_image",
          },
          twitter_url: {
            property: "twitter:url",
            content: fullUrl,
          },
          twitter_title: {
            property: 'twitter:title',
            content: i18n.t('meta.title'),
          },
          twitter_description: {
            property: 'twitter:description',
            content: i18n.t('meta.description'),
          },
          twitter_image: {
            property: 'og:image',
            content: '',
          },
        },
      };

      for(let i = 0; i < i18n.availableLocales.length; i++) {
        const langKey = 'alternative_' + i18n.availableLocales[i].toLowerCase().replace('-','_');

        ret.link[langKey] = (i18n.locale.value === i18n.availableLocales[i]) ? {} : {
          rel: 'alternate',
          hreflang: i18n.availableLocales[i],
          href: getRouteUrl({
            name: route.name,
            params: {
              lang: i18n.availableLocales[i]
            }
          }, router,ssrContext)
        };
      }
    break;
  }

  return ret;
};
