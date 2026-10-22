# Cinder Imp

Tripo Studio generated the initial mesh from the isolated main portrait in `portrait.png`. Completed job: `e5f1b5e9-d714-4bed-bc58-c91672ebbf28`; quoted and observed submission cost: **30 credits**. The API account had no credits; the browser account had sufficient existing credits. No replacement generation or paid rigging was used, and no credits were purchased. `asset-status.json` retains the receipt, exact cutout prompt, calibration and source hashes.

## Assets and animation evidence

- Editable source: `src/game/models/enemies/cinder-imp/cinder-imp.blend`.
- Runtime asset: `src/game/models/enemies/cinder-imp/cinder-imp.glb`.
- Original provider output: `src/game/models/enemies/cinder-imp/provider/tripo-original.zip`.
- Original reference remains `info.png`; `preview.png` is a transparent 512-pixel capture from the production renderer, with the complete object and no scenery or HUD.

The refinement preserves the Tripo mesh, UVs and base texture, reduces glossy shading, adds subtle furnace emission, settles the feet, and normalizes horn height to 1.1 metres. A custom 14-bone furnace/limb rig includes foot IK. The runtime wrapper rotates the model 180 degrees to match engine forward. The mesh contains 4,434 triangles.

All **20 embedded clips** were freshly imported, sampled at five phases from front and game views, and then played on the actual production hierarchy through the saved map HUD. `animations.json` records measured durations, loop flags, contact events and supported states. `evidence/fresh-import.json`, four clip contact sheets, `evidence/production-playback.json` and `evidence/playback-summary.json` retain the checks. Production samples confirm finite advancing track times and animated transforms for every clip. Run and turning clips are inspection-only; gameplay does not invent new movement behavior to use them.

## Behavior

The map-owned `Enemy` root uses actual Yuka states and an Ammo dynamic body. Pursuit resolves the actual royal actor. Castle floor navigation supplies lookahead waypoints; movement remains owned by physics. Closed doors are respected and are opened explicitly through gameplay or the test HUD. Towers are excluded from intentional attacks.

Fire separates windup, contact and recovery. Raycasts prevent damage through solid walls. Explicitly flammable route props lose burn health and release their own collision lifecycle when destroyed. Short-lived ground heat uses actual trigger membership, has a six-patch cap, and extinguishes on frost contact. Native particles provide mouth fire and bounded steam.

Nearby actors with frost/chill capability can divert pursuit into a steam rivalry. Bell encouragement never grants a speed bonus or confusion. Carrying disables the dynamic body, plays struggle and builds visible heat; susceptible carriers receive heat damage. The hero currently has no damage receiver, so its feedback is the heat light. Throwing restores Ammo flight; landing temporarily redirects pursuit to the thrower. Damage and stun interrupt attacks, with separate recovery; knockback applies a body impulse. Death disables collision and clears owned hazards/effects before delayed destruction. Royal contact invokes the existing game-over capability and enters victory.

## Saved fixture and checks

Open `/map/test_enemy-cinder-imp`. The saved fixture includes a real castle/royal, flammable crate, actual Frost Puff, and PlayCanvas HUD controls for clips, runtime playback recording, transparent capture, carrying, throwing, status interruptions, door opening and simulation speed. No normal/story/generated maps or spawn pools were changed.

Focused verification: **23 tests pass** across `enemy.test.js`, `cinder-imp.test.js`, `cinder-animation-playback.test.js` and `cinder-navigation.test.js`. Targeted ESLint passes for Cinder Imp, its enum, shared foundation and their tests. Unit checks use real Yuka, PlayCanvas types and the production navigation planner, with mocked physics queries/contact callbacks; they do not substitute for actual Ammo interaction acceptance. Build and Prettier were skipped because the development server was live.

## Remaining acceptance

All clips and the transparent production capture are verified. Interactive fire direction/steam appearance, pickup/throw/landing, full castle-route/crate-burning behavior, time scaling, interruption and death cleanup still need final production-scene observation. The latest browser attempt reached a Quasar ESLint overlay caused by four `jsdoc/multiline-blocks` errors in `mushroom-brute/MushroomBrute.js`, preventing MainLayout from loading. This is an incomplete acceptance pass, not a completed gameplay sign-off.
