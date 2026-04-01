const globals = require("globals");
const prettier = require("eslint-config-prettier/flat");
const vue = require("eslint-plugin-vue");

module.exports = [
  {
    ignores: [
      "dist/**",
      "src-capacitor/**",
      "src-cordova/**",
      ".quasar/**",
      "node_modules/**",
      ".eslintrc.js",
      ".eslintrc.cjs",
      "quasar.config.*.temporary.compiled*",
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ga: "readonly",
        cordova: "readonly",
        __statics: "readonly",
        __QUASAR_SSR__: "readonly",
        __QUASAR_SSR_SERVER__: "readonly",
        __QUASAR_SSR_CLIENT__: "readonly",
        __QUASAR_SSR_PWA__: "readonly",
        process: "readonly",
        Capacitor: "readonly",
        chrome: "readonly",
      },
    },
    plugins: {
      vue,
    },
    rules: {
      "prefer-promise-reject-errors": "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    },
  },
  ...vue.configs["flat/essential"],
  prettier,
  {
    rules: {
      "vue/no-v-text-v-html-on-component": "off",
    },
  },
];
