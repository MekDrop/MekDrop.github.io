# Destructible vegetation

Keep one mesh object per collision cell, named `Voxel cell x y z`. Cells use
the owning object's 0.25-metre grid: X/Z are centre indices and Y is the layer
above the plant base. Preserve these objects when editing or exporting the
adjacent Blender sources; joining a whole layer prevents contact-based removal.

One left-to-right stroke slices the highest remaining level. The actual moving
sharpened edge determines which lateral columns disappear; each column includes
its depth, so rear cells do not require additional strokes. Lower levels stay
intact until the next stroke. This gameplay slice query updates the matching
meshes, engine compound collider and health together. The interaction centers
on the level and retargets its height only after recovery.
