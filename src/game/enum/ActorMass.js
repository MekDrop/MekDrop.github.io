// Kilograms for dynamic actor bodies. Static scenery and kinematic residents
// remain immovable Ammo bodies; debris and carried props own their own masses.
export const ACTOR_MASS = Object.freeze({
  HERO: 80,
  ENEMY: 40,
  LATCH_SLUG: 12,
  BELL_BUG: 35,
});
