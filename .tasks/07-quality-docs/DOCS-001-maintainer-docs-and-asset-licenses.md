# DOCS-001 — Document systems, tuning, controls, and asset licenses

- **Priority:** P1
- **Depends on:** all feature tasks
- **Touches:** `README.md`, `docs/`, `.clairvoyance/Docs/architecture.md`, asset-license records

## Goal

Leave the finished game understandable and safely maintainable without reverse-engineering a thousand cubes at dawn.

## Work

- Update architecture documentation with generator/schema, session/loop, systems, render layers, UI events, and lifecycle ownership.
- Update `docs/map-generator-rules.md` to match the final sky/void, underside, build-pad, pipe, route graph, and gameplay validation contracts.
- Document controls, debug-only controls, deterministic seed reproduction, test commands, profiling scenario, and common failure diagnostics.
- Add concise authoring guides for tower, enemy, wave, animation, and localization entries.
- Record source, creator, license, required attribution, and modification notes for every visual/font asset.
- Document the original-IP rule and remove any temporary/prototype asset that lacks redistribution permission.

## Acceptance criteria

- A maintainer can reproduce a reported seed, add one tower/enemy/wave entry, and run the relevant validation without reading implementation internals.
- Architecture and map rules agree with shipped behavior.
- Every distributed asset has clear provenance and compatible usage rights.
- README lists current Node/npm requirements and verified lint/test/build commands.

## Verification

- Follow the docs from a clean checkout or equivalent clean dependency state and correct every stale command/link.
