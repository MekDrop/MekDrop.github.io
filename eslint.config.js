const globals = require("globals");
const prettier = require("eslint-config-prettier/flat");
const vue = require("eslint-plugin-vue");

const baseRestrictedSyntax = [
  {
    selector:
      "MethodDefinition[key.type='Identifier'][kind='method'][key.name=/^set[A-Z][A-Za-z0-9]*Visible$/][value.params.length=1]",
    message:
      "Use ES6 setter syntax (`set value(...)`) for one-argument property-style mutators like setVisible/setEntranceVisible.",
  },
  {
    selector:
      "MethodDefinition[key.type='Identifier'][kind='method'][key.name=/^get[A-Z][A-Za-z0-9]*Visible$/][value.params.length=0]",
    message:
      "Use ES6 getter syntax (`get value()`) for zero-argument read-only accessors.",
  },
  {
    selector: "NewExpression[callee.name='Error']",
    message:
      "Use a named custom Error subclass with a predefined message or message template.",
  },
];

// An enum is an exported SCREAMING_SNAKE_CASE `Object.freeze({...})` whose
// values are all primitive literals. Enums live one-per-file under
// `src/game/enum/` (game code) or `src/enum/` (everything else).
const enumDeclarationSelector =
  "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator" +
  "[id.name=/^[A-Z][A-Z0-9_]*$/]" +
  "[init.type='CallExpression']" +
  "[init.callee.object.name='Object']" +
  "[init.callee.property.name='freeze']" +
  "[init.arguments.0.type='ObjectExpression']" +
  ":not(:has(Property[value.type!='Literal']))";

module.exports = [
  {
    ignores: [
      "dist/**",
      "src-capacitor/**",
      "src-cordova/**",
      ".quasar/**",
      "node_modules/**",
      "public/game/wasm/**",
      ".eslintrc.js",
      ".eslintrc.cjs",
      "quasar.config.*.temporary.compiled*",
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
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
      curly: "error",
      "no-restricted-syntax": [
        "error",
        ...baseRestrictedSyntax,
        {
          selector: enumDeclarationSelector,
          message:
            "Enums must live one-per-file under src/game/enum/ (game code) or src/enum/ (non-game code).",
        },
      ],
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    },
  },
  {
    files: ["src/enum/**/*.js", "src/game/enum/**/*.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...baseRestrictedSyntax,
        {
          selector: "Program > :not(ExportNamedDeclaration)",
          message:
            "Enum files must contain nothing but the single enum export.",
        },
        {
          selector: "ExportNamedDeclaration ~ ExportNamedDeclaration",
          message: "Define exactly one enum per file.",
        },
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.callee.object.name='Object'][init.callee.property.name='freeze'])",
          message:
            "Enum exports must be frozen objects: `export const NAME = Object.freeze({...})`.",
        },
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([id.name=/^[A-Z][A-Z0-9_]*$/])",
          message: "Enum exports must use SCREAMING_SNAKE_CASE names.",
        },
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration Property[value.type!='Literal']",
          message: "Enum values must be primitive literals.",
        },
      ],
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
