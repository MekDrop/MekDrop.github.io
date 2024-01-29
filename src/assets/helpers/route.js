import accepts from 'accepts'
import hostnameFromCName from '../../../CNAME?raw'

export function getRouteUrl(to, router, ssrContext = null) {
  let url = router.resolve(to).href;
  if (url.startsWith("/")) {
    url = url.substring(1);
  }

  if (ssrContext) {
    const protocol = ssrContext.req.protocol || 'https';
    const host = ssrContext.req.headers.host || hostnameFromCName.trim();

    url = `${protocol}://${host}/${url}`;
  } else {
    url = window.location.origin + "/" + url;
  }
  return url;
}

export function getCurrentLocaleFromRoute(to, ssrContext, availableLanguages) {
  if (to.meta.autoSwitchLanguage && to.params.lang) {
    return to.params.lang;
  }

  if (ssrContext) {
    const accept = accepts(ssrContext.req);
    const languages = accept.languages();

    for (let i = 0; i < languages.length; i++) {
      if (availableLanguages.includes(languages[i])) {
        return languages[i];
      }
    }
  } else if (
    typeof navigator !== "undefined" &&
    availableLanguages.includes(navigator.language)
  ) {
    return navigator.language;
  }

  return "en-US";
}
