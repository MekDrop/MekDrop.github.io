# Hero animation

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

Each stroke plants at 0.60 seconds, picks up the authored soil load at 0.64,
lifts it along an outward arc through 1.04, and tips the blade through 1.18.
At 1.23 seconds the load becomes seven pooled Ammo clods; the empty shovel
returns to carry by 1.60. The pickup and return use different paths.
`ShovelSoil` owns fourteen reusable bodies and a private flat landing contact
beside the hole. The spoil pile follows the hero's facing direction. Clods
settle under gravity, shrink after 1.65 seconds and expire at two seconds;
interruptions drop a carried load and tool destruction releases the pool.
Filling and rock-blocked strikes do not produce fresh soil.

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
`FillHole` uses one reversed stroke. The closed fingers, wrist rotations and
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

## Hanging tunic flap

Only `Red lower tunic flap` uses cloth physics. The fitted tunic, belt and
other clothing retain their authored rigid meshes. The flap has a thin,
subdivided surface; its top seam follows the waist, while Ammo soft-body links,
bending constraints, gravity and animated leg/boot colliders drive the free fabric.
The attached gold piping follows the simulated panel. Removing the hero restores
its original meshes and releases the simulation and collision bodies.

The digging stance keeps the fixed seam ahead of the thighs, uses a shallow knee
bend, and maintains both glove contacts on the shovel. Cloth contact simulation
uses enlarged internal units for Ammo's sparse distance-field precision; rendering
and authored model coordinates keep their original scale.

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
