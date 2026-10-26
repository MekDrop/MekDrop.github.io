# Castle servants

`servant.blend` and `elder-servant.blend` are the editable sources for the adjacent
GLBs. Each export has one skinned mesh, a humanoid skeleton, and articulated
thumbs and four fingers on each hand. Palm attachment bones are named
`Servant left grip` and `Servant right grip`; the wrist bones retain the existing
`Royal left hand` and `Royal right hand` names.

The initial replacement candidates were generated and auto-rigged in Tripo through Opera:

- Young servant: <https://studio.tripo3d.ai/workspace/rigging/7690296e-a266-4c60-b18f-989611dc098e>
- Elder servant: <https://studio.tripo3d.ai/workspace/rigging/3df8307b-fe9c-4c01-b21c-fad2b531b988>

The two generations and auto-rigs used 90 credits in total. Their slender bodies
were rejected during visual review. The final bodies restore the game's original
faceted faces, hair, coats, palette, and chunky proportions. Local Blender work
fits the humanoid rigs to those shapes, replaces the mitten hands with articulated
gloves, adds palm grips, and authors the clips. Both variants have articulated
elbows and knees; the elder uses the same segmented lower-body construction.

Both models export TerraceIdle, TerraceWalk, TerraceCarry, TerracePlace,
TerracePour, TerraceCloseDoor, TerraceTurn, TerraceStairUp, TerraceStairDown,
TerraceCarryStairUp, and TerraceCarryStairDown. Walking clips have a native stride
of 5/6 model units per cycle. Runtime playback follows distance travelled;
terrain contact adjusts the visual leg chains to the actual stair treads.

Keep the large heads, broad flat coat panels, segmented sleeves, and blocky shoes
when revising these assets. The young servant keeps the swept black fringe; the
elder keeps the silver hair, moustache, and beard. Materials use flat colour and
matte surfaces rather than painted folds or glossy generated tuxedo textures.

The saved `/map/test_servant-animations` fixture uses production actors and the
production resident route follower. Its HUD provides individual actions,
four camera views, actual stair travel in both directions, video capture, and a
transparent object-preview capture. The stair fixture deliberately has no door
or furniture obstacles; normal castle routes retain those collision checks.

Focused validation lives in the terrace-actor, resident-foot-placement,
castle-resident-motion, castle-servant-standing, terrace-door-actions, and
terrace-movement unit tests. Visual acceptance also requires reviewing recordings
of the live castle service interactions; passing rig and routing tests alone does
not establish that prop contact looks correct.

The style revision was reviewed in four-angle source and in-game action
recordings, plus two-angle stair travel recordings. The representative transparent
preview was recaptured from the game.

Service props use model-local contact points transformed through their actual
scale, with two-bone arm fitting after locomotion and animation evaluation.
Tables, chairs, trays, the teapot handle, and the folded sunbed attach to palm
sockets. The sunbed's animated model root stays inside a separate carrier entity,
so unfolding cannot overwrite its carrying transform.

Carrying measures the cargo's descendant mesh bounds in its own frame and keeps
the nearest surface ahead of the torso and swinging knees. This uses the actual
furnishing scale and follows the carrier's heading and elevation on stairs.
Finger curls fit the scaled rim, rail, or handle thickness; contact sockets move
to the space enclosed by the fingers and opposing thumb before arm fitting.
The authored pose and attachment sockets are restored when contact ends.

Cargo vertices and sampled flat triangle interiors use the exact authored tread
records shared with the visible stairs and Ammo mesh; other low surfaces retain
physics queries. This avoids thousands of raycasts per carrying frame. The load
rises ahead of the feet.
Carrying clearance follows a continuous upper envelope of those treads, including
a short approach outside each flight, so loads rise before risers without popping.
Loaded tray queries include the pot, cup and overhanging saucer in their actual
tray-relative poses, rather than treating the tray outline as the whole load.
Tables travel with the pedestal upward, held at the rear rim. Folded daybeds
travel upright, held at the upper wooden frame. Wrists align to the rim or rail
axis, and the clavicles can protract by at most 25 degrees before the two arm
segments are fitted, without stretching bones or moving the head.
Stair routes reserve the load's width behind the divider, retain authored
landing corners, and begin loaded pivots before reaching the back wall.
Initial heading comes from the forward vector, avoiding Euler decomposition's
ambiguous Y value at 180 degrees.

The animation fixture's Cargo tab selects table, chair, loaded tea tray, or folded
sunbed for both servant variants. The selected cargo stays attached during the
existing stair-travel controls, using the same service actions as castle visits.
`/map/test_servant-tower-cargo` covers the real enclosed tower, its approach,
doorways and landings. Its tower has larger front and rear clearances; compiled
approach points align loads with each flight. Loaded doorway sidesteps retain
their facing, and a final prop/contact update follows doorway reaction poses.

Terrace furnishings use a shared stage scale of `CHARACTER_HEIGHT / 2`, matching
their approximately two-unit human authoring reference. Balcony dimensions do
not shrink the furniture; the service arrangement remains centered on the
terrace. Grip checks cover the resulting approximately 0.68 world scale.
The scale revision passed 23 focused checks and live multi-angle sunbed and tea
service recordings (`servant-sunbed-scale-review` and `servant-scale-princess` in
the review folder). Runtime table height is approximately 0.724 m; the recorded
pouring handle gap is approximately 0.0011 mm.

The `/map/test_servant-service` fixture exercises production castle visits,
furniture delivery, tea pouring, and timed door inspection. Multi-angle live
recordings are retained under ignored `tmp/servants-remake/`. The young servant's
tea service and elder servant's sunbed delivery have been visually reviewed;
measured steady table and teapot contact gaps are below 0.01 mm. The focused
checks include both exported servant rigs at different furniture scales, the
sunbed root, missed door-open notifications, and navigation opening requests.
All 41 targeted checks pass. The final source-only door recording confirms palm
contact below 0.01 mm during closing and a fully closed `openAmount` of zero.
Doors wait 30 seconds, defer inspection during service traffic, and retain the
handle operator while handing off from route following to the closing arc.
One broader pre-existing door-placement test still fails its NPC clearance
expectation; it also fails with the new door-handle binding removed.
