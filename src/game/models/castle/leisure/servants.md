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
