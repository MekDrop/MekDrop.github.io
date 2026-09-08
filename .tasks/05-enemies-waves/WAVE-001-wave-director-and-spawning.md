# WAVE-001 — Add wave director and multi-path spawning

- **Priority:** P0
- **Depends on:** FOUNDATION-002, ENEMY-001, ENEMY-002
- **Touches:** `src/game/systems/WaveDirector.js`, `src/game/config/waves.js`, `src/game/GameSession.js`

## Goal

Spawn finite, readable waves across one to four generated entry routes and report authoritative progress.

## Work

- Define data-driven wave groups with enemy type, count, interval, delay, route selection policy, and optional simultaneous lanes.
- Add ready/build countdown, active spawning, wave-complete wait, early-start/fast-forward reward policy, and final-wave state.
- Distribute spawns fairly across active routes using deterministic scheduling and route-specific pressure caps.
- Count a wave complete only when all groups have spawned and no wave enemy remains moving, attacking, or in a pipe transition.
- Prevent spawns after pause, defeat, restart, or disposal.
- Publish upcoming composition and active/remaining counts for HUD/onboarding.

## Acceptance criteria

- Every level has a finite known wave count and every scheduled enemy has one spawn route.
- One-to-four-path levels receive balanced pressure without starvation or accidental impossible simultaneous bursts.
- Countdown and group timers use simulation time, not ad hoc browser timers.
- The final wave cannot complete while a surviving enemy is attacking the castle.

## Verification

- Test route distribution, pause/resume, early start, empty groups, simultaneous groups, last-enemy timing, and cancellation.

