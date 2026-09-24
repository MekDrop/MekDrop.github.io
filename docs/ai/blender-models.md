# Blender Model Rules

Read this when a visible 3D character, architectural element, or reusable prop has a stable authored shape.

Create or edit an imported Blender model instead of assembling stable artwork from PlayCanvas primitive entities or generating its mesh in JavaScript.

Store models under `src/game/models/`, grouped by feature, with exactly one reusable model per `.glb` file. Every tracked `.glb` under `src/game/models/` must have an editable `.blend` source file with the same basename in the same directory. Treat the `.blend` file as the source of truth and export the adjacent `.glb` from it.

Keep procedural code responsible for map-driven placement, transforms, collision, interaction, runtime color variants, shaders, particles, and other behavior. Terrain topology, route markers, portal surfaces, fire, and deformable cloth should remain procedural unless a task explicitly replaces their runtime system.

Use a modular model kit rather than one monolithic asset whenever dimensions or layouts vary at runtime.

Do not replace `.blend` source files with procedural Blender generator scripts unless the user explicitly requests that workflow.

Whenever the model format supports animation, author and store character and prop animation clips in the editable model and exported `.glb` instead of synthesizing joint or object motion in JavaScript. Runtime code should select, sequence, blend, and adjust playback of those embedded clips; use procedural animation only when the behavior is inherently dynamic and cannot reasonably be authored in the model.
