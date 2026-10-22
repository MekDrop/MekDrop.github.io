/**
 * Required embedded-clip contract. This list is not evidence of authored clips.
 */
export class RiftcapAnimation {
  /**
   * @returns {string[]}
   */
  static get names() {
    return ["idle", "walk", "run", "turn", "bolt_windup", "bolt_cast", "bolt_recover",
      "swap_windup", "swap_cast", "swap_recover", "heal_start", "heal_loop", "heal_end",
      "ward_windup", "ward_cast", "ward_recover", "shatter_windup", "shatter_cast", "shatter_recover",
      "time_bubble_start", "time_bubble_sustain", "time_bubble_end", "cast_interrupt", "confused",
      "recover", "hit", "stunned", "knockback", "carried_struggle", "airborne", "land", "death"];
  }
}
