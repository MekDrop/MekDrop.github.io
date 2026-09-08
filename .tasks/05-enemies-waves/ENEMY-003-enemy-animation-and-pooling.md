# ENEMY-003 — Integrate enemy animation, pooling, and cleanup

- **Priority:** P1
- **Depends on:** ENEMY-002, RENDER-001
- **Touches:** `src/states/enemies/`, `src/core/AssetsManager.js`, `src/game/rendering/EnemyView.js`, `src/game/pools/`

## Goal

Connect current enemy animation remnants to the route-based model and support wave-sized populations without churn.

## Work

- Audit existing walk/alert/dead Yuka states and retain only behavior relevant to route-following tower defense.
- Add turn, pipe-enter/exit, hit, castle-attack, and death presentation states or equivalent view state mapping.
- Pool enemy views and other high-churn visual objects while keeping simulation entity IDs fresh.
- Reset textures, callbacks, tint, alpha, scale, health bars, statuses, and listeners on pool checkout/check-in.
- Load animation assets once, mirror where valid, and use original placeholders for missing directions.
- Ensure pooled nodes are not interactive unless required, avoiding unnecessary PixiJS hit testing.

## Acceptance criteria

- Reusing a view cannot replay the previous enemy's death callback or status visuals.
- Enemy facing follows projected route direction through all 90-degree turns.
- A full level reaches steady allocation behavior after pools warm up.
- All views return to pools or are destroyed on restart and component teardown.

## Verification

- Stress-test several hundred spawn/death cycles and assert pool reset plus zero remaining active views after disposal.

