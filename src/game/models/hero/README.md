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
