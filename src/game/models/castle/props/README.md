# Castle props

Twenty-one textured Tripo Studio models generated from the isolated PNG references
in `tmp/items`, through the Opera browser UI. The batch used 600 Studio credits;
no Tripo generation API or paid regeneration was used. Job IDs and import receipts
are retained in `tmp/tripo-items` for this local session.

Each adjacent `.blend` is the editable source for its `.glb`. Textures are packed
into the source and embedded in the GLB, with a maximum dimension of 2048 pixels.
Models use metres, +Y up in glTF, and a grounded, horizontally centered pivot.
Facing follows the original generated model; map definitions may specify yaw in
degrees through `rotation`.

The classes in `src/game/objects/castle-props` register through `MapObjectFactory`.
Place them in the map's `objects` array using `id`, `object`, `tile`, `position`,
and optional `rotation`, as shown by `castle-props-{1,2,3}.json` under map tests.
They are static props with Ammo triangle-mesh collisions that preserve openings
under tables and between chair arms. Candles and lanterns include textured
flame/glow geometry. Interactions and dynamic light emitters are not implemented.

Verification: the focused `CastleProps.cy.js` spec loads all three maps, checks
every prop has render meshes, a grounded bounding box, a native Ammo body and a
successful ray hit against its actual surface, and captures both map
views plus an individual close-up for every prop. Offline vertex inspection also
confirms static, unskinned, uncompressed geometry with zero ground offset.
