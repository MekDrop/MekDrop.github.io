import heroModelUrl from "../../../models/hero/hero.glb?url";
import specialArtojasModelUrl from "../../../models/hero/variants/special-artojas/special-artojas.glb?url";
import { HERO_MODEL } from "../../../enum/HeroModel.js";

export const HERO_MODEL_URLS = Object.freeze({
  [HERO_MODEL.HEROE]: heroModelUrl,
  [HERO_MODEL.SPECIAL_ARTOJAS]: specialArtojasModelUrl,
});

/**
 * @param {string} name
 * @returns {string}
 */
export function heroModelUrlFor(name = HERO_MODEL.HEROE) {
  return Object.hasOwn(HERO_MODEL_URLS, name)
    ? HERO_MODEL_URLS[name]
    : HERO_MODEL_URLS[HERO_MODEL.HEROE];
}
