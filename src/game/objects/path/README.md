# Bridge styles and destruction

New collapse hinges use a shared world pivot evaluated from the current Ammo
body poses. Released sections may already have moved before they connect;
matching both local anchors prevents a solver snap at that handoff.

Raised sandstone crossings (`Overpass`) use their own hammer interaction.
Released sandstone slabs retain their full artwork and top support height,
with a small horizontal collision clearance so tilted corners can pass through
the opening and adjacent rows can settle without snagging.
Stone-local linear/angular damping and zero restitution dissipate landing
motion on the zero-friction terrain collider; no visual pose smoothing or
forced sleeping replaces Ammo simulation.
Destroying the central deck retains the stair approaches and lower path,
including crossings with stairs at only one end. Flyers retain the original
upper route; walkers and jumpers take a directed drop onto the actual lower
path, then continue there. Ammo drives their descent. The Divecap's local
planner hands off to this drop route and resumes after landing.
Use `/map/test_overpass-collapse` and `/map/test_overpass-collapse-one-sided`
for hammer, occupied-deck, and enemy pursuit checks.

Navigation retains an authored path beneath a bridge as a separate lower
surface. Destroying the deck removes its upper walking connection while the
lower route remains connected. Grass, riverbeds, and voids do not create routes.

Authored deck batches opt into route debug paint with `path-debug-surface`.
The overlay wraps their stock material shading so timber grain and palette stay
intact, and excludes rails, supports, and fittings.

`TerrainBlockDefinitions` transfers each terrain bridge span into one `Bridge`
record in `map.objects`. The object owns its deck, timber railings, interaction,
and Ammo debris. It does not add bridge-specific work to the renderer.

Normal bridges have a shallow timber arch with continuous railings and matching
side stringers. Decks use two square, metre-sized timber tiles per station,
aligned with the path's two grid lanes, rather than narrow full-width planks.
`BridgePalette` keeps walking tiles a softer tan, framing a darker muted oak,
and fittings matte and less yellow. Visual owners hold their own material clones
and release them on disposal; shared prop materials remain untouched. Deck UV
density matches the existing oak bench rather than repeating fine grain too
often across the larger square tiles.
`BridgeProfile` supplies the same station heights to the authored
model kit, terrain collision, hero support, and walking routes. Bank edges stay
at the original path elevation. One-station spans remain flat.

Only spans intersecting `IslandConnector.topology.cells` use the floating style;
river bridges elsewhere on a flying island remain normal bridges. Floating
decks stay flat, with continuous railings over the anchored sixty percent,
an open projecting tip, brass docking ends, and lift glyphs tucked underneath.
The deck is also braced by paired triangular oak brackets mounted below the owning
island's bank. Brackets follow island motion, support only the connected run,
and disappear when their bank connection is severed. Their deep island-mounted
posts, primary diagonals, secondary knee braces, and brass bands follow the
docking-ramp concept. When hammered, their
stations detach in a lift-failure wave, without bank hinges. Ammo suspends each
released section for 0.8 seconds while its glyphs flicker out, then gravity takes
over. Lift is restored after reparenting because adding a body to Ammo resets
its gravity. Disposal and hot reload use the same resource cleanup as normal
bridge destruction.

Face along a bridge and press **E** to hammer the next station. A station is one
tile long and includes both path lanes. That impact breaks the bridge's support:
the struck deck tips downward, pulling connected stations loose through Ammo
joints. A neighbour releases after the hanging edge has visibly dropped;
connections tear as the decks fold apart, and the final bank support gives way.
Bounded jam guards prevent contact with terrain from leaving a failing span stuck.
Strike from an adjacent bank to keep the hero supported;
standing on a released section keeps the hero on that section's live Ammo
surface until it tips too steeply, shatters, or disappears. The slab, not its
railings or underside, provides support. Support-relative impact speed prevents
the descending ride from triggering repeated landing reactions. A real hard
landing plays `HardLandingRecovery`, then returns movement and tool control.
A grounded rider begins the seated reaction immediately when the span fails,
holds the seated pose while falling, then stands and rubs his sore backside
twice after reaching stable ground.
The new summon, overhead strike, and dismiss clips use a two-handed hammer.
At impact the static deck becomes an identical falling section rather than
changing into generic blocks. Planks, stringers, and railings stay attached while
the deck tips. A real lower-floor contact then shatters that section into small
plank and railing fragments. Those pieces scatter with Ammo and fade out.
Bank-edge brushes and contact with other falling sections do not trigger it.

The complete span immediately receives `tileMeta[row][col].bridgeCollapsing`
so enemies anticipate its failure. Each falling station changes to
`bridgeCollapsed`; terrain collision and hero support stop using its deck.
The released dynamic deck remains physical while its replacement is visible.
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
Open `/map/test_bridge-styles` to compare the arched and floating artwork, reverse
views, and both destruction sequences using the normal hammer animation.
Open `/map/test_bridge-clipping` for the one-station island connector and its
three camera angles. Brass corners wrap inward, stay inside the deck footprint,
and keep their upper faces above the timber plane to avoid flickering.
Open `/map/test_bridge-rider` to hammer a six-station bridge in the middle while
standing on it, release an occupied section directly, or test a hard landing.

Focused checks:

```sh
node --test test/unit/game/objects/path/bridge-collapse-lifecycle.test.js test/unit/game/objects/path/bridge-deck-fragment.test.js test/unit/game/navigation/enemy-bridge-navigation.test.js
```
