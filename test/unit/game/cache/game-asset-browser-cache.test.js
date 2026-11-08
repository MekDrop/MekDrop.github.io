import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import plugin from "../../../../scripts/game-assets/vite-plugin.cjs";

test("binary URLs are immutable, refreshed edits get new hashes, and old URLs cannot cache changed bytes", () => {
  const root = mkdtempSync(resolve("tmp/asset-cache-"));
  try {
    const folder = join(root, "src/game/models");
    mkdirSync(folder, { recursive: true });
    const filename = join(folder, "sample.glb");
    writeFileSync(filename, "original model");
    const instance = plugin(root);
    const url = JSON.parse(instance.load(filename + "?url").slice("export default ".length, -1));
    let middleware;
    instance.configureServer({
      middlewares: {
        use: (callback) => {
          middleware = callback;
        },
      },
    });
    const request = (url, method = "GET", headers = {}) => {
      const response = {
        headers: {},
        setHeader: (name, value) => {
          response.headers[name] = value;
        },
        end: (bytes) => {
          response.bytes = bytes;
        },
      };
      middleware({
        url,
        method,
        headers,
      }, response, () => {
        response.next = true;
      });

      return response;
    };
    const response = request(url);
    assert.equal(response.bytes.toString(), "original model");
    assert.match(response.headers["Cache-Control"], /max-age=31536000, immutable/);
    assert.equal(response.headers["Content-Type"], "model/gltf-binary");
    const revalidated = request(url, "GET", { "if-none-match": response.headers.ETag });
    assert.equal(revalidated.statusCode, 304);
    assert.equal(revalidated.bytes, undefined);
    assert.equal(request(url, "HEAD").bytes, undefined);
    assert.equal(request("/src/game/models/sample.glb").next, true);
    writeFileSync(filename, "changed model data");
    assert.notEqual(instance.load(filename + "?url"), `export default ${JSON.stringify(url)};`);
    assert.equal(request(url).statusCode, 410);
    assert.equal(request(url).headers["Cache-Control"], "no-store");
    assert.equal(instance.load(join(root, "src/game/example.js")), undefined);
    assert.equal(instance.load(join(root, "src/assets/game/wasm/glslang/glslang.wasm") + "?url"), undefined,
      "shader script/WASM pairs keep matching colocated URLs");
  } finally {
    assert.equal(root.startsWith(resolve("tmp") + "\\"), true);
    rmSync(root, {
      recursive: true,
      force: true,
    });
  }
});
