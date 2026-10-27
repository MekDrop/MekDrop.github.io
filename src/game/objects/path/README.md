# Bridge destruction

`TerrainBlockDefinitions` transfers each terrain bridge span into one `Bridge`
record in `map.objects`. The object owns its deck, timber railings, interaction,
and Ammo debris. It does not add bridge-specific work to the renderer.

Face along a bridge and press **E** to hammer the next station. A station is one
tile long and includes both path lanes. That impact breaks the bridge's support:
the struck deck tips downward, pulling connected stations loose through Ammo
joints. A neighbour releases after the hanging edge has visibly dropped;
connections tear as the decks fold apart, and the final bank support gives way.
Bounded jam guards prevent contact with terrain from leaving a failing span stuck.
Strike from an adjacent bank to keep the hero supported;
standing on the bridge during its collapse also removes the hero's footing.
The new summon, overhead strike, and dismiss clips use a two-handed hammer.
At impact the static deck becomes an identical falling section rather than
changing into generic blocks. Paving, fascia, and railings stay attached while
the deck tips. A real lower-floor contact then shatters that section into small
paving chips and timber fragments. Those pieces scatter with Ammo and fade out.
Bank-edge brushes and contact with other falling sections do not trigger it.

The complete span immediately receives `tileMeta[row][col].bridgeCollapsing`
so enemies anticipate its failure. Each falling station changes to
`bridgeCollapsed`; terrain collision and hero support stop using its deck.
The `bridge:collapsed` app event refreshes the terrain physics
mesh and path debug arrows. Ground impacts are queued by the physics contact
callback and consumed outside the solver before removing joints and replacing
the large body. Sections falling into true voids retain the seven-second fade
fallback. Map disposal also releases all joints, bodies, rendering resources,
and buffers, including small impact debris.

`WalkingPaths.rebuild` derives separate enemy capability graphs. Walkers choose
an available detour or wait before the gap. Flyers retain the crossing. Jumpers
can cross one contiguous missing station and wait at wider gaps. The normal
path-arrow debug toggle adds amber walking, cyan flying, and violet jumping
lanes, with a PlayCanvas HUD legend.

Open `/map/test_bridge-collapse` for one-, three-, and six-tile spans and hammer
buttons. Enable path-arrow debug for the free camera; use **Q** to orbit around
the selected bridge. Reload the map to restore all stations.

Focused checks:

```sh
node --test test/unit/game/objects/path/bridge-collapse-lifecycle.test.js test/unit/game/objects/path/bridge-deck-fragment.test.js test/unit/game/navigation/enemy-bridge-navigation.test.js
```
