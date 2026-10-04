// Hero asset standing height before its runtime scale is applied.
const HERO_AUTHORED_HEIGHT = 2.645;

export const HERO_MODEL_SCALE = (0.65 + (2.2 * 0.45) / HERO_AUTHORED_HEIGHT) / 2;
export const CHARACTER_HEIGHT = HERO_AUTHORED_HEIGHT * HERO_MODEL_SCALE;
