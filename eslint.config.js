const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

module.exports = [
  {
    ignores: [
      'dist/**',
      'src-capacitor/**',
      'src-cordova/**',
      '.quasar/**',
      'node_modules/**',
      '.eslintrc.js',
      'quasar.config.*.temporary.compiled*',
    ],
  },
  ...compat.config({
    root: true,
    parserOptions: {
      ecmaVersion: 2021,
    },
    env: {
      node: true,
      browser: true,
      'vue/setup-compiler-macros': true,
    },
    extends: ['plugin:vue/vue3-essential', 'prettier'],
    plugins: ['vue'],
    globals: {
      ga: 'readonly',
      cordova: 'readonly',
      __statics: 'readonly',
      __QUASAR_SSR__: 'readonly',
      __QUASAR_SSR_SERVER__: 'readonly',
      __QUASAR_SSR_CLIENT__: 'readonly',
      __QUASAR_SSR_PWA__: 'readonly',
      process: 'readonly',
      Capacitor: 'readonly',
      chrome: 'readonly',
    },
    rules: {
      'prefer-promise-reject-errors': 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'vue/no-v-text-v-html-on-component': 'off',
    },
  }),
]
