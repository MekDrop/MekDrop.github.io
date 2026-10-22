# Fuse Hopper — asset authored, production verification incomplete

The browser retry after the sibling enemy work succeeded. Tripo Studio had credits despite the separate API account reporting zero. Initial generation: H3.1 Best Quality, geometry and texture, private, 2k GLB export. Job be54f4ef-7eec-4ac9-84f3-269918e5b6d2. Balance changed from 22640 to 22610: 30 credits spent, one generation, no replacements or credit purchases. Provider receipt: ../../../models/enemies/fuse-hopper/provider-receipt.json.

## Assets and reference review

- Main character: info.png; isolated input: portrait.png, derived with built-in imagegen. Source sheet was preserved.
- Original: src/game/models/enemies/fuse-hopper/fuse-hopper-tripo-original.glb and adjacent editable .blend.
- Refined: src/game/models/enemies/fuse-hopper/fuse-hopper.blend and adjacent exported .glb.
- Rig: Root, Body, Spring.L/R, Boot.L/R, Fuse, Spark. Custom mechanical anatomy, not humanoid auto-rigging.
- Original front/side/rear/game renders and refined front/rear/left/right/top/game renders were opened. The charcoal faceted chassis, orange rectangular eyes, brass boots and coil silhouette match the main portrait closely. Local changes: matte surface response, 0.95m scale, -39 degree authored yaw correction, charcoal rear panels to suppress mirrored glowing eyes, and an emissive center in the fuse spark.
- Remaining art risks: the original tilted single-foot stance remains, rear eye-panel impressions remain geometrically visible, and compression/contact quality needs the complete animation visual pass. Six refined source views are saved in evidence/. These are Blender evidence, not the required actual-game preview.

## Implemented behavior

Real Yuka states: FusePursuitState, FuseWarningState, FuseStoppedState, FusePassengerState, FuseRecoveryState, FusePlaybackState (test inspection only), FuseTerminalState. Extends the shared Enemy without edits to shared files or renderer.

Pursues actual royals, ignores tower goals, probes animated entrance leaves, warns for 1.1s before detonation, accepts early fire ignition at 0.45s, stops briefly on bells, and retains its fuse through carry/Ammo launch/landing. One terminal blast damages capability-based nearby recipients including allies, radius 2.2m, damage 48. Existing royal game-over capability is used when no damage method exists. Lethal interception disarms the bomb. Ammo owns velocity, impulses, gravity and landing contacts. Warning uses a point-light pulse; terminal blast uses the Engine particle component. Values need game tuning.

## Clips and evidence boundary

All 19 exported clips were fresh-imported in a clean Blender process and sampled at start/quarter/middle/three-quarter/end. Every clip deforms the MAIN Tripo mesh; maximum loop seam is below 0.000001m. Imported main mesh: 4724 triangles, 14172 split vertices, one UV layer. See evidence/fresh-import-samples.json and animation-manifest.json for measured durations and per-clip results.

idle_bounce; hop_compress; hop_takeoff; hop_air; hop_land; hop_locomotion_loop; turn; startled_stop; recover; fuse_start; fuse_loop; carried_ready; thrown_tumble; impact_land; detonate; hit; stun; stun_recover; death.

These are verified imported samples, NOT fully verified production clips. ProductionPlayback and visualReview flags remain false. A separate full visual render pass stalled after six clips; its process was stopped. The CPU retry crashed in ntdll.dll. No full animation visual review, blend/foot-slide/contact acceptance or live time-scale verification is claimed.

## Focused checks and test map

Six own unit tests pass: actual royal selection over tower goals; live fuse through carry/throw/landing/bell; fire-shortened deadline; friendly damage and royal terminal outcome; interception; actual door hit/open-pose queries. Focused lint passes.

Saved map: src/game/maps/tests/enemy-fuse-hopper.json. Route: /map/test_enemy-fuse-hopper. HUD owns per-clip controls, behavior resume, ignite/fire/bell/stun, carry/throw, reset, clip sampler, door pose and alpha-preview capture. Entities are authored through objects[]. Leaf index.js uses the existing generic discovery; no normal map/spawn-pool integration.

Live verification blocker: localhost:9000 returned 404 responses and then stalled at object-data-cache loading. An isolated Quasar server was started on port 9082 and reported ready, but browser navigation/frame-tree reads repeatedly timed out. Its route is http://localhost:9082/map/test_enemy-fuse-hopper. No runtime success is inferred from server startup.

## Outstanding acceptance

- Actual production clip/joint playback for all 19 clips, interrupted transitions, Ammo contact/throw/landing and time-scale changes.
- In-game open/closed-door and ultimate royal pursuit outcomes; terminal visual effect, ally damage and lifecycle cleanup.
- Full action visual review and any spring/boot skin repair it reveals; a separate knockback clip/reaction remains to author if required.
- Actual-game transparent preview.png, visible/transparent pixel counts and margins. No substitute Blender preview was installed.

The one-time waiting automation was deleted after the retry. Work remains incomplete until these gates pass.
