# Hero animation

## Vegetation cutting

The trousers form one welded, skinned seat/crotch/thigh surface. Flexible sleeves
run from inside the tunic through the shoulder and elbow to inside each glove;
the old rigid blue sleeve meshes are replaced. Elbow covers belong to the elbow
nodes, and the lower tunic hem belongs to `Upper body`. Keeping either on its
former parent leaves floating pieces when cutting changes the arm spacing or
pelvis position. Armor, gloves and complete boots remain rigid accessories.

`Hero cloth rig` retains editable clothing weights and all 49 actions in Blender.
The scene's `skinJointTargets` export metadata maps its deform bones onto the
existing body nodes. `scripts/rebind-exported-skins.mjs` preserves the bind surface
while applying that mapping during normal export, so runtime grip and terrain
adjustments also move the cloth. Regression checks evaluate skinned vertices,
closed connected surfaces, sleeve/tunic/glove overlaps and axe clearance; rigid
joint positions alone do not establish body continuity.

Each complete boot is a rigid assembly beneath a dedicated root at its knee/cuff
joint. Cuff, shaft, straps, buckle, seam, foot, heel, sole and toe move together.
The shaft reaches the cuff opening, which encloses the knee joint.
The ankle remains a skeleton marker; it must not rotate the tall boot away from
the shin. Trouser geometry ends at the thigh instead of extending through the
boot. Cutting poses solve the leg and rigid boot together against sole contact.
Regression checks preserve both boot shape and the shin's position inside its
cuff through all 49 clips, and include the complete boots in axe-clearance checks.

The axe mounts to `Axe grip` beneath `Right white glove`, using palm offset
`(0, -0.08, 0.095)` and a 90-degree local Z rotation. Authored wrist and grip
transforms keep both closed hands on the wooden handle: the right palm is 0.08
authored units above the tool origin and the left palm is 0.06 below it. The shorter haft is 1.24 authored units. Both shoulder roots retain their neutral torso socket translations and scales in every axe clip. Reach comes from articulated arms and whole-body posture.

Seven embedded 1.5-second clips cover the 0.25-metre layers: `ChopLow`,
`ChopRow2`, `ChopMiddle`, `ChopRow4`, `ChopRow5`, `ChopHigh`, and `ChopRow7`.
The bit leads the accelerating left-to-right stroke. The brief impact pause occurs at 0.60 seconds. Damage follows the actual sharpened edge's lateral sweep
from 0.48 through 0.80 seconds (0.34 for the low stroke's earlier level approach); a missed swing
does not remove anything. The axe withdraws sideways while staying
in front of the legs, then returns to the same ready pose. The lowest cut uses a planted stance with a hip and knee bend; higher cuts rock the rigid boots around sole contacts. Pelvis height adjusts to keep the legs within reach while retaining the upper body's world pose and axe trajectory. Axe use preserves these authored foot poses while approach walking keeps normal terrain foot placement. The top cut shifts weight with the swing and looks upward rather than translating the shoulder roots.

Footwork reference: John Rhyder's [Axe Safety demonstration](https://www.woodlands.co.uk/tv/2015/04/axe-safety/), particularly the planted stance and hip/knee bend around 3:20–4:20. The game uses a horizontal slice rather than the reference's downward splitting stroke.

The vertical wind-up finishes at the contact point of the lateral arc, rather
than at the end of its follow-through. The blade stays centred on the selected
layer from 0.58 through 0.74 seconds. Verify the rendered world-space height
against the vegetation base as well as testing the exported clip in isolation.

The interaction approaches the exposed outer vegetation face, including the
remaining canopy footprint. It selects the highest remaining level and slices
its columns progressively as the blade crosses them, including each column's depth.
One stroke clears one level; lower levels remain protected through follow-through.
After recovery it recalculates that face and uses
the normal movement planner to step closer when necessary. Only the blade may
enter the active layer; the shaft must clear the plant and all lower rows.
A support-arm constraint maintains the left grip during blends without moving
the shoulder sockets or stretching either arm. During the low stance blend,
it guides the haft beside the advancing boot. Blade contact checks and grip
correction run at prerender, after the final animation pose is available.
Drawing and stowing use a compact
two-hand carry with explicit neutral Idle transforms on the remaining joints;
unkeyed Idle channels must not inherit the last evaluated cutting stance.
Different axe stances blend for 0.32 seconds, including transitions through
approach walking and drawing/stowing. Restarting a different level's clip resets
its clock without snapping its pose; a repeated stroke retains its authored seam.

Use `/map/test_vegetation-cutting?camera-test` to inspect all six variants.
The scene disables `forceAnimationSampling` to preserve the authored 240 Hz
keys. Regression checks sample the full axe mesh at 120 Hz against body meshes,
check actual blade contact, body clearance from the remaining vegetation, fixed shoulder sockets through draw/use/stow, planted toe contacts, layer clearance, finger contact, impact timing, withdrawal and loop seams. Axe use preserves the authored head pose instead of replacing it with idle gaze.

## Locomotion

`Walk` retains the previous running cycle as the walking reference: two-thirds
of a second with a 42% planted stance per foot. `Run` is a 0.625-second cycle
with a 30% stance, a visible flight phase, forward lean and bent-elbow pumping.
The planted ankle travels 0.60 and 0.68 authored units respectively. Both clips articulate the hip,
knee and ankle, lift the returning boot, and close exactly at the loop seam.
Runtime playback rate follows actual horizontal speed and the model scale.
Ground speeds are 1.8 units/second walking and 3.4 running; jump reach and
directional dodge impulses retain their separate travel speeds.
The walking reference keeps its relaxed arm swing and upright torso.
Walk and Run use Idle's pelvis origin (zero) and hip height (0.71 authored
units). Compare posture against the evaluated Idle clip, not the GLB's static
node transforms. The source scene enables `keepConstantAnimationChannels` so
exports retain the hip translations even when their values are constant.
Dropping those channels lets preceding actions supply an incompatible offset.

