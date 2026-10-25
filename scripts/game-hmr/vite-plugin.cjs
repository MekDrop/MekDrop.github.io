const { readdirSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

/**
 * Generate literal Vite accept lists from the existing registry and test maps.
 * No parallel object manifest or development code enters production bundles.
 * @param {string} root
 * @returns {import("vite").Plugin}
 */
module.exports = (root) => {
  const game = resolve(root, "src/game").replaceAll("\\", "/");
  const hotImport = '\nimport { GameHotReload } from "/src/game/development/GameHotReload.js";\n';

  return {
    name: "game-selective-hmr",
    apply: "serve",
    enforce: "pre",
    transform: function (code, id) {
      if (id.startsWith(game + "/objects/") && code.includes("extends AbstractCastleProp")) {
        const tree = this.parse(code);
        const visualClasses = [];
        for (const statement of tree.body) {
          const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (declaration?.type !== "ClassDeclaration" || declaration.superClass?.name !== "AbstractCastleProp") {
            continue;
          }
          const visualMembers = new Set(["modelUrl", "modelUrls", "hasAuthoredCollision", "omittedModelNodes"]);
          const onlyStaticMembers = declaration.body.body.every(member => member.static &&
            member.type === "MethodDefinition" && visualMembers.has(member.key.name));
          if (onlyStaticMembers) {
            visualClasses.push(declaration.id.name);
          }
        }
        if (visualClasses.length) {
          return code + visualClasses.map(name => `\nObject.defineProperty(${name}, "developmentVisualOnly", { value: true });`).join("");
        }
      }
      if (id === game + "/objects/MapObjectFactory.js") {
        const registered = new Set([...code.matchAll(/\[\w+\.name, (\w+)\]/g)].map(match => match[1]));
        registered.add("VoxelVegetation");
        const imports = [...code.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*"([^"]+)"/g)]
          .filter(match => registered.has(match[1]))
          .map(match => match[2]);
        const enemies = readdirSync(resolve(game, "objects/enemies"), { withFileTypes: true })
          .filter(entry => entry.isDirectory() && existsSync(resolve(game, "objects/enemies", entry.name, "index.js")))
          .map(entry => `./enemies/${entry.name}/index.js`);
        const dependencies = [...imports, ...enemies];

        return code + hotImport + `
if (import.meta.hot) {
  import.meta.hot.accept(${JSON.stringify(dependencies)}, (modules) => {
    const names = new Set();
    for (const module of modules) {
      if (!module) continue;
      let installed = false;
      for (const Class of Object.values(module ?? {})) {
        if (typeof Class !== "function") continue;
        for (const [name, Previous] of OBJECT_CLASSES) {
          if (Previous.name === Class.name) {
            OBJECT_CLASSES.set(name, Class);
            names.add(name);
            installed = true;
          }
        }
      }
      if (!installed) {
        import.meta.hot.invalidate("A registered object export changed; reload its owners.");
        return;
      }
    }
    GameHotReload.publish({ objects: [...names] });
  });
}
`;
      }
      if (id === game + "/ui/index.js") {
        const names = ["CoinHud", "HeroLifeHud", "HeroMoodHud", "GameStatusHud", "MapTestControlsHud"];
        const paths = names.map(name => `./${name}.js`);
        for (const [index, name] of names.entries()) {
          code = code.replace(`export { ${name} } from "${paths[index]}";`,
            `import { ${name} as Initial${name} } from "${paths[index]}";\nexport let ${name} = Initial${name};`);
        }
        const replacements = names.map((name, index) =>
          `if (modules[${index}]?.${name}) { ${name} = modules[${index}].${name}; huds.push(${name}); }`).join("\n");

        return code + hotImport + `
if (import.meta.hot) {
  import.meta.hot.accept(${JSON.stringify(paths)}, (modules) => {
    const huds = [];
    ${replacements}
    GameHotReload.publish({ huds });
  });
}
`;
      }
      if (id === game + "/MapFileLoader.js") {
        const paths = readdirSync(resolve(game, "maps/tests"))
          .filter(name => name.endsWith(".json"))
          .map(name => `./maps/tests/${name}`);
        // Quasar's legacy Vite resolver does not normalize lazy JSON accepts
        // like static imports. Match the glob's browser URLs explicitly.
        const accepted = paths.map(path => "/src/game/" + path.slice(2));

        return code + hotImport + `
if (import.meta.hot) {
  import.meta.hot.accept(${JSON.stringify(accepted)}, (modules) => {
    const paths = ${JSON.stringify(paths)};
    const maps = [];
    modules.forEach((module, index) => {
      if (!module) return;
      maps.push(MapFileLoader.replaceDevelopmentMap(paths[index], module.default));
    });
    GameHotReload.publish({ maps });
  });
  import.meta.hot.accept(() => window.location.reload());
}
`;
      }
    },
  };
};
