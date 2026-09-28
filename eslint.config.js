const globals = require("globals");
const prettier = require("eslint-config-prettier/flat");
const jsdoc = require("eslint-plugin-jsdoc");
const vue = require("eslint-plugin-vue");

const oversizedSourceFileExemptions = [
  "src/game/generator/map/MapGenerator.js",
  "src/game/objects/hero/Hero.js",
  "src/game/PlayCanvasRenderer.js",
  "src/game/objects/treasure/BuriedTreasureField.js",
  "src/game/ui/InventoryHud.js",
  "src/game/objects/shared/AmmoClothPhysics.js",
  "src/game/generator/castle/CastleGeometryPlanner.js",
];

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

const functionsWithParameters = [
  "FunctionDeclaration[params.length>0]",
  "FunctionExpression[params.length>0]",
  "ArrowFunctionExpression[params.length>0]",
];

const typedClassProperties = [
  "PropertyDefinition",
];

const typedGetters = [
  "MethodDefinition[kind='get']:not(:has(FunctionExpression > BlockStatement[body.length=1] > ReturnStatement > MemberExpression[computed=false][object.type='ThisExpression']))",
];

const typedApiContexts = [
  ...functionsWithParameters,
  ...typedClassProperties,
  ...typedGetters,
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
      "tmp/**",
      "src/assets/game/wasm/**",
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
      jsdoc,
      vue,
    },
    rules: {
      "prefer-promise-reject-errors": "off",
      curly: "error",
      "jsdoc/multiline-blocks": [
        "error",
        {
          noSingleLineBlocks: true,
          singleLineTags: [],
        },
      ],
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
  {
    files: ["src/**/*.{js,vue}"],
    settings: {
      jsdoc: {
        preferredTypes: {
          "*": {
            message: "Use a concrete named, imported, or structural type.",
            replacement: false,
          },
          any: {
            message: "Use a concrete named, imported, or structural type.",
            replacement: false,
          },
          Function: {
            message: "Document the callable signature instead of Function.",
            replacement: false,
          },
          Object: {
            message: "Use a concrete named, imported, or structural type.",
            replacement: false,
          },
          object: {
            message: "Use a concrete named, imported, or structural type.",
            replacement: false,
          },
        },
      },
    },
    rules: {
      "jsdoc/check-types": [
        "error",
        {
          exemptTagContexts: [
            {
              tag: "typedef",
              types: ["object"],
            },
          ],
        },
      ],
      "jsdoc/require-jsdoc": [
        "error",
        {
          checkGetters: false,
          checkSetters: false,
          contexts: typedApiContexts,
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: false,
            ClassExpression: false,
            FunctionDeclaration: false,
            FunctionExpression: false,
            MethodDefinition: false,
          },
        },
      ],
      "jsdoc/no-blank-blocks": [
        "error",
        {
          enableFixer: true,
        },
      ],
      "jsdoc/require-param": [
        "error",
        {
          contexts: functionsWithParameters,
          unnamedRootBase: ["options", "config"],
        },
      ],
      "jsdoc/require-param-type": [
        "error",
        {
          contexts: functionsWithParameters,
        },
      ],
      "jsdoc/require-tags": [
        "error",
        {
          tags: [
            ...typedClassProperties.map((context) => ({
              context,
              tag: "type",
            })),
            ...typedGetters.map((context) => ({
              context,
              tag: "returns",
            })),
          ],
        },
      ],
      "jsdoc/require-returns-type": [
        "error",
        {
          contexts: typedGetters,
        },
      ],
    },
  },
  {
    files: ["src/**/*.{js,vue}"],
    rules: {
      "max-lines": [
        "warn",
        {
          max: 1000,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    files: oversizedSourceFileExemptions,
    rules: {
      "max-lines": "off",
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
