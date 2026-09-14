import { HERO_BUFF } from "../enum/HeroBuff.js";
import { BUFF_KIND } from "../enum/BuffKind.js";
import { HERO_STAT } from "../enum/HeroStat.js";

export const HERO_BUFF_DEFINITIONS = [
  {
    id: HERO_BUFF.AFFECTION,
    kind: BUFF_KIND.BUFF,
    labelKey: "game.buffs.affection",
    icon: "♥",
    duration: 6,
    maxStacks: 5,
    blockedBy: [HERO_BUFF.OVERSTIMULATED],
    modifiers: {
      [HERO_STAT.MOVEMENT_SPEED]: { percent: 0.05 },
    },
  },
  {
    id: HERO_BUFF.OVERSTIMULATED,
    kind: BUFF_KIND.DEBUFF,
    labelKey: "game.buffs.overstimulated",
    icon: "💢",
    duration: 8,
    requiresRest: true,
    maxStacks: 1,
    replaces: [HERO_BUFF.AFFECTION],
    modifiers: {},
  },
];
