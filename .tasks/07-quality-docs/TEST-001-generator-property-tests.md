# TEST-001 — Property-test procedural generation

- **Priority:** P0
- **Depends on:** WORLD-006
- **Touches:** `test/`, test tooling in `package.json`, generation fixtures

## Goal

Prove structural map guarantees across many seeds rather than relying on attractive screenshots.

## Work

- Add a fast unit-test runner suitable for pure JavaScript modules if the existing stack cannot run generator tests directly.
- Generate a large deterministic seed corpus across path counts one through four.
- Assert every rule in `docs/map-generator-rules.md` plus sky/void distinction, ordered route continuity, pipe pairing/no loops, hero reachability, build-pad minimums, castle attack zones, and bounded difficulty metrics.
- Store minimal failing seed/options/attempt diagnostics and add any discovered regression seed permanently.
- Add schema/serialization snapshots for a small reviewed fixture set without snapshotting giant incidental arrays blindly.
- Track runtime distribution and retry counts to catch pathological generator changes.

## Acceptance criteria

- CI reproduces a failure from the logged seed alone.
- The suite samples every active path count, gate orientation, turn orientation, merge type, bridge, and pipe mode.
- Tests verify invariants rather than exact random layouts except for designated compatibility fixtures.
- The stress suite stays bounded enough for regular development or is split into fast/extended commands.

## Verification

- Run both the fast generator suite and an extended multi-thousand-seed local stress command.

