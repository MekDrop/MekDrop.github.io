import { HERO_ANIMATION } from "../enum/HeroAnimation.js";

export const HERO_PICKUP_ACTIONS = Object.freeze({
  flower: Object.freeze({
    animation: HERO_ANIMATION.PICK_FLOWER,
    duration: 36 / 24,
    impactTime: 14 / 24,
    heldItemHideTime: 31 / 24,
    minimumDistance: 0.52,
    maximumDistance: 0.68,
    radiusClearance: 0.28,
    maximumForwardStep: 0.22,
    maximumBackwardStep: 0.68,
    heldItemAttachment: "right",
  }),
  mushroom: Object.freeze({
    animation: HERO_ANIMATION.PICK_MUSHROOM,
    duration: 40 / 24,
    impactTime: 18 / 24,
    heldItemHideTime: 35 / 24,
    targetDistance: 0.34,
    maximumStep: 0.24,
    heldItemAttachment: "left",
    requiresTool: true,
  }),
});

export function pickupActionForCategory(category) {
  return HERO_PICKUP_ACTIONS[category] ?? null;
}
