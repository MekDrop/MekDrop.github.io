module.exports = {
  // https://eslint.org/docs/user-guide/configuring#configuration-cascading-and-hierarchy
  // This option interrupts the configuration hierarchy at this file
  // Remove this if you have an higher level ESLint config file (it usually happens into a monorepos)
  root: true,

  parserOptions: {
    ecmaVersion: 2021, // Allows for the parsing of modern ECMAScript features
  },

  env: {
    node: true,
    browser: true,
    'vue/setup-compiler-macros': true
  },

  // Rules order is important, please avoid shuffling them
  extends: [
    // Base ESLint recommended rules
    // 'eslint:recommended',

    // Uncomment any of the lines below to choose desired strictness,
    // but leave only one uncommented!
    // See https://eslint.vuejs.org/rules/#available-rules
    'plugin:vue/vue3-essential', // Priority A: Essential (Error Prevention)
    // 'plugin:vue/vue3-strongly-recommended', // Priority B: Strongly Recommended (Improving Readability)
    // 'plugin:vue/vue3-recommended', // Priority C: Recommended (Minimizing Arbitrary Choices and Cognitive Overhead)

    // https://github.com/prettier/eslint-config-prettier#installation
    // usage with Prettier, provided by 'eslint-config-prettier'.
    'prettier'
  ],

  plugins: [
    // https://eslint.vuejs.org/user-guide/#why-doesn-t-it-work-on-vue-files
    // required to lint *.vue files
    'vue',

    // https://github.com/typescript-eslint/typescript-eslint/issues/389#issuecomment-509292674
    // Prettier has not been included as plugin to avoid performance impact
    // add it as an extension for your IDE

  ],

  globals: {
    ga: 'readonly', // Google Analytics
    cordova: 'readonly',
    __statics: 'readonly',
    __QUASAR_SSR__: 'readonly',
    __QUASAR_SSR_SERVER__: 'readonly',
    __QUASAR_SSR_CLIENT__: 'readonly',
    __QUASAR_SSR_PWA__: 'readonly',
    process: 'readonly',
    Capacitor: 'readonly',
    chrome: 'readonly'
  },

  // add your custom rules here
  rules: {
    'prefer-promise-reject-errors': 'off',
    curly: 'error',

    'no-restricted-syntax': [
      'error',
      {
        selector: "MethodDefinition[key.type='Identifier'][kind='method'][key.name=/^set[A-Z][A-Za-z0-9]*Visible$/][value.params.length=1]",
        message:
          'Use ES6 setter syntax (`set value(...)`) for one-argument property-style mutators like setVisible/setEntranceVisible.',
      },
      {
        selector: "MethodDefinition[key.type='Identifier'][kind='method'][key.name=/^get[A-Z][A-Za-z0-9]*Visible$/][value.params.length=0]",
        message:
          'Use ES6 getter syntax (`get value()`) for zero-argument read-only accessors.',
      },
      {
        selector: 'NewExpression[callee.name="Error"]',
        message:
          'Use a named custom Error subclass with a predefined message or message template.',
      },
    ],

    // allow debugger during development only
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

    'vue/no-v-text-v-html-on-component': 'off',
  }
}
