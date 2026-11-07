# Bell bug segmented model and rig

The current model comes from Tripo3D's Generate in Parts / Detailed job
`dc6e9cd2-5deb-48d3-8e5f-d90c709a1d4a`, using the sharpened reference.
Its 133 segments are grouped into a shell, body, head and one complete sharp
leg prototype. Native Blender materials restore the gold panels, charcoal body,
warm eyes and brown armor. The untouched provider GLB and receipt are retained
under the owning object's `evidence/tripo-parts` folder.

Exactly six legs share that same mesh, three per side, mirrored left/right.
Their width and thickness are multiplied by **0.77** (23% slimmer); height is
unchanged. Each leg is rigidly parented to its own bone. Do not add per-object
vertex groups to the shared mesh: mixed shared weights previously distorted it.

Six separate charcoal hip links bridge the moving feet to the nearest visible
carapace surface. Front links follow `head` (the visible front body segment);
middle and rear links follow `body`. Each inner cap extends 0.035 m into that
surface with a flared socket, avoiding a tangent edge or a hidden belly anchor.
The outer end follows its leg bone and the middle blends between the two.
Feet remain rigid shared instances. All six links retain at least 0.025 m of
overlap through 810 sampled poses across all 27 clips, including a fresh GLB
import. Checks track the actual visible surface and the buried cap separately.

The ten bones are `root`, `shell`, `body`, `head`, and `leg_L_0` through
`leg_L_2` / `leg_R_0` through `leg_R_2`. The body has its own bone so the belly
can withdraw while the shell stays intact. The original 24 action names remain;
three new embedded clips provide retraction:

| Clip | Duration | Behavior |
| --- | --- | --- |
| hide_start | 0.6 s | Retract head, body and six legs; settle the bell onto the ground |
| hide_loop | 1.0 s, looping | Hold everything inside the shell |
| hide_end | 0.6 s | Emerge and return to the normal stance |

Bell panic sequences these clips within its existing duration. Ring, stun,
tower-delay and diminishing neighbor bonuses retain their timing. Dynamic
vibration remains on the wrapper. Retraction uses bone translation, not
visibility toggles; the feet retain unit scale.

Walk/run retain alternating tripods: L0 + L2 + R1, then R0 + R2 + L1.
Feet spend 62% of a cycle planted. Walk is 14/30 s with a 0.16 m stride; run
is 9/30 s with a 0.20 m stride. Playback follows horizontal travel speed.
The three `door_scratch_*` clips now rear the body by 55 degrees about the rear-hip line. Only the rear pair stays planted; the middle and front pairs lift, with alternating vertical front-foot strokes. Runtime surface targeting can refine those strokes without changing the authored support stance. Start/loop/end keep their existing frame ranges and export timestamps.

Brown foot armor clears the bell rim in the standing and locomotion poses.
The paired stance moves the front, middle and rear feet outward by 0.02,
0.18 and 0.24 m respectively; all six still use the same unchanged foot mesh.
The hip links are rebuilt to meet those positions. Hide clips compensate for
the stance adjustment, preserving the original fully retracted foot positions.
Run swing clearance is 0.039 m, retaining the original stride and tripod timing.
On stairs, the visual body stays above the highest planted foot and terrain
correction only extends feet downward, preventing uphill feet entering the rim.
See the owning object's `evidence/shell-clearance` for fresh-import intersection
checks, attachment checks, and actual game recordings.

Game instances use a uniform 0.605 scale on the imported visual hierarchy,
with proportionate collider dimensions and animation stride calibration.
The native skeleton and mesh proportions remain unchanged. The animated
footprint fits one path tile, including turns; the measurements and real-game
tile, crowd and stair checks are under `evidence/tile-fit`. Bell Bugs leave
foot room behind other enemies rather than driving their capsules into them.

Use `/map/test_enemy-bell-bug` and its Bell Bug shell panel to inspect hiding
or trigger the full response. Focused checks verify six shared rigid feet,
grounded tripods and continuous retract/hold/emerge poses. Clip inspection
resets the animation layer before restarting, preventing stale crossfade
clips from crashing the Engine controller.

Rear-stance validation: 123 native and fresh-import fractional-frame samples keep rear-foot drift below 0.00115 model units (0.70 mm at gameplay scale), front-foot clearance above 0.5747, and middle-foot clearance above 0.3497. The shell remains above 0.0565. All six hip connectors retain their 0.035 m buried body anchors; sampled endpoint error stays below 0.000001. The six feet still share one rigid mesh, all 27 clips remain, and the other 24 native actions retain unchanged keyframe hashes. Metrics are recorded in `door-scratch-stance.json`.
