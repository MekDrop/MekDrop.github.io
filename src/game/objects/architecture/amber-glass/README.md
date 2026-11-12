# Amber glass

`AmberGlass.add(pc, visual)` owns translucent material clones and releases them
when the visual is destroyed. Lanterns retain their mottled amber finish.
Closed windows use `authored: true` to preserve the Blender-authored softly
faceted honey glass and subdued indoor warmth. Open windows do not allocate
glass materials.

Window sources reference the unpacked `window-frosted` and `window-warmth`
images under `src/game/textures/glass/`. The exporter externalizes both images;
`GameTextureLibrary` shares them across room, hall and slit models. The old
`amber-frosted` texture remains available for the lantern-style finish.

`WindowModules.fit` returns the fitted row count. Pass it as `paneRows` so the
shared component maps each repeated pane to its own vertical region of the
colour and emission maps. This keeps broad highlights continuous over the
complete window instead of restarting them in every pane. Glass uses back-face culling to
avoid doubling opacity across the two surfaces of the closed pane.

The window owns its warm oak tint, preserving the shared timber grain. Projecting
sills and lintels give the surround the same chunky relief as the masonry. Frames,
geometry and local lighting stay with their owning window or lantern. This
component is a subobject and uses its owning object's preview.
