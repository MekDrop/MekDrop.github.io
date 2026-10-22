// Enemy task explicitly requires its animation enum in this owning directory.
// eslint-disable-next-line no-restricted-syntax
export const DOORCRACKER_ANIMATION = Object.freeze({
  IDLE: "idle_loaded",
  WALK: "walk_loaded",
  RUN: "run_loaded",
  TURN: "turn",
  VOLUNTEER: "volunteer_hop",
  CARRIED: "carried_ready",
  AIRBORNE: "airborne",
  LAND: "land",
  RECOVER: "recover",
  BRACE: "brace_door",
  FUSE_START: "fuse_start",
  FUSE_LOOP: "fuse_loop",
  INTERRUPT: "fuse_interrupt",
  DETONATE: "detonate",
  HIT: "hit",
  KNOCKBACK: "knockback",
  STUN: "stun",
  STUN_RECOVER: "stun_recover",
  FIRE: "panic_fire",
  DEATH: "death",
});
