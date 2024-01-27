export default function (i18n) {
  return [
    i18n.locale.value === 'lt' ? {
      url: 'https://blog.mekdrop.name',
      label: i18n.t('main_menu.blog.name'),
    } : null,
    {
      url: 'https://stories.mekdrop.name',
      label: i18n.t('main_menu.stories.name'),
    }
  ];
}
