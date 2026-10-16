# Hero climbing animation

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
