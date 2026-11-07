# King humanoid rig

`king.blend` is the editable source for `king.glb`. The king uses one real
armature, **King skeleton**, exported as one glTF skin with 46 joints. Preserve
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

The runtime simulates the continuous mantle with Ammo through `KingCapePhysics`. Embedded cape bones supply initialization poses; gravity, body collision, and inertia drive subsequent cloth motion.

The mantle side panels and their rear trim retain cape deformation. The side sections are welded into the mantle mesh along shared edge vertices, with three columns of geometry blending toward the front trim. The original separate wool side boxes are removed, so the garment has no independently deforming join. The waist band follows `Royal hips`; articulated sleeves retain shoulder, arm, elbow, and chest weights.

The rear cape is a continuous 13 × 13 cloth sheet with its original broad folds
and two navy materials. `KingCapePhysics` gives this sheet live Ammo soft-body
motion in the game. The whole top seam is sewn to the chest; strong stretch and
bending constraints and substantial damping make it read as heavy, stiff fabric.
World-space simulation lets actual travel and turning pull the hem behind the
shoulders. Torso, lower-coat, and floor colliders keep it outside the body and
above the walking surface. The cape mesh is cloned per king; instances never share
deformation buffers. Destroying the owner restores the original mesh and skin
and releases its physics resources.

The live profile uses Bullet structural stiffness 0.99, bending stiffness 0.08,
mass 0.3, damping 0.22 while moving (0.85 during seated rest), and 28 position / 14 velocity iterations. It steps at
120 Hz with at most six catch-up steps per render, using a consistent 20× physics
scale for the small character. The top 4% height band includes the complete
slightly sloping collar and leaves the next cloth row free. Normal animation
changes retain momentum; teleporting or resuming a hidden king resets safely.
These are runtime settings in `KingCapePhysics.js`; no Blender cloth cache is
required by the game.

Link and bending rest lengths come from the authored bind geometry; live node positions start in the current animation pose. The lower-coat collision proxy is calibrated with the hips' inverse bind matrix, so initializing in a seated pose cannot raise the proxy or bake a seated fold into later standing motion.

The lower-coat proxy includes the fixed gold frame, not just the navy fabric.
Its authored half-width is 0.35 and its depth spans -0.25 to +0.25 in model
coordinates. Keep its rear face ahead of the resting cape; starting the cloth
inside this proxy pushes it upward instead of letting it drape.

All 28 clips are embedded in the armature: `RoyalSit`, `WalkOut`, `Cry`,
`TerraceIdle`, `TerraceWalk`, `GroundSitDown`, `GroundRest`, `GroundStandUp`, and the 15 `Sword*` training clips declared by
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

The simulated mantle carries an additional 0.15 mass budget distributed over fur attachment nodes. Nearby fur vertices follow those same simulated nodes, while unrelated collar/coat trim retains normal skinning. Teardown restores both cloth and trim meshes.

Fur and dark hem details are attached per connected component (including duplicated shading seams). Only cape-weighted components bind to the live cloth; coat and chest components retain their authored skinning. Spots share their parent fur block's cloth anchor. Rigid frames follow the live cloth tangent and normal, preserving each original block's dimensions while rotating with the fold. Floor clearance is measured from those rotated vertices, so the full piece remains above the support surface. The torso collider is measured from the complete navy torso mesh, excluding the separately hinged lap panels, so a seated fold cannot enter the back of the body.

The lower fur follows the actual boundary segments of the live Ammo drape. It does not jump onto an interior fold. Bullet distance constraints reinforce the lowest fifth of the mantle, representing the thick fur seam while the fabric above remains flexible. Chunky blocks follow rigid outward ribbon frames with twenty percent tangent overlap between neighbors; spots share their parent block's attachment. A shallow backing overlap of at most 0.023 model units sews the fur into the cloth instead of floating the whole block outside it. Opening trim receives the same outward-facing attachment treatment. Whole-component floor clearance keeps the trim above the support plane. The front trousers receive no trim.

The continuous mantle is sewn along the collar and the front opening edges, matching its original body-attached side panels. Rear panels and hem remain simulated. Actor-level yaw changes remain bounded; the authored training pivots play from the embedded clips.

The terrace routine uses separate Yuka exercise states: `KingSwordCombinationState`, `KingAdvanceRetreatState`, `KingHalfTurnState`, `KingJumpSpinState`, and `KingGuardPracticeState`. Each plays its own nonlooping, guard-ended clip from the editable model. Completion randomly selects any other exercise with equal probability; no immediate repeats or mid-exercise random interruptions. `SwordTrainingDrill` remains the continuous 19.958-second authoring reference. It advances into an overhead cut, recovers to guard, thrusts, then withdraws. A second footwork passage takes three alternating steps forward, thrusts from guard, and takes three steps backward to the opening stance. Foot contacts are baked in Blender; the runtime adds no translation or random pose changes. The rear ankle stays planted during the opening sword exercise, and both feet return to their starting contacts. Air swings are silent. Stone footsteps play at the baked landings at 1.55, 5.15, 7.2, 8, 8.8, 10.2, 11 and 11.8 seconds; planted feet produce no repeated steps. The terrace has a stone floor.

