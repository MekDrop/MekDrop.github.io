# FOUNDATION-001 — Freeze gameplay contracts and configuration

- **Priority:** P0
- **Depends on:** none
- **Touches:** `src/game/config/`, `src/assets/game/config/`, `docs/`

## Goal

Replace implicit assumptions with one documented, data-driven ruleset shared by generation, simulation, rendering, and UI.

## Work

- Define level phases: loading, ready/build, wave countdown, wave active, victory, defeat, paused, disposed.
- Define coordinate vocabulary (grid cell, world position, elevation, render position) and fixed simulation units.
- Centralize initial castle HP, starting currency, build/sell rules, tower and enemy stats, wave timing, hero movement, and pipe transition timing.
- Specify whether building is allowed during waves. Default to yes, provided the hero is at a valid pad.
- Define a small first-release scope: three tower roles, four enemy roles, and one difficulty curve.
- Retire or clearly isolate unrelated `shooter-config.js` values so they cannot accidentally drive the tower-defense game.

## Acceptance criteria

- No gameplay system owns a second hard-coded copy of shared balance values.
- Config is serializable and can be overridden for deterministic tests.
- The rules explicitly preserve a visible hero, fixed camera, maximum four routes, castle HP, pipe teleports, and survive-all-waves victory.
- The visual direction is described as original platform-arcade inspiration without protected Nintendo assets or names in shipped UI.

## Verification

- Import the configuration from a Node-side smoke test without creating PixiJS or browser globals.

