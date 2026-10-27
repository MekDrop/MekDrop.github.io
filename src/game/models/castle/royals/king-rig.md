# King humanoid rig

`king.blend` is the editable source for `king.glb`. The king uses one real
armature, **King skeleton**, exported as one glTF skin with 45 joints. Preserve
his faceted face, silver hair and beard, jeweled crown, navy coat, gold details,
ermine trim, cape, and sword when editing the rig.

The bind pose is an A-pose. Blender uses Z up and the king faces -Y; the exported
glTF uses Y up and faces +Z. The existing `Seated king` root retains its authored
uniform scale. Retarget motion to the joints below rather than scaling bones or
animating rigid mesh objects. The armature's `humanoid_bone_map` custom property
provides the corresponding body-joint mapping.

| Human joint | King bone |
| --- | --- |
| Root motion | `Royal animation rig` |
| Pelvis | `Royal hips` |
| Spine / chest / neck | `Royal spine`, `Royal chest`, `Royal neck` |
| Head | `Royal head rig` |
| Left / right clavicle | `King left/right shoulder` |
| Upper arm | `Royal left/right arm rig` |
| Forearm / elbow | `Royal left/right elbow` |
| Wrist / hand | `Royal left/right hand` |
| Thigh | `Royal left/right leg rig` |
| Shin / knee | `Royal left/right knee` |
| Ankle / foot | `King left/right foot` |
| Toes | `King left/right toe` |
| Fingers | `King left/right thumb/index/middle/ring/little 1/2` |
| Cape secondary motion | `King cape 0/1/2` |

Sleeves and trousers have continuous joint surfaces and normalized blended
weights around elbows and knees. Each hand has five fingers with two articulated
segments. Boots articulate at the ankle and toe. Head ornaments retain rigid
weights so animation does not soften the original angular artwork. Cape and coat
weights preserve their broad silhouette for offline playback and fallback poses.

Sleeves continue inward through the shoulder to a chest-weighted ring embedded
in the torso. Intermediate rings blend chest, clavicle, and upper-arm weights;
the shoulder is part of the sleeve surface rather than a separate contact patch.

Each palm and wrist form one closed continuous mesh. The wrist extends 12% back
into the forearm cuff and blends from elbow to hand weights, keeping the skin
joined to the sleeve when viewed from behind or with the wrist bent.

The closed face surface includes inset temple backing beneath the separate hair
locks. Keep this underlying head volume closed; hair pieces must not conceal
missing side walls. The temple repair preserves the original front facial
landmarks and weights the complete head surface to the head joint.

The rear cape is a continuous 13 × 13 cloth sheet with its original broad folds
and two navy materials. `KingCapePhysics` gives this sheet live Ammo soft-body
motion in the game. The whole top seam is sewn to the chest; strong stretch and
bending constraints and substantial damping make it read as heavy, stiff fabric.
World-space simulation lets actual travel and turning pull the hem behind the
shoulders. Torso, lower-coat, and floor colliders keep it outside the body and
above the walking surface. The cape mesh is cloned per king; instances never share
deformation buffers. Destroying the owner restores the original mesh and skin
and releases its physics resources.

The live profile uses Bullet structural stiffness 0.99, bending stiffness 0.98,
mass 0.3, damping 0.24, and 28 position / 14 velocity iterations. It steps at
120 Hz with at most six catch-up steps per render, using a consistent 20× physics
scale for the small character. The top 4% height band includes the complete
slightly sloping collar and leaves the next cloth row free. Normal animation
changes retain momentum; teleporting or resuming a hidden king resets safely.
These are runtime settings in `KingCapePhysics.js`; no Blender cloth cache is
required by the game.

The lower-coat proxy includes the fixed gold frame, not just the navy fabric.
Its authored half-width is 0.48 and its depth spans -0.15 to +0.38 in model
coordinates. Keep its rear face ahead of the resting cape; starting the cloth
inside this proxy pushes it upward instead of letting it drape.

All 19 existing clips are embedded in the armature: `RoyalSit`, `WalkOut`, `Cry`,
`TerraceIdle`, `TerraceWalk`, and the 14 `Sword*` training clips declared by
`KingAnimation.js`. The existing performances are baked onto the anatomical
chains at 24 fps; they do not require a runtime IK solver or Blender constraints.
No third-party motion pack is bundled. External human motion must first be
retargeted using the A-pose and bone map, then baked into the source and exported.

Preserve the runtime attachment contract:

- Visible parts need a physical contact path, as well as a bone parent. The
  connected neck spans the chest opening and head; thumb roots overlap their
  palms with blended hand weights. Navy backing tabs support the collar jewels,
  a continuous gold thread joins the necklace links to both clasps, and hidden
  rear flanges seat the lower gold frame into the coat. The lip retains its
  original visible shape with a small hidden attachment to the face.
- `king-attachments.test.js` evaluates skinned triangle surfaces in a
  representative pose of every embedded clip. It rejects islands without a
  contact path to the torso; hierarchy or overlapping bounds alone are insufficient.
  Both palm surfaces must also be closed, continuous, weighted to forearm and
  hand joints, and directly touching their cuffs in every checked pose.
  Shoulder checks sample five poses per clip and require a closed sleeve with a
  complete chest-weighted cross-section inside the torso volume.
  A contact path is only a structural check: it cannot establish that a garment
  seam is visually closed. Inspect both shoulder seams from behind, including
  the seated pose with the chair present, and during arm raises and walking.
- `King sword` remains directly attached to `Royal left hand`; `King sword grip`
  and `King sword tip` remain sword-local markers.
- `Royal left/right eye` and `Royal left/right tear surface` remain direct
  children of `Royal head rig` for the tear effect.
- The weighted walking clips keep their planted-tip clearance, gradual blade
  lean, wrist give, and delayed lift. When retargeting a new walk, recheck the
  hand contact and blade tip through the entire cycle, including interpolation.
- `RoyalSit` angles the sword ahead of the boots so the lower seated grip does
  not push its tip through the floor.

Use `/map/test_king-animations?camera-test` for production-rendered review.
Its PlayCanvas HUD selects walking, sitting, crying, and training clips and
provides front, side, and back camera controls. The owning character's transparent
preview is `src/game/objects/characters/royal/king/preview.png`.

Focused checks:

```sh
node --test test/unit/game/models/castle/royals/king-skeleton.test.js test/unit/game/models/castle/royals/king-attachments.test.js test/unit/game/models/castle/royals/king-model-animations.test.js test/unit/game/models/castle/royals/royal-seated-pose.test.js test/unit/game/objects/castle/rooms/terrace/terrace-actor.test.js test/unit/game/objects/castle/rooms/terrace/king-terrace-performance.test.js
```