The routine occasionally adds two quick 180-degree step turns (12.65–14.85 s), with a brief backward-facing guard between them. The jump takes off at 16.45 s, completes one 360-degree rotation while airborne, and lands at 17.25 s with a short knee compression and recovery. The loop ends in the original guard and floor contacts. Footsteps include turn-step landings at 13.05, 13.5, 14.4 and 14.85 s, plus the jump landing at 17.25 s; air swings remain silent.

Training stamina drains over 65 seconds of active exercise and scales drill playback continuously from full speed to 45%. Exhaustion waits for the completed exercise before the 1.5-second `GroundSitDown`. Only the seated `GroundRest` loop recovers stamina, over 6 seconds; `GroundStandUp` finishes before full-speed training resumes. Cancellation uses the stand-up before departure. Paused reactions do not advance fatigue or recovery.

The lower front coat and its gold ornaments share `King lap cloth`. Standing exercises fold that joint only where leg clearance requires it, with anticipation and settling around the contact. Ground recovery gathers the thick lower panels around the front waist, compressing their empty depth into a seated fold. The torso and shoulder seams retain their original binding. Ground contact limits sewn mantle edges at floor level while the remaining cloth settles through the existing simulation.

Ground recovery lowers the pelvis to 0.16 model units, extends both legs forward with supported heels, and plants the open right palm behind the body. The sword hand rests ahead of the folded coat with the blade horizontal. The descent and rise use outward stepping arcs to clear the robe; the resting hips, heels, and supporting palm stay fixed while the chest breathes. Half-open eyes reinforce fatigue during descent and rest. The six-second stamina recovery and existing clip durations remain unchanged.

For seated hems, the cloth world uses a convex floor box. Moving zero-mass seams can exceed Bullet's contact tolerance, so a narrowly bounded post-step floor projection resolves remaining penetration and removes only downward contact velocity. Gravity, inertia, links, and body collision remain Ammo-driven. The seated-recovery regression checks floor support through descent and rise.

During `GroundRest`, slow fur-bearing hem nodes within 0.012 model units of the floor receive temporary zero-mass supports in Bullet, compensating for missing static friction at shallow SDF contacts. Intermediate cloth stays free to drape before settling. Supports preserve the small folds' settled height rather than flattening them. The upper mantle continues simulating with increased damping to suppress residual vibration. Supports preserve each node's mass and release before standing, root movement, teleport, or resume; the cape is never reset to its authored pose to stop motion.

After one continuous second below the mass-weighted resting velocity threshold, Bullet puts the settled cloth to sleep. Lower side seams hold their settled positions; the collar still follows breathing. Standing, root motion, or live seam movement exceeding 0.006 model units wakes the cloth and restores its dynamic masses before solving.

The cloak hem repeats the original character's chunky fur components: thirteen alternating ivory-ermine/fur-tip blocks continue around the rear, with four original black-spot meshes. These copy the original vertices, faces, and materials, preserving their shapes and dimensions. Lower side and front-corner pieces bind to `King cape 2`, not the lap/trousers, so the opening corners stay with the cloak. The exposed front trousers have no added fur. The experimental flat and extruded continuous bands are removed. Floor support includes the measured downward extent of each attached piece, keeping the complete fur blocks above the floor.

The front opening fur includes one matching bridging block at each lower corner, extended vertically to overlap its neighbors during motion, closing the authored gap between the vertical trim and the bottom row. Both bridge blocks bind to `King cape 2`; no fur is added over the trousers.

The collision review covers six engine-rendered views per action and checks the
exported mesh surfaces at authored frames and interpolated midpoints. Sword-hand
clearance is baked into the arm chain; the blade no longer passes through the
face or bodice. The front coat and its ornaments fold together clear of the
boots, including the ground-seated pose.

Half turns use an outside stepping arc, a lowered weight-transfer stance, and
an anatomical two-bone leg solve. The second half turn leads with the right
foot. Support contacts remain fixed while the other foot steps. The source and
export use 48 fps sampling, with continuous quaternion signs and linear baked
channels to preserve the fast turns between frames.

The front hem and its gold details share an affine height adjustment so the trim remains on the cloth surface. Leg chains keep boots and seated knees above the bind-pose sole plane. The mantle physics measures that same plane from the unskinned boot vertices, including model scaling; animated foot lifts do not move its floor.
