const { createHash } = require("node:crypto");
const { readFileSync, statSync } = require("node:fs");
const { relative, resolve } = require("node:path");

/**
 * Give development game binaries immutable URLs while preserving live edits.
 * Production assets already receive Vite content hashes.
 * @param {string} root
 * @returns {import("vite").Plugin}
 */
module.exports = (root) => {
  const known = new Map();
  const types = {
    glb: "model/gltf-binary",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    ogg: "audio/ogg",
    wav: "audio/wav",
  };
  /**
   * @param {string} filename
   */
  const asset = (filename) => {
    const local = relative(root, filename).replaceAll("\\", "/");
    const extension = local.split(".").pop();
    if (!/^(src\/game\/|src\/assets\/game\/)/.test(local) || !types[extension]) {
      return null;
    }
    const stats = statSync(filename);
    const stamp = `${stats.mtimeMs}:${stats.ctimeMs}:${stats.size}`;
    let value = known.get(local);
    if (value?.stamp !== stamp) {
      const bytes = readFileSync(filename);
      value = {
        stamp,
        size: stats.size,
        type: types[extension],
        hash: createHash("sha256").update(bytes).digest("hex").slice(0, 20),
      };
      known.set(local, value);
    }
    return {
      ...value,
      local,
    };
  };

  return {
    name: "game-asset-browser-cache",
    apply: "serve",
    enforce: "pre",
    load: function (id) {
      if (/[?&]raw(?:&|$)/.test(id)) {
        return;
      }
      const value = asset(id.split("?")[0]);
      if (value) {
        return `export default ${JSON.stringify(`/${value.local}?gameAsset=${value.hash}`)};`;
      }
    },
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const hash = url.searchParams.get("gameAsset");
        if (!hash || !["GET", "HEAD"].includes(req.method)) {
          return next();
        }
        try {
          const filename = resolve(root, "." + decodeURIComponent(url.pathname));
          const value = asset(filename);
          if (!value) {
            return next();
          }
          if (value.hash !== hash) {
            res.statusCode = 410;
            res.setHeader("Cache-Control", "no-store");
            res.end();

            return;
          }
          res.setHeader("Content-Type", value.type);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          const etag = `"${value.hash}"`;
          res.setHeader("ETag", etag);
          if (req.headers?.["if-none-match"] === etag) {
            res.statusCode = 304;
            res.end();

            return;
          }
          res.setHeader("Content-Length", value.size);
          res.end(req.method === "HEAD" ? undefined : readFileSync(filename));
        } catch {
          next();
        }
      });
    },
  };
};
