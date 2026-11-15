# Princess rig

`princess.blend` is the editable source for `princess.glb`. Preserve the existing
faceted royal style and semantic attachment names when editing it.

The model uses one 675-bone skeleton. Body surfaces use normalized rigid weights
to preserve the angular artwork. The skirt uses a continuous 32 × 17 cloth
surface and 544 sampled deformation joints. Blender cloth caches provide folds,
gravity, leg response, and settling; seat contact is corrected before baking.
The narrow gold ribbons share those cloth joints and follow the fabric. The gown
has an open hem and complete stockings and slippers underneath it.

- `Royal animation rig` owns posture; `Royal head rig` carries the head and crown.
- `Royal left/right leg rig`, `Royal left/right knee`, and
  `Princess left/right foot` articulate the legs and ankles.
- `Royal left/right hand` remain runtime attachment nodes. Each hand has thumb,
  index, middle, ring, and little fingers with two bones per digit.
- `Princess cloth <row> <sector>` carries the baked fabric and sewn gold trim.
- `Princess gown <ring> <sector>` retains the original waist attachment controls.
- `Royal face` is one closed skin volume, with cranium depth and a jaw joined
  to the neck; its front facial landmarks remain in their original positions.
- `Princess connected scalp` is the hair cap over the full head and overlaps the curls.
  It follows `Royal head rig` rigidly, along with the upper hair. The upper side
  curls overlap the fringe at both temples; keep this join closed in profile.
- `Princess rear hair drape` moves only the lower rear curls behind the chair back;
  its influence fades to zero at authored height 1.0 so it cannot pull the scalp apart.
- `Princess handkerchief grip` carries the handkerchief. `RoyalTears` controls its
  visibility and uses the eye/cheek anchors under `Royal head rig`.

Embedded clips: `TerraceIdle`, `TerraceWalk`, `TerraceSit`, `TerraceDrink`,
`RoyalSit`, `WalkOut`, and `Cry`. `TerraceSit` is a two-second transition with
anticipation, backward weight transfer, lap hands, and fabric settling over
the chair. The cloth is pinned at the waist and drapes around the lap and seat
edge; the rear waist stays ahead of the lower backrest. A 0.012 authored-metre
contact allowance leaves space for fabric beneath the thighs.
Its last frame matches `RoyalSit` exactly. Reverse the transition to stand;
`WalkOut` starts from that same seated pose before getting up and walking.
Her short legs hang naturally from a chair, with slippers visible below the skirt.

The transition starts 0.70 authored metres in front of its chair anchor.
`TerracePrincess.sittingApproachDistance` converts that distance into world units;
terrace navigation approaches there and transfers the stand-up offset back into
the actor before walking away. Do not lower the entire seated root to ground the
slippers: that pushes the hips through the chair and the hands below the lap.

Use `/map/test_princess-animations` to review idle, walking, sitting, and crying
through the PlayCanvas HUD. The chair and timber platform are ordinary map
objects. Front, side, and back controls use the normal game camera.

The owning object's `preview.png` is captured from production PlayCanvas meshes
and materials into a transparent target, without scenery or HUD. Refresh it when
the model's appearance changes.

Focused checks:

```sh
node --test test/unit/game/models/castle/royals/princess-skeleton.test.js test/unit/game/models/castle/royals/royal-seated-pose.test.js test/unit/game/objects/castle/rooms/terrace/terrace-actor.test.js
```

Cloth provenance: Blender 5.2 Cloth solver, 24 fps, 544 vertices, 16 quality
steps, mass 0.16 kg per vertex setting, tension/compression 25, shear 12,
bending 1.0, 0.003 m collision distance, self-collision 0.004 m, fixed seed
(no stochastic forces). The waist is pinned; stockings, slippers, pelvis,
chair, and floor supply collision contacts. Sit cache has 48 preroll frames
and 48 settling frames; walk cache spans five gait cycles. The editable
simulation scenes, disk caches, raw samples, and review captures are retained
in ignored `tmp/princess-cloth-review/`. Runtime uses the baked skeleton and
does not depend on a Blender cache or a runtime cloth solver.
