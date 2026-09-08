# PERF-001 — Meet performance, lifecycle, and SSR requirements

- **Priority:** P1
- **Depends on:** RENDER-004, ENEMY-003, WAVE-002, UI-002
- **Touches:** `src/game/`, `src/components/GameCanvas.vue`, `src/layouts/MainLayout.vue`, `quasar.config.js`

## Goal

Keep a full wave smooth and leak-free while preserving SPA, SSR, and SSG builds.

## Work

- Define budgets for active enemies/projectiles/effects, draw calls, frame time, generation time, memory growth, and restart cleanup.
- Profile static terrain caching/render groups, entity depth sorting, pools, hit testing, text updates, and full-map redraws before optimizing.
- Disable PixiJS interaction on noninteractive subtrees and use explicit hit areas only where needed.
- Pause/cap simulation on tab hide and prevent giant catch-up bursts on return.
- Dispose ticker callbacks, controls, observers, Vue subscriptions, texture ownership, render layers, and pools on unmount/restart.
- Keep browser-only APIs inside the existing `q-no-ssr`/mounted boundary and verify SSR/SSG imports do not touch `window`/DOM.

## Acceptance criteria

- Representative maximum-density waves meet the agreed desktop and supported-mobile frame target.
- Ten or more same-page restarts show no monotonic growth in active ticker listeners, display objects, or event listeners.
- `build:spa`, `build:ssr`, and `build:ssg` succeed.
- Performance work is backed by before/after measurements, not decorative micro-optimizing.

## Verification

- Record a profiling scenario, run lifecycle counters, lint, and all three build modes.
