import { HERO_ANIMATION } from "../enum/HeroAnimation.js";
import { HERO_MODEL_SCALE } from "./character-size.js";

export const HERO_PICKUP_ACTIONS = Object.freeze({
  flower: Object.freeze({
    animation: HERO_ANIMATION.PICK_FLOWER,
    duration: 36 / 24,
    impactTime: 14 / 24,
    heldItemHideTime: 31 / 24,
    targetDistance: 0.25,
    maximumForwardStep: 0.55,
    maximumBackwardStep: 0.68,
    heldItemAttachment: "right",
  }),
  mushroom: Object.freeze({
    animation: HERO_ANIMATION.PICK_MUSHROOM,
    duration: 96 / 24,
    cutStartTime: 30 / 24,
    impactTime: 42 / 24,
    liftStartTime: 1.95,
    toolHideTime: 2.3,
    stowStartTime: 64 / 24,
    heldItemHideTime: 82 / 24,
    targetDistance: 0.9574 * HERO_MODEL_SCALE,
    maximumStep: 0.45,
    heldItemAttachment: "left",
    requiresTool: true,
  }),
});

/**
 *
 * @param {string} category
 */
export function pickupActionForCategory(category) {
  return HERO_PICKUP_ACTIONS[category] ?? null;
}
