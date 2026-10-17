import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";

export const sources = new Set();

registerHooks({
  resolve: (specifier, context, next) => {
    if (/\.(glb|png|jpg|webp)\?url$/.test(specifier)) {
      return {
        url: new URL(specifier, context.parentURL).href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
  load: (url, context, next) => {
    if (url.startsWith("file:")) {
      const path = fileURLToPath(new URL(url));
      const local = relative(process.cwd(), path).replaceAll("\\", "/");
      if (local.startsWith("src/") && !local.startsWith("src/game/cache/generated/")) {
        sources.add(local);
      }
      if (url.endsWith("?url")) {
        return {
          format: "module",
          source: `export default ${JSON.stringify(path)};`,
          shortCircuit: true,
        };
      }
      if (/\.(vert|frag)$/.test(url)) {
        return {
          format: "module",
          source: `export default ${JSON.stringify(readFileSync(path, "utf8"))};`,
          shortCircuit: true,
        };
      }
    }
    return next(url, context);
  },
});
