# Alchemical bush burner

Fantasy hand siphon for fast, level-by-level bush clearing. The production
hero keeps the axe for trees. The burner has a brass vessel with iron bindings,
leather accordion bellows, a grained oak palm grip and support brace, a filler
cap, peened rivets, and a dragon-jaw nozzle. It has no modern gun stock or tank.

The viewed [Greek-fire reconstruction at the Thessaloniki Technology Museum](https://commons.wikimedia.org/wiki/File:Arbalest_flamethrower_Greek_fire,_Byzantine_Empire_(reconstruction).jpg)
informs the cylindrical vessel, extended nozzle, and visibly attached manual
mechanism. The portable scale, bellows, dragon mouth, and green flame are fantasy
art direction, not claims of historical accuracy. The reference image is not
redistributed or used as a texture.

The model follows the existing game's angular shapes. Its decoded authored
bounds are X [-0.395, 0.194], Y [-0.06, 0.3425], Z [-0.2675, 0.75].
Dimensions are 0.589 × 0.4025 × 1.0175, from decoded vertices in the static pose;
the standing ground offset is 0.06. The hero supplies the uniform model scale.
The `Burner nozzle` anchor supplies the particle mount; no guessed world offset
is used. Fresh GLB import: 30 meshes, 1,092 triangles.

The separate `alchemical-burner-poses` and `alchemical-burner-special-poses`
sources contain three 0.5-second baked clips for their respective hero rigs.
They retain each rig's complete target hierarchy, including the alternate
hero's intermediate Mixamo joints. Root transform channels are deliberately
absent, preserving the runtime's model scale and facing. Both target-path sets
are checked against the exported playable heroes.

Each burst starts at 0.06 seconds and emits until 0.34 seconds. Its impact at
0.30 seconds removes exactly the current leafy level; subsequent bursts lower
the aiming pose without walking between levels. The nozzle owns one pooled
48-particle emitter using the existing flame texture. Leaving the action stops
emission; tool destruction releases the emitter through its entity hierarchy.

The editable Blender files are authoritative. Temporary construction and
validation scripts are kept in ignored `tmp/`. The normal export command is
`npm run blender:export`. Review through `/map/test_bush-burner` in the normal
game, including both side views and stop/restart behavior. The tool's owning
folder contains a transparent preview captured from production rendering.
