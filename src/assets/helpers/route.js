export function getRouteUrl(to, router, ssrContext = null) {
  let url = router.resolve(to).href;
  if (url.startsWith('/')) {
    url = url.substring(1);
  }

  if (ssrContext) {
    url = '//' + ssrContext.req.headers.host + '/' + url;
  } else {
    url = window.location.origin + '/' + url;
  }
  return url;
}

export function getCurrentLocaleFromRoute(to) {
  return to.meta.autoSwitchLanguage ? to.params.lang : 'en-US'
}
