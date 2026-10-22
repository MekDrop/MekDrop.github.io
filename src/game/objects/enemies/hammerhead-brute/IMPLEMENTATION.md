# Hammerhead Brute — production playback verified, behavior acceptance pending

Initial mesh: Tripo Studio browser job
https://studio.tripo3d.ai/workspace/generate/57e1520f-d45b-420d-865b-64821cc7badf
H3.1 Best Quality, Geometry & Texture, Private, parts/8K disabled, 2K GLB.
The API account had zero credits; Studio had 22,700. Nano Banana isolated the
main portrait, then model generation quoted 30 credits. Observed balances were
22,700 -> 22,670 -> 22,640. Concurrent sibling jobs prevent authoritative itemized
billing from those deltas. No replacement, provider rigging or animation was used.
See provider-receipt.json for exact prompts, hashes and parameters.

Original output: tmp/hammerhead-brute-tripo-original.glb (also in Downloads).
Clean reference: C:/Users/mekdr/AppData/Roaming/clairvoyance/pictures/generated/hammerhead-brute-tripo-reference.png.
Editable source and export: src/game/models/enemies/hammerhead-brute/hammerhead-brute.blend
and adjacent hammerhead-brute.glb. Original provider mesh/UVs remain: 4,733 triangles,
one material. Local refinement makes shading matte, removes exaggerated normal-map
sheen, grounds/rescales the mesh, and adds a bespoke 16-bone rig, foot IK and rigid
hammer grip. Connected masonry blocks receive rigid weights. Pose review found
and repaired initial shaft/belt weight leakage and bending hammer stones.

Front/rear/side/game-camera renders were opened against info.png. The masonry head,
oversized hammer, blue body, pale chest and yellow eyes match closely. Rear armor
is provider-inferred; hands/feet differ slightly. No replacement was justified.
Offline images: tmp/hammerhead-original-views, tmp/hammerhead-refined-views and
 tmp/hammerhead-brute-validation. These are not production preview.png.

Embedded clips: idle, heavy_walk, heavy_run, turn, hammer_windup, hammer_swing,
hammer_contact, hammer_recover, overhead_door_bash, brace, hit, stun, stun_recover,
knockback, angry, reject_pickup, death. Fresh GLB import samples start/quarter/middle/
three-quarter/end plus declared contact phases, checks durations, actual evaluated
mesh motion and loop seams, and renders critical poses from two views. See
animation-manifest.json and asset-validation.json. This is exported deformation
verification. All 17 clips also pass actual PlayCanvas playback checks: positive
finite playback speed, advancing time, and at least three moving non-root joints.
See playback-evidence.json and playback-validation.json. This does not certify
every visual pose or gameplay outcome. Fresh-import totals now explicitly exclude
Blender's bone-display helper: 14,199 split vertices, 4,733 triangles, one UV layer,
16 bones. All 17 sampled deformations pass, with zero sampled looping seams.

Real Yuka states own pursuit, windup, swing, recovery, overhead door bash, hit,
stun/recover, pickup rejection, death and clip inspection. Movement uses the shared
Ammo capsule (mass 320). A forward 180-degree Ammo ray fan takes nearest non-self
contacts and deduplicates 45-damage hits per blow, including allies. Ringing is
ignored; all carrier/launch entry points reject. Thirteen focused enemy tests
(17 including the dispatcher/HUD tests) and
focused ESLint pass. Physics fixtures do not prove actual Ammo behavior.

Royal actors are actual shared-contract royals; only nearby obstructions between
the brute and royal divert pursuit. HammerNavigation uses CastleResidentMotion
on a detached planning cursor; the real root moves through Enemy/Ammo. Successful
furnished-castle traversal still fails before reaching the royal. Doors expose
receiveDamage; hammer contact uses that production destruction API. Live Ammo
testing found that entity-only yaw was overwritten by physics before contact.
The brute now synchronizes orientation to its body without changing position or
velocity-driven movement, and approaches with clearance inside maximum reach.
Two actual hammer contacts destroy the closed leaf; the brute enters the castle.
See behavior-evidence.json. A blocked plan now waits instead of falling back to
driving directly through furniture. A wider prop-probe experiment was rejected
because it prevented entry; it is not included. Production towers
lack destructible isSabotageTower/receiveDamage capabilities. Dislodging requires
occupiedTower === tower, releaseTarget() and launch({velocity,thrower}); Wire
Gremlin currently lacks occupiedTower. Its owner must expose true occupancy.
Approaching a tower is explicitly tested not to count as attachment.

Saved route: /map/test_enemy-hammerhead-brute. Valid class/model leaf registration
is present. Only this test map authors the brute via objects[]. PlayCanvas HUD
provides each clip, playback verification, transparent capture, behavior, bell,
stun, pickup, death and time-scale controls. No normal maps/waves, renderer,
factory or shared enemy files were edited.

Production playback and transparent preview were captured at
http://127.0.0.1:9138/en-US/map/test_enemy-hammerhead-brute using an ignored local
inspection copy. It uses the production renderer and object code, with prefetch
disabled and a temporary static Hammerhead factory registration to avoid an
outside-root Vite glob transform issue. Shared factory/config remain unchanged.
preview.png is a 512x512 RGBA production capture with transparent background,
42,337 visible pixels and complete-object margins. The Acceptance HUD panel adds
reproducible siege and lifecycle observations. Royal game-over callbacks are
deduplicated, preventing repeated contact from restarting the presentation.
Still required: complete royal navigation, occupied-tower integration and visual
blend acceptance. The current shared resident probe uses a 0.22-radius human
capsule; full clearance planning for this 0.7-radius brute needs further work.
Live lifecycle observations confirm bell immunity, pickup/launch rejection,
external stun/recovery, disabled death collision and entity removal. Animation
advancement measured 0.521 seconds per wall second at half speed and 0.986 at
normal speed. Death cleanup exposed a HUD read of a released animation component;
status now safely reports zero time/speed after disposal, covered by a regression.
The final lifecycle rerun completed with zero browser errors; behavior-cleanup.jpg
shows the retired actor removed while the HUD remains operational.
The supplied Clairvoyance
todos.md staff-doc path was absent; no substitute work tracker was created.