`HeroLocomotion` runs an independent Yuka state machine with classes under
`states/locomotion/` for idle, walking, acceleration, running, slowing and stopping.
The stopping state owns its braking timer and supporting-foot animation; action
interruptions exit this layer and reset it to idle. It selects these gaits
from actual velocity and input intent. Releasing run while still moving keeps
the running gait during deceleration, then blends into walking at walking speed.
Walk/run blends preserve the supporting-leg phase. Releasing movement from a
run plays `RunStopLeft` or `RunStopRight` for a 0.42-second braking step before
Idle; new movement immediately interrupts it. Ground acceleration and braking
have the same magnitude for cardinal and diagonal movement.

Surface alignment wraps boot geometry below the ankle. It must not rotate
or reparent the animated ankle: that changes the leg's lever arm and causes
sliding even when the exported clip has correct planted contacts.

Use `/map/test_locomotion?camera-test` for close movement review with the
production HUD controls. Exported-contact and loop-seam checks live in
`test/unit/game/models/hero/locomotion-animation.test.js`.
Motion references: [Death's Door gameplay](https://www.youtube.com/watch?v=27SQLtu8ayg&t=270s)
and [Finji's TUNIC trailer](https://www.youtube.com/watch?v=lyLkt19pUWE&t=24s).

## Flower pickup

`PickFlower` is a 1.5-second one-knee kneel, right-hand pinch, lift and recovery.
The glove reaches the stem base 0.25 metres ahead and 0.04 metres above
the ground at 14/24 seconds, using the production hero scale of 0.65.
Flower grip points compensate for each variant's vertical scale. The left foot
plants forward while the right knee lowers and the rear boot rolls onto its toe.
The spare hand braces on the raised left knee. Fingers close
for the pickup and release as the flower enters the inventory.

Each animated object has one `PickFlower` NLA track. The action keys the
object's active rotation mode, with continuous Euler branches between samples,
and restores the shipped Idle pose at both endpoints. Duplicate neutral tracks
can override the reach; discontinuous Euler angles can flip the knees between
otherwise correct keyframes.

Use `/map/test_hero-pickup-items?camera-test` for all flower variants and
`/map/test_inventory-on-flower?camera-test` for the real approach, pickup and
inventory transfer. Review complete cycles around the hero at normal, low and
high camera elevations. The focused exported-animation test checks stem contact,
front-foot support, the lowered right knee and recovery in `test/unit/game/models/hero/`.

## Mushroom harvesting

`PickMushroom` is a four-second forward hip bend, short lateral slice, knife withdrawal,
lift and recovery. The right glove grips a smaller horizontal knife; the left
hand steadies the mushroom. Cutting runs from 30/24 to 42/24 seconds, then the
knife withdraws before lifting starts at 1.95 seconds. The knife is hidden at
2.3 seconds, the carry phase begins at 64/24, the held visual is hidden
at 82/24, and the hero returns to Idle at 96/24. Collection is committed once,
at the end of the cut.

The collecting state exposes approaching, reaching, cutting, withdrawing,
lifting, stowing and recovering phases. Approach time does not advance the
cut clock. The clip owns the head and boots during harvesting. The feet stay
near hip width, with a short forward step and flexed knees supporting a
roughly 47-degree hip bend. The tunic flap hinges clear of the front boot.
The torso stays behind the cap,
and the lifted item turns with the supporting wrist outside the body while
its cap stays upright. The grip uses the model's facing, including when it
differs from the hero root's rotation.

Working distance and held-item grip follow `HERO_MODEL_SCALE`; debug actors
use the production scale. `/map/test_inventory-mushroom?camera-test` exercises
the real interaction; `/map/test_hero-pickup-items?camera-test` covers variants.
The exported-animation tests check blade contact, short stroke length,
stationary support during cutting, boot height, lift order and recovery.
Action tests cover withdrawal, tool visibility and slow-frame collection.
The posture reference is the forward reach at 21:15–21:20 in
[the user's harvesting video](https://www.youtube.com/watch?v=0saa8VY7DcA&t=1274s).

## Treasure chest opening

`OpenChest` is a 1.8-second, non-looping two-handed reach and lift. The hero
faces the chest and approaches a stance 0.535 metres from its centre. Hand
contact at 0.65 seconds starts the chest's 0.62-second lid animation; both
arms follow the rising front edge before releasing and returning to Idle.
The normal collection action blocks movement until recovery finishes.
Use `/map/test_treasure-opening?camera-test` and the four camera HUD buttons
to inspect the actual dig-to-open interaction from every quarter turn.

## Idle breathing

`Idle` and `BoredCursorLook` keep the animation rig at unit scale, with only
0.002 source units of breathing lift. Scaling or lifting the entire rig more
strongly fights the runtime planted-boot correction and makes the upper body
appear to pump up and down. Arm, hand and leg motion remains authored in the clips.

## Digging

`Dig` contains eight 1.6-second strokes around the hole perimeter (12.8 seconds
in total). Each plant occurs 0.6 seconds into its stroke. The hero stays in place,
with planted ankle contacts, and changes torso bend, shovel angle and guiding-hand
position to reach the far, near and side edges. Every stroke returns to the same
carry pose. The treasure action applies one impact per stroke and completes after
eight impacts; the cavity widens as work progresses.

`DigOpposite` preserves the planted contacts and changes the carry and release
to the supported mound across the hole when a terrace edge blocks the normal
throw side. The interaction selects the clip at contact without resetting the
stroke clock. Released soil uses that same mound offset. Character variants
without calibrated opposite throws retain their existing digging clip.

Each stroke plants at 0.60 seconds, picks up the authored soil load at 0.64,
lifts it along an outward arc through 1.04, and tips the blade through 1.18.
At 1.23 seconds the load becomes seven pooled Ammo clods; the empty shovel
returns to carry by 1.60. The pickup and return use different paths.
`ShovelSoil` owns fourteen reusable bodies and a private flat landing contact
beside the hole. The spoil pile follows the hero's facing direction. Clods
settle under gravity, shrink after 1.65 seconds and expire at two seconds;
interruptions drop a carried load and tool destruction releases the pool.
Rock-blocked strikes do not produce fresh soil. Filling scoops existing soil
at 0.40 seconds, carries the authored load on the blade, and tips it into the
cavity at 1.03 seconds. The falling soil uses the same pooled Ammo bodies;
it starts at the blade rather than flying from the mound. The pile loses
volume at pickup, and the filled surface rises after the short drop.
Filling uses two scoops from the mound, then a `LevelHole` stroke that pushes
the remaining raised rim into the cavity and presses it flat. This 3.2-second
finish reaches the right, left, and far edges in turn and scrapes each toward
the centre before tamping. Each rim sector deforms during its matching scrape.
  The shaft angles toward each contact rather than remaining upright. Soil
  arrival pauses between scrapes, and the cavity lip folds below the filled
  surface along with the rim. The filled-earth footprint covers the excavation
  so the last tamp does not leave a dark edge that disappears at completion.
The finishing stroke
carries no fresh load. Its authored rim animation follows blade contact; the
cavity closes only after the edge soil has settled.
Interrupting a carried scoop restores it to the pile.

Before summoning, the treasure interaction checks a short approach to a stance
0.535 world units from the hole center. That distance matches the plant circle
measured on the rendered hero; recalibrate it when changing hero or tool scale.
The approach finishes before digging starts, and the feet stay planted during use.

The shoulder roots remain at their original body attachments. Authored sleeves,
elbow pivots and forearm cuffs form a continuous reaching chain; rounded wrist
junctions keep the cuffs joined to the palms while the hands rotate on the shaft.
Shoulder plates remain seated on the torso. Other clips explicitly restore the
original sleeve, cuff and plate transforms.

`SummonShovel` and `DismissShovel` connect Idle to the common carry pose.
`FillHole` uses a baked scoop, lift, carry, tip, and empty return sequence.
Both hands remain on the shaft as the blade enters the near face of the pile
and travels over the cavity. The closed fingers, wrist rotations and
both arm chains are baked into the model. The shovel mounts to
`Right white glove`, with its grip 0.07 source units below the wrist. Its D-grip,
ash shaft, reinforced socket and cupped round-point blade are authored in the
adjacent tool asset. Axe tools retain their existing attachment and clips.
The shovel becomes visible 0.1 seconds into summoning.

Use `/map/test_hero-dig?camera-test` and its Dig, Fill and Stop HUD buttons to
check repeated cycles and transitions. Press E for the actual treasure interaction:
the hole stays ahead of the hero. Verify the complete cycle with continuous
360-degree camera rotations at normal height and from below. Check the shoulders,
cuffs, palms, shaft, blade, legs and hanging cloth throughout the motion, rather
than accepting wrist coordinates or a single view as proof of clearance.

## Waist belt

The leather belt is a continuous thin strap around the tunic's chamfered waist,
with front, side and back surfaces. Its inner contour follows the measured
tunic bevel, including the full corner chamfer, instead of bridging the corners. A shallow open brass frame and tongue sit
on the front strap; the strap remains visible through the buckle. The adjacent
leather keeper holds the closure against the waist. All parts share the torso's
authored animation parent.

## Hanging tunic flap

The blue chest panel follows the tunic's side and upper bevels. Its gold edging
uses adjacent faces of the same sheet, with shared vertices and no overlapping
blue polygons beneath the gold, preventing depth fighting and floating strips. The lower
red panel and its edging are also single-surface fabric. The panel extends up
beneath the belt and overlaps the fitted tunic. Ammo pins only the sewn top
edge directly to the fitted tunic, independently of the animated flap hinge.
Rows below that seam remain free so a raised thigh can push them outward.

Only `Red lower tunic flap` uses cloth physics. The fitted tunic, belt and
other clothing retain their authored rigid meshes. The flap has a thin,
subdivided surface; its sewn edge follows the torso, while Ammo soft-body links,
bending constraints, gravity and animated leg/boot colliders drive the free fabric.
The attached gold piping follows the simulated panel. Removing the hero restores
its original meshes and releases the simulation and collision bodies.

The digging stance keeps the fixed seam ahead of the thighs, uses a shallow knee
bend, and maintains both glove contacts on the shovel. Cloth contact simulation
uses enlarged internal units for Ammo's sparse distance-field precision; rendering
and authored model coordinates keep their original scale.
Animated colliders and seam attachments interpolate through each physics substep
to avoid tunnelling during fast leg swings. Walk and run keep the pelvis high
enough that the fixed seam remains outside the thighs throughout the cycle.

## Articulated gloves

Both ivory gloves have five human-like digits: four tapered, three-joint fingers
and a two-joint opposing thumb. Their proportions keep the rounded, angular
character style. Palms are broad enough to balance the cuffs, with fuller,
overlapping knuckles and rounded fingers rather than narrow segmented tubes.
The existing `Left white glove` and `Right white glove` roots
retain their attachment origins for tools, rope contacts and hand colliders.
Idle and ordinary locomotion turn the palms toward the thighs, with the thumbs
forward and tucked in and a progressively deeper curl toward the little finger.
Both wrist rotations are explicitly keyed in every clip so action transitions
restore the correct orientation rather than retaining the previous wrist pose.

Finger rotation is authored in every existing NLA clip and exported in the same
named GLB animation. Idle and locomotion gently flex the fingers; tool actions
close the grip, pickups pinch, climbing alternates grasp and release, and the
lava farewell uses a raised-thumb fist. Every clip owns all finger channels so
transitions back to Idle release the previous grip. The old separate farewell
thumb is replaced by the articulated right thumb.

`LavaFarewell` lasts 4.2 seconds. The torso leans below the extended right arm,
then the closed fist opens its thumb after the head passes below the lava.
Runtime sinking continues smoothly as the head and then the hand disappear.
Keep all farewell NLA channels extended through frame 100.8 at 24 FPS so the
body does not return to its rest transform during the hand-only hold.
Each object owns one complete `LavaFarewell` NLA strip, including its rotation
channels. Splitting translation and rotation across tracks with the same name
can export a frozen pose. The wrist turns as the thumb opens to keep the gesture
upright and readable above the lava. The thumb points vertically upward from
the closed fist and stays locked through the final sinking motion. The hand
continues descending without pausing or releasing the pose.

## Climbing

`hero.blend` contains the looping `Climb` action as named NLA tracks on the
existing articulated object hierarchy. Alternating arm and leg reaches are
authored on the shoulders, elbows, hips, knees and ankles. The GLB exports them
as one `Climb` clip; runtime playback follows movement speed and pauses when
movement input stops.

`ClimbTop` and its mirrored `ClimbTopRight` contain baked hand and foot contacts:
brace on the ladder/frame, lift and plant the leading foot, transfer body weight,
bring the trailing foot across, and settle into the exact Idle pose. Each clip
has 97 samples over four authored seconds. Runtime samples the first 40% by
height over the final 0.9 metres and the remaining 60% through a 2.2-second
contact sequence. Its staged body path matches the baked leg compensation;
collision delays the sequence if the capsule cannot follow that path.
Descending reverses this motion. The hero clears the lid, turns toward the exit
while a foot supports the body, and settles into standing. A bounded visual root
correction absorbs small capsule nudges at the rim to preserve baked contacts.
The torso lean stays within 20 degrees so the reversed descent reads as a
controlled crouch rather than tipping sideways over the opening.
Releasing movement while crossing the hatch finishes that crossing: ascent
reaches the supported roof landing, and descent continues until the entire
hero is below the roof. Pausing on the rungs remains available below that zone.
Roof exits sit beside either rail, beyond the hatch frame. Sideways movement
at the top selects the exit, and either side also provides a descent approach.

Every other action explicitly resets each rotation changed by `Climb`, including
the shoulders, hips and upper body. Resetting only elbows and knees leaves
the shoulders raised after returning to Walk or Idle.
NLA tracks are muted in the saved source so its default pose stays at rest;
the exporter still gathers their actions. Keep the adjacent GLB and editable
source together when changing animation.

Use `/map/test_ladder-climb?camera-test` for the authored ladder test map.
Its HUD buttons place the hero at the lower or upper landing. Ordinary movement
attaches to the ladder, backward movement reverses traversal, and sideways
movement or jumping detaches. Reaching a landing requires releasing movement
before the ladder can attach again.

`RingBell` is a 2.2-second, non-looping right-hand rope pull. The hero first
approaches the bell through normal capsule movement, then reaches at 0.5 seconds,
draws the rope toward the body through 0.9 seconds, releases at 1.2 seconds, and settles back into
Idle. The bell prop uses the same timeline; its strike sound occurs at 0.9 seconds.
The stance sits 0.45 metres in front of the bell and 0.1 metres to its side,
keeping the head clear of the bowl and the capsule clear of the frame feet. A baked shoulder turn
and slight lean carry the reaching glove to the hanging knot before contact; the rope
only attaches within the glove's grasp, then follows the simulated pull.
The hand follows a 0.5-metre arc below the animated attachment, preserving rope
length rather than stretching the joints with a straight downward pull. The head
counterturns to keep looking toward the rope as the shoulder reaches.
The exported arm motion is baked from two-link contacts, with the standing pose
explicitly keyed on the remaining animated joints. Teleporting, losing support,
or a blocked approach exits the action and releases the bell reservation.
The string has a knot at the grip and a loose tail. Ammo ball joints simulate
the rope in the game's physics world, with its top following the bell clapper.
From 0.5 to 1.2 seconds a temporary joint attaches the grip to the actual right
glove. Release or interruption removes that joint so the rope swings and settles
under gravity. Only the hero and bell bowl retain authored motion; the exported
bell clip contains no rope tracks. Existing hero clips retain their original
24 fps timing.
