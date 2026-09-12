const routes = [
  {
    path: "/:lang?",
    component: () => import("layouts/MainLayout.vue"),
    meta: {
      autoSwitchLanguage: true,
    },
    children: [
      {
        path: "",
        component: () => import("pages/IndexPage.vue"),
        name: "index",
      },
      {
        path: "map/:mapName",
        component: () => import("pages/IndexPage.vue"),
        name: "map",
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  /*{
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }*/
];

export default routes;
