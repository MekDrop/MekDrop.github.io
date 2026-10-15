/**
 * Discover asset URL modules without encoding fabric styles in the game object.
 * Each module exports its adjacent GLB URL for the bundled Vite asset pipeline.
 */
const modules = import.meta.globEager("../../models/rug/*.js");
export const rugModels = Object.fromEntries(Object.entries(modules).map(/**
 * @param {[string, {default: string}]} entry
 */ ([path, asset]) => [path.replace(/\.js$/, ".glb"), asset.default]));
