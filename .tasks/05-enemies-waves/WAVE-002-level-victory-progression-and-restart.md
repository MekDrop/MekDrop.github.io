# WAVE-002 — Resolve victory, progression, and restart

- **Priority:** P1
- **Depends on:** WAVE-001, CASTLE-001, PLAYER-004
- **Touches:** `src/game/GameSession.js`, `src/game/systems/LevelResultSystem.js`, `src/stores/`, `src/components/GameCanvas.vue`

## Goal

Finish the level loop cleanly when every wave is survived or the castle is destroyed.

## Work

- Define deterministic result precedence and lock the result once resolved.
- Victory requires final group spawned, no surviving/attacking/teleporting enemies, and castle HP above zero.
- Freeze or transition hero/towers/projectiles appropriately on result and publish score stats such as castle HP, time, towers built, and seed.
- Implement replay same seed, generate next seed, and restart current level without page reload.
- Decide lightweight local progression/high-score persistence that does not break SSR; make corrupted storage recoverable.
- Ensure debug regeneration uses the same result-safe restart path.

## Acceptance criteria

- Victory cannot trigger merely because the spawn queue is empty.
- Defeat/victory UI appears once, inputs are gated correctly, and restart clears every previous entity/timer/reservation.
- Replay same seed creates the same level; new level records and displays its new seed.
- Local persistence is optional to gameplay and degrades safely when storage is unavailable.

## Verification

- Test victory, defeat, simultaneous resolution, replay, new seed, repeated restarts, and persistence failure.
