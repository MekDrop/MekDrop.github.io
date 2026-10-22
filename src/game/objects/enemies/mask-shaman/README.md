# Mask Shaman

Asset authoring and offline verification are complete. **Actual-game acceptance
is unfinished.** The discipline consumer follow-up is implemented and unit-tested;
its live acceptance and sibling commit dependencies remain open. No normal/generated/story map or spawn pool was changed.

## Provider and artwork

The API profile had zero credits. Following the user's browser instruction,
Tripo Studio job `da316294-10db-442b-9180-55ff6ab71231` succeeded with H3.1,
Geometry & Texture, Private visibility and 2k GLB export. The UI quoted 30 credits;
the displayed balance moved from 23,110 to 23,080. Only one generation was used.
`provider-receipt.json` records settings, hashes and the exact extraction prompt.
Only the approved design portrait was uploaded, never repository code.

`portrait.png` was isolated from the large main character in `info.png` using
built-in ImageGen; both are preserved. A copy is saved in Clairvoyance's generated
pictures folder. Provider originals remain separately in ignored
`tmp/mask-shaman/tripo-original.glb` and `.blend`.

Final source/export are `src/game/models/enemies/mask-shaman/mask-shaman.blend`
and adjacent `mask-shaman.glb`. The 4,654-triangle provider mesh retains its UVs
and textured material, with 11 semantic weighted bones. Local refinement centres
the feet, separates rigid mask/fan and staff-hand control, and adds authored
motions. The short-leg shuffle is calibrated to 0.28 metres/second. A runtime
wrapper applies a 180-degree facing correction, still needing in-game confirmation.

Reviewed front, side, rear and isometric provider/final Blender renders. The ivory
skull, rectangular red-dark eye openings, red forehead triangle, alternating
red/indigo feather fan, gold collar, squat boots and skull staff preserve the
main portrait closely. No paid replacement was needed. The simple rear feather
backing is inferred because the reference does not specify the back. Evidence:
`evidence/original-*.png` and `evidence/rigged-*.png`.

## Animation evidence

Twenty embedded clips: `idle`, `walk`, `run`, `turn`, `staff_raise`,
`discipline_cast`, `aura_sustain`, `aura_end`, `cast_interrupt`, `confused_loop`,
`recover`, `hit`, `angry`, `carried_struggle`, `airborne`, `land`, `staff_attack`,
`stun_loop`, `death`, `knockback`.

Every exported clip was freshly imported into an empty Blender scene and sampled
at start, quarter, middle, three-quarter and end; staff attack also at its
0.4-second contact. Every clip deforms evaluated mesh vertices. Looping clips
return to their first sampled mesh pose. Opened and reviewed all four pose
sheets; no obvious mask/fan distortion or detached staff was observed in those
samples. Continuous runtime blending and gameplay foot contact remain unverified.

`animation-manifest.json` contains measured durations, looping, contact event,
states and fresh-import results. Its `verified: false` flags remain until runtime
acceptance. `evidence/fresh-import-validation.json` stores sampled joints and mesh
hashes; `evidence/clip-sheet-*.jpg` stores the poses. Duration tests independently
read actual GLB time tracks. The validator sets 30 FPS before import, avoiding
Blender's default-24-FPS duration conversion.

## Behavior

Real Yuka states under the production NpcStateMachine: ShamanCastState,
ShamanMarchState, ShamanInterruptedState, ShamanRecoverState,
ShamanStaffAttackState, ShamanDeadState. ShamanClipTestState is explicit test mode.
The enemy resolves actual royal actors; towers and castles are never its target.
Movement, carrying, launch velocity and landing delegate to shared Ammo behavior.

Bell confusion, stun, hits, carrying, flight and death pause discipline
immediately. An unwilling passenger struggles. Confusion may outlast flight;
recovery requires a fresh cast. Staff contact happens once after windup and is
canceled by interruption. A transient Engine line ring marks active discipline.

Volatile allies can query `source.suppressesGrudgesFor(ally)` on nearby actors,
without sibling imports. It is true for another living, uncarried, non-airborne
enemy within 3.5 metres while concentration is active. Grudges are never erased;
multiple shaman sources are independent. Ally targeting/infighting belongs to the
ally. The shared Enemy capability query and actual Cinder Imp, Frost Puff, Crown Crab
and Wire Gremlin consumers now suspend deliberate rivalry selection/contact.
Ordinary defender attacks, royal attacks and incidental splash retain their paths.
Consumer tests cover pending contacts, independent sources, range exit, interruption
and resumed grudges. Sibling-dependent edits remain pending; see discipline-integration.md.

## Verification and remaining work

Saved map: `src/game/maps/tests/enemy-mask-shaman.json`.
Route: `/map/test_enemy-mask-shaman`. Two shamans, a production King and a spawn
point are authored through objects[]. PlayCanvas HUD controls cover every clip,
bell, interruption, stun, carry, Ammo throw, death, time scales, automated
playback/behavior evidence and production-renderer transparent capture.

Focused command: `node --test test/unit/game/objects/enemies/mask-shaman/*.test.js`.
Nine tests pass for Yuka/cast gating, range, bell/recast lifecycle, overlapping
statuses, carry/launch delegation, independent sources, royal targeting, attack
interruption, death, embedded clips, UVs and normalized weights. Physics tests
use a body double; they do not prove actual Ammo flight. Scoped ESLint passes.

The main dev server hit in-progress lint errors in other enemy tasks. A temporary
snapshot at `tmp/mask-shaman/app` uses the production app/renderer but registers
only Mask Shaman among enemies. Port 9012 uses a separate Vite cache. Live browser
verification succeeded there. No broad build or formatting command was run while
the main dev server was reachable.

Live evidence:

- `evidence/runtime-playback.json`: all 20 clips advance with finite joint values
  and at least two moving non-root joints; compact results are in the adjacent summary.
- `evidence/runtime-behavior.json`: all ten checks pass, covering cast, bell/hit
  interruption, fresh-cast recovery, unwilling carry, actual Ammo ascent/contact,
  landing recovery and actual King target resolution.
- `preview.png`: actual production renderer, 512 × 512 RGBA, complete object,
  47,153 visible and 214,991 transparent pixels; alpha bounds (149,101)-(371,431).

Outstanding acceptance:

- [ ] Continuous blend quality, facing and gameplay foot contact.
- [ ] Half-speed gameplay and death cleanup in the live renderer.
- [ ] Other enemies consuming the aura and demonstrated infighting outcomes.

Follow-up verification on 2026-10-22: 73 focused tests passed across the five
enemy directories. Changed consumer source passed scoped ESLint. No appearance
assets changed, so the transparent production preview was retained.

The actual app reached its object-data-cache loading screen; browser navigation
also timed out or was denied inside the sandbox. These attempts do not establish
continuous blend quality, facing, foot contact, half-speed gameplay, death cleanup
or rendered infighting outcomes. No acceptance box above was marked complete.

`evidence/discipline-followup-status.json` records the limits. The authored
`/map/test_enemy-discipline` fixture contains production models and HUD controls
for staging rivals, overlapping sources, interruption and range exit. It remains
unverified and depends on the sibling Crown Crab registration/model work.
Wire Gremlin has no registered production model or compatible tower mechanism;
its dispute guard is logic-tested only. No replacement asset or stand-in was added.
