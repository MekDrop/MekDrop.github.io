# CASTLE-001 — Add castle HP, enemy attacks, and defeat

- **Priority:** P0
- **Depends on:** FOUNDATION-003, ENEMY-001, WAVE-001
- **Touches:** `src/game/entities/Castle.js`, `src/game/systems/CastleCombatSystem.js`, `src/game/GameSession.js`, `src/game/MapGenerator.js`

## Goal

Make the castle the defendable objective: nearby arriving foes stop, attack it, and can destroy it.

## Work

- Create a castle entity with configured max/current HP, alive/destroyed state, and event output.
- Generate explicit attack slots/range at the castle entrance so arrivals do not overlap the structure randomly.
- Transition enemies reaching the terminal route into attack state; apply per-hit damage on cooldown rather than one implicit escape penalty.
- Decide target occupancy/queue behavior when many enemies arrive and ensure all valid attackers can contribute within defined caps.
- Stop castle damage on enemy death, pause, victory lock, restart, or disposal.
- Trigger defeat exactly once at zero HP, stop new spawns, disable building, and move remaining actors into result cleanup/presentation.

## Acceptance criteria

- Castle HP never drops below zero or receives duplicate hits from one attack event.
- Foes attack only when within the generated castle attack zone and visibly face the castle.
- Killing an attacker immediately stops future scheduled hits from it.
- Castle destruction takes precedence over same-step final-wave completion according to a documented resolution order.

## Verification

- Test attack range, cooldown, multiple attackers, attacker death, pause, simultaneous last-enemy/last-HP resolution, and one-time defeat.

