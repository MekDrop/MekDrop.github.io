import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { createMemoryHistory, createRouter } from "vue-router";
import yaml from "yaml";
import routes from "../../../src/router/routes.js";

const routeHelperSource = readFileSync(
  new URL("../../../src/assets/helpers/route.js", import.meta.url),
  "utf8",
)
  .replace('"accepts"', JSON.stringify(import.meta.resolve("accepts")))
  .replace(
    'import hostnameFromCName from "../../../CNAME?raw";',
    'const hostnameFromCName = "example.com";',
  );
const { getCurrentLocaleFromRoute } = await import(
  `data:text/javascript;base64,${Buffer.from(routeHelperSource).toString("base64")}`
);
const locales = ["en-US", "lt"];

it("resolves map URLs without interpreting map as a language", () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });

  for (const prefix of ["", ...locales.map((locale) => `/${locale}`)]) {
    const route = router.resolve(`${prefix}/map/test_hero`);
    assert.equal(route.name, "map");
    assert.equal(route.params.mapName, "test_hero");
    assert.equal(route.params.lang, prefix.slice(1));
  }
});

it("ignores unsupported route locales and preserves supported ones", () => {
  for (const lang of ["map", ...locales]) {
    const route = {
      meta: { autoSwitchLanguage: true },
      params: { lang },
    };
    const ssrContext = {
      req: { headers: { "accept-language": "en-US" } },
    };
    assert.equal(
      getCurrentLocaleFromRoute(route, ssrContext, locales),
      locales.includes(lang) ? lang : "en-US",
    );
  }
});

it("provides the same nonempty translation keys in every supported locale", () => {
  const keys = (messages, prefix = "") => Object.entries(messages).flatMap(
    ([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        return keys(value, path);
      }
      assert.equal(typeof value, "string", path);
      assert.ok(value.trim(), path);

      return [path];
    },
  ).sort();
  const catalogs = locales.map((locale) => yaml.parse(readFileSync(
    new URL(`../../../src/i18n/${locale}.yml`, import.meta.url),
    "utf8",
  )));
  assert.deepEqual(keys(catalogs[0]), keys(catalogs[1]));
});
