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

  return {
    name: "object-data-cache",
    enforce: "pre",
    load: function (id) {
      const path = id.split("?")[0];
      if (!path.startsWith(directory + "/") || !path.endsWith(".json") || path === manifestPath) {
        return;
      }
      if (valid === null) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          valid = manifest.version === 1 && manifest.sources?.length > 0 &&
            sourceStamp(root, manifest.sources) === manifest.sourceStamp;
          this.addWatchFile(manifestPath);
          for (const file of manifest.sources ?? []) {
            this.addWatchFile(resolve(root, file));
          }
        } catch {
          valid = false;
        }
        if (!valid) {
          this.warn("Object data cache is stale; using generators. Run npm run cache:objects to refresh it.");
        }
      }
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
        for (const file of metadata.files ?? []) {
          const module = context.server.moduleGraph.getModuleById(directory + "/" + file);
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
