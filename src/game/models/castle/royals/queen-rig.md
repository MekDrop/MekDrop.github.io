# Queen rig

`queen.blend` is the editable source for `queen.glb`. The queen retains the
faceted royal palette, silver curls, sapphire crown, indigo bodice, ermine,
gold details, and panelled gown. Joint surfaces and hands were rebuilt to
support an anatomical skeleton. The export has one skin and 286 joints,
including 240 fabric joints.

Blender uses Z up and -Y forward; glTF uses Y up and +Z forward. Preserve the
`Seated queen` root scale and the existing semantic attachment names.

| Body part | Bone |
| --- | --- |
| Root motion | `Royal animation rig` |
| Pelvis, spine, chest, neck | `Royal hips`, `Royal spine`, `Royal chest`, `Royal neck` |
| Head | `Royal head rig` |
| Clavicles | `Queen left/right shoulder` |
| Upper arms, forearms, wrists | `Royal left/right arm rig`, `Royal left/right elbow`, `Royal left/right hand` |
| Thighs, calves | `Royal left/right leg rig`, `Royal left/right knee` |
| Ankles, toes | `Queen left/right foot`, `Queen left/right toe` |
| Fingers | `Queen left/right thumb/index/middle/ring/little 1/2` |
| Gown | `Queen gown <row 00–09> <sector 00–23>` |

The skeleton's `humanoid_bone_map` property records body mapping. Sleeves and
stockings use blended weights around elbows and knees; head ornaments remain
rigid. Every hand has four separated fingers and an opposed thumb, each with
two articulated segments. Wrist and face anchors retain the attachment contract
for books, tears, and resident behavior. The seated wrists now rest palms-down
on the covered thighs, with an upright eight-degree torso lean.

`Queen continuous body` is a closed, connected navy undergarment surface from
the lower abdomen through the pelvis, seat, crotch, thighs, knees, and calves.
It replaces the two disconnected stocking tubes, with normalized blended
pelvis/leg weights. Preserve
this body when editing the gown; the skirt is not a substitute for anatomy.
The reading and reclining legs have a small asymmetric knee bend, and the
fabric is fitted against the actual underlying body. The hem tapers around
the ankles; the gown includes a thin navy inner lining and a closed fabric rim.

Her underclothes are fantasy medieval linen drawers with loose mid-thigh legs,
a gathered waistband, and a small tied drawcord. Unbleached linen and subtle
fold shades contrast with the navy stockings. The drawers share the continuous
body surface and skin; the waist tie follows the pelvis. They remain visible
with the `Body / dress` review toggle and require no new animation clips.

All eight original clips are embedded: `RoyalSit`, `WalkOut`, `Cry`,
`TerraceIdle`, `TerraceWalk`, `TerraceMountSunbed`, `TerraceRecline`, and
`TerraceRead`. Seated thighs remain approximately horizontal in world space
despite the reclined torso; the calves hang down. Reclining extends the legs
beneath the gown. Crying and walking use standing legs.

The gown is a continuous open surface with 24 sectors and 10 rings. Gold seams
and hem share the corresponding fabric joints. Seated rings travel over the
thighs, around the knees, and down the shins; reclining rings wrap around the
extended leg chain. The rear fabric follows underneath the legs rather than
remaining at the waist as a curtain. The seated hem clears the shoe uppers.
Waist attachment, gravity, inertia, body/pelvis/floor contact, and self-collision
are processed with Blender Cloth and baked to the skeleton. Authored pose shapes
blend with 25% smoothed solver detail to preserve lap coverage and avoid spikes.
Runtime playback requires no cloth solver. This is authored clip motion;
arbitrary runtime wind and collision do not resimulate the dress.

Cloth settings: Blender 5.2.1, 24 fps, 24 preroll frames, 16 quality steps,
mass 0.10, tension/compression 45, shear 25, bending 0.8, collision distance
0.006, self-collision distance 0.005. The top waist ring is pinned at 1.0,
the following ring at 0.4, and the remaining fabric is free. A fixed standing
rest shape preserves spring lengths; dynamic rest lengths are disabled.
Solver displacement is spatially smoothed and limited to 0.10 before the
25% blend, giving at most 0.025 authored units of secondary displacement.
Loop endpoints settle back to the starting cloth pose. No stochastic forces
are used.

Reproducible simulation scenes, disk caches, raw samples, solver manifest,
fresh-import metrics, production screenshots, and a complete motion recording
are retained in ignored `tmp/queen-drape-v3/` (earlier revisions remain in
`tmp/queen-rig-review/` and `tmp/queen-drape-v2/`). The final `.blend` and GLB
contain the baked result and are independent of those temporary caches.

Use `/map/test_queen-animations` to review every clip with PlayCanvas HUD
selection and front/side/back camera controls. The owning object's
`preview.png` is captured from production PlayCanvas meshes and materials
with a transparent background.

The `Body / dress` review button toggles the skirt and sewn trim, exposing the
navy undergarment for anatomy checks. Current dressed/undressed front, side,
and back evidence and reading-fit metrics are in ignored `tmp/queen-body-v4/`.

Reference comparison: [FFVII Remake's developer breakdown](https://cgworld.jp/feature/202012-ffvll-02.html)
shows Aerith's seated skirt, Bonamik physics controls, and the use of authored
pose shapes blended with physics for difficult contact poses. The queen's
seated knee coverage, continuous hem, and separation between supporting body
shape and secondary motion were checked against that example. Her narrower
chair pose and faceted style remain intentionally different. [Alice gameplay](https://www.youtube.com/watch?v=m1sI8ovRIFY&t=135s)
was inspected for skirt response while moving; [MadnessPatch's implementation notes](https://github.com/Wemino/MadnessPatch#high-fps-fixes)
confirm the game has dress physics. Reference images are review-only and are
not bundled with the game.

Focused checks:

```sh
node --test test/unit/game/models/castle/royals/queen-skeleton.test.js test/unit/game/models/castle/royals/royal-seated-pose.test.js test/unit/game/objects/castle/rooms/terrace/terrace-actor.test.js
```
