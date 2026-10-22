# Pitcher Ogre implementation and evidence

Pitcher Ogre uses the shared `Enemy` and genuine Yuka states. It is factory-discoverable through `index.js` and appears only in `src/game/maps/tests/enemy-pitcher-ogre.json`, at `/map/test_enemy-pitcher-ogre`. No normal map, generator or spawn pool was changed by this task.

## Model and provenance

- Editable model: `src/game/models/enemies/pitcher-ogre/pitcher-ogre.blend`.
- Exported model: `src/game/models/enemies/pitcher-ogre/pitcher-ogre.glb`.
- Preserved originals and their editable imports: the adjacent `source/` directory.
- Reference: the large upper-left character in `info.png`; the faithful isolated input is `tripo-reference.png`.
- Studio asset: https://studio.tripo3d.ai/workspace/generate/46ba08b1-6eaf-40c6-aecf-7c3d7d51db24.
- `provider-receipt.json` records the browser parameters and observed 30-credit generation debit. Humanoid/Mixamo rigging was quoted at 20 credits; its separate actual charge was not itemized, and concurrent jobs prevent deriving it from the shared balance. The UI exposes the Studio asset ID, not a separate wire task ID. No replacement generation or paid rig retry was used.

The initial Tripo mesh matched the reference's blue body, enormous grey stone fists, yellow eyes, open mouth/pink tongue, brown belt/loincloth and gold buckle. Front, side, rear and isometric renders were inspected. Tripo's unseen rear is an inference, rather than a supplied turnaround. The asymmetric raised fist and short, broad legs are retained. The provider rig assigned almost all vertices to the hips and was rejected. The local anatomical rig uses 16 bones, normalized one/two-bone weights, rigid fist regions, and an embedded `CarrySocket`. Materials retain the original textured UVs with a matte finish. Measured bind height is about 2.42 world metres at the model wrapper's 3.4 uniform scale; the physics root is unscaled.

## Clips and offline evidence

All 22 clips are embedded in the editable model and GLB: `idle`, `walk`, `run`, `turn`, `beckon_volunteer`, `pickup_willing`, `pickup_unwilling`, `hold_idle`, `hold_walk`, `aim`, `throw_windup`, `throw_release`, `throw_recover`, `confused_drop`, `reject_heavy`, `angry_warn`, `ground_punch`, `hit`, `stun`, `recover`, `knockback`, `death`.

`animations.json` is the measured machine-readable manifest: durations, loops, contacts and supported states. `PitcherClips.js` supplies the same clip data to runtime playback. `animation-import-evidence.json` records a fresh GLB import sampled at start/quarter/middle/three-quarter/end and action contacts; the contact sheets are in `evidence/`. Cyclic transforms return to their opening pose within 0.00001. `asset-metrics.json` reports 4,734 triangles, one UV-mapped/skinned textured mesh, no invalid vertices or degenerate faces. UV/normal seams create open boundary edges; this is a runtime surface asset, not a watertight printable solid. Deep crouch/contact poses still require the production game-camera acceptance check below.

## Behavior

Yuka states: Pursue, Recruit, Pickup, Aim, Throw, Release, Recover, Confused, Stunned, Hit, Reject, Angry, RoyalReached, Death, and Inspect. Files use the `Pitcher…State` names under `states/`. RoyalReached starts a royal encounter once, rather than retriggering it every frame.

It resolves existing royal actors, ignores towers and treats castle structures as physical obstacles. Willing Divecaps and Doorcrackers receive preference; a Crown Crab is always considered unwilling and is eligible only under pressure. Capability hooks own the passenger's carried/airborne/landing reactions. Gobbler consumption of a queued ally provokes a bounded warning and ground-punch reaction. Bell confusion immediately drops the passenger; stun and death also release it. The Ogre refuses carrying and launching. The carrier attachment was calibrated above the glove at rest position (0.36, -0.08, 0.465) in Blender coordinates; passengers keep an upright physical root through release/landing. Actual pickup-contact alignment still requires the live camera check.

Pickup/release use the common carrier capabilities and the animated socket. Held rigid bodies are disabled according to the shared contract; release restores Ammo and sets an engine velocity. Landing comes from real engine contact, never a timer. The throw planner checks floor support, landing headroom and sampled capsule-envelope raycasts. It chooses a bounded ballistic launch solution, then rechecks at release contact (0.1 seconds into the separate release clip). Ammo integrates flight. Rejected landings keep the passenger held for a bounded re-aim period, followed by a physical drop. A cooldown prevents immediate regrabbing.

## Verification status

- Passed: 19 focused Node tests, including real Ammo raycasts and a capsule clearing a three-metre wall and settling near its planned landing, the actual Crown Crab lifecycle, confusion/drop, interruption, death, one-shot royal encounter, exported weights, all clip durations/bindings, cyclic closure and an upright passenger root.
- Passed: focused map HUD dispatcher tests (3) and lint of this task's source/tests. A read-only startup dependency audit also found source lint clean at its observation time.
- Passed: fresh Blender GLB import and sampled pose review for every embedded clip; retained evidence separates this from GPU playback verification.
- Not verified: actual production-map playback, blends, game-camera grounding, per-clip HUD clicks, time-scale checks, actual-game carry/throw/drop and map switching.
- Not captured: the required production-renderer transparent `preview.png`. No offline render has been substituted for it.

The browser route initially failed while importing `MainLayout.vue`, then progressed through cache/resource loading. A live attempt was interrupted by 14 fresh ESLint errors in `src/game/objects/enemies/cinder-imp/CinderNavigation.js`; its owner subsequently repaired them. The latest retry was blocked by 7 ESLint errors in `src/game/objects/characters/hero/Hero.js` (lines 155/157/161/2512), which is also outside this task. Neither file was changed by this task. Opera later timed out retrieving its frame tree. The focused Cypress Electron runner closed before executing its spec; the Edge retry did not connect/progress and was cancelled. These are actual verification blockers, not successful game checks. `PitcherOgre.cy.js` is the focused acceptance spec, not a recorded passing run.

The saved map supplies production PlayCanvas HUD controls for all clips (three pages), front/rear views, time scales 0.5/1/2, a held volunteer, actual throwing, confusion/drop, stun, pressure, queue-consumption reaction, death, moving an actual royal behind the castle wall, a runtime joint-motion audit, and a transparent production capture. `PitcherOgrePlaybackEvidence`, `PitcherOgreFlightEvidence` and `PitcherOgrePreviewEvidence` are emitted only by actual runtime actions. The capture omits other meshes/HUD/shadow casters and reports visible/transparent pixels and margins. The acceptance spec records runtime joint samples for every clip and checks at least two moving non-root joints. Completion still requires successfully running those checks and saving/inspecting the real `preview.png`.
