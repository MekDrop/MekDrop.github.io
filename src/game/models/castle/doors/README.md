# Castle entrances

Three complete stone-surround, oak-frame, and double-door models generated from
the approved isolated concepts through Tripo Studio H3.1 on 2026-10-11. The three
generation jobs used 90 Studio credits, with standard 2K textures.

| Model | Tripo task | Original provider triangles |
| --- | --- | --- |
| `entrance-rounded` | `87ae5336-51d8-47c3-b383-bdaf60f08e39` | 6460 |
| `entrance-rectangular` | `0bedfc56-9657-4818-82f7-5d93789d4575` | 4052 |
| `entrance-pointed` | `f99f9365-d55c-4819-9114-c8c1372cc66e` | 3988 |

Each adjacent `.blend` is an editable source with packed textures, exported to
one reusable `.glb`. Coordinates are metres, glTF +Y up, facing -Z; the top of
the threshold is floor zero. The trim fits a two-metre masonry aperture.
The stone threshold extends below floor zero so it seats into the landing.

The rounded entrance bundles the stationary masonry surround, complete oak
frame, 50 mm wooden leaves, matching iron fittings, and a wooden interior sill.
Its inside opening follows the rounded door crown and uses the castle's normal
world-aligned brick material. Exterior arch joints use the authored radial layout.
The original generated mesh was rebuilt into solid planks and masonry surfaces;
overlapping arch faces and the old dark mortar bed were removed.

The authored OpenWide clip targets an 85-degree inward swing. Runtime Ammo
contact checks limit that motion against the arch, nearby walls, and occupants.
The visible plank meshes supply convex leaf collision; the original invisible
column helpers remain hidden. The masonry reveal supplies static mesh collision.
Mechanical collision margins are applied after mesh loading. Level floor and
ceiling support contacts do not restrict a vertical hinge.

The pointed entrance has one exterior stone band whose straight pointed edges
follow the oak casing. Its inner and outer slopes are parallel, with 28 cm of
stone around the frame. Jamb stones form horizontal courses; crown stones follow
the sloping arch, with joints normal to the slope and the same stone palette.
The rear face
sits within the wall, without a projecting indoor surround. The rear apex is
relieved with a 12 cm rounded transition between the door sweep clearances,
avoiding an abrupt rectangular ceiling recess.
The oak leaves sit near the outside and open inward. The inner reveal follows
the swept door volume with 12 mm clearance. Select door style `pointed` to use
it; the rear bell tower castle uses this variant.
The rectangular alternative remains static.
Authored castle main entrances default to the rounded asset through Door;
their previous separate DoorArch instance is omitted. The normal
test_castle-entrance map provides scripted HUD controls and a repeatable inside
view for checking the closed entrance and its collision-limited opening.

Provider downloads, preparation scripts, and verification images remain in
ignored tmp/castle-entrance-tripo. No paid regeneration was used for these
geometry and collision refinements.
