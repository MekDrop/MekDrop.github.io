const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { sourceStamp } = require("./source-stamp.cjs");

/**
 * Validate build inputs once per build; no Node APIs enter the SPA bundle.
 * @param {string} root
 * @returns {import("vite").Plugin}
 */
module.exports = (root) => {
  const directory = resolve(root, "src/game/cache/generated").replaceAll("\\", "/");
  const manifestPath = directory + "/manifest.json";
  let valid = null;
  let manifest = null;

  /**
   * @param {import("rollup").PluginContext} context
   */
  const validate = (context) => {
    if (valid === null) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        valid = manifest.version === 1 && manifest.sources?.length > 0 &&
            sourceStamp(root, manifest.sources) === manifest.sourceStamp;
        context.addWatchFile(manifestPath);
        for (const file of manifest.sources ?? []) {
          context.addWatchFile(resolve(root, file));
        }
      } catch {
        valid = false;
      }
      if (!valid) {
        context.warn("Object data cache is stale; using generators. Run npm run cache:objects to refresh it.");
      }
    }
  };
  const loaderPath = resolve(root, "src/game/cache/ObjectCacheFiles.js").replaceAll("\\", "/");

  return {
    name: "object-data-cache",
    enforce: "pre",
    transform: function (_code, id) {
      if (id.split("?")[0] !== loaderPath) {
        return;
      }
      validate(this);
      if (!valid) {
        return {
          code: "export default {}; export const lazyEntries = {};",
          map: null,
        };
      }
      if (!_code.includes("export const lazyEntries = {};")) {
        return;
      }
      const entries = {};
      for (const file of manifest.files) {
        if (!/^(castle-plans|compiled-maps)\//.test(file)) {
          continue;
        }
        let shard;
        try {
          shard = JSON.parse(readFileSync(resolve(directory, file), "utf8"));
        } catch {
          // An optional missing/corrupt part must fall back to generation.
          continue;
        }
        const keys = new Set([
          ...Object.entries(shard.entries ?? {}).flatMap(([family, records]) =>
            Object.keys(records).map(key => `${family}/${key}`)),
          ...(shard.fragments ?? []).map(({ family, key }) => `${family}/${key}`),
        ]);
        for (const key of keys) {
          (entries[key] ??= []).push(`./generated/${file}`);
        }
      }

      return {
        code: _code.replace("export const lazyEntries = {};", `export const lazyEntries = ${JSON.stringify(entries)};`),
        map: null,
      };
    },
    load: function (id) {
      const path = id.split("?")[0];
      if (!path.startsWith(directory + "/") || !path.endsWith(".json") || path === manifestPath) {
        return;
      }
      validate(this);
      let shard = null;
      if (valid && manifest.files.includes(path.slice(directory.length + 1))) {
        try {
          shard = JSON.parse(readFileSync(path, "utf8"));
        } catch {
          shard = null;
        }
      }
      return JSON.stringify(shard ?? {
        version: 1,
        entries: {},
      });
    },
    handleHotUpdate: function (context) {
      if (!existsSync(manifestPath)) {
        return;
      }
      const metadata = JSON.parse(readFileSync(manifestPath, "utf8"));
      const changed = context.file.replaceAll("\\", "/");
      const isSource = (file) => resolve(root, file).replaceAll("\\", "/") === changed;
      if (changed === manifestPath || (metadata.sources ?? []).some(isSource)) {
        valid = null;
        const modules = [...context.modules];
        for (const file of ["../ObjectCacheFiles.js", ...(metadata.files ?? [])]) {
          const module = context.server.moduleGraph.getModuleById(resolve(directory, file).replaceAll("\\", "/"));
          if (module) {
            context.server.moduleGraph.invalidateModule(module);
            modules.push(module);
          }
        }

        return modules;
      }
    },
  };
};
