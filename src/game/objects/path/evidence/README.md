# Bridge collapse visual verification

[bridge-collapse-impact-rubble-v4.mp4](bridge-collapse-impact-rubble-v4.mp4) is the current 48-second review. It shows the complete six-tile sequence at normal speed, a clearly labeled half-speed ground-contact detail, three- and six-tile front/side/reverse views, and a one-tile sanity check.

The original textured deck and attached rails sag and physically pull their neighbors down. After a section reaches lower static terrain, it breaks into small paving and timber pieces that bounce and fade. Upper-bank brushes and other moving sections do not trigger the fracture. The six-tile probe observed intact falling sections first, then 60 small pieces, then zero transient sections or chips after cleanup.

All seven revised takes use real keyboard **E** input on `/map/test_bridge-collapse?camera-test`. They use production models, lighting, camera, and Ammo physics. No screenshot or GPU readback runs during recording; critical frames are extracted from the finalized native MP4s. The test-control panel is hidden for framing, and path lines are off for material review.

`visual-verification-v4.json` and `visual-verification.json` contain the current phase/contact proof, seven angle checks, zero remaining intact-span render components, and the refreshed transparent preview. The cold performance probe ran without video encoding or screenshots: the impact peak fell from 146 ms to 21.6 ms and the bounce/fade peak from 169 ms to 16.3 ms after shared geometry and deferred shader preparation. Raw takes and frame samples remain under ignored `tmp/bridge-collapse-v4-final/` and `tmp/bridge-collapse-v4-probe-ready/`.

`on-deck-collapse.json` separately starts the hero on a three-tile bridge. Its current section falls too, and the hero lands alive and grounded on the actual floor at Y = 0. Transient pieces clear after their fade; shared prepared GPU resources remain owned by the active bridge leases until scene disposal.

To inspect interactively:

1. Open `/map/test_bridge-collapse?camera-test`.
2. Press **Pause** for capability paths and unrestricted development camera framing.
3. Choose a bridge-length button; use **Q** or middle-button dragging to orbit.
4. Face the bridge and press **E**, or use **Smash N tile** to place the hero before striking. Reload to restore the span.

Orange routes stop/reroute walking enemies, cyan permits flight, and purple permits a one-tile jump. `enemy-navigation-review.mp4` retains the separate functional routing comparison from the previous visual pass; its evidence is in `enemy-navigation.json`.

The v3 coherent-section comparison remains in [bridge-collapse-before-after-v3.mp4](bridge-collapse-before-after-v3.mp4). Earlier v1 videos and versioned JSON files are retained as baseline evidence.
