# Game Physics Rules

Read this when adding or modifying behavior that represents physical contact, collision, forces, gravity, inertia, spring motion, joints, raycasts, rigid bodies, or soft bodies.

Use the project's configured PlayCanvas physics engine, currently Ammo, by default for new or modified game behavior in this area.

Drive visual deformation and animation from engine state where needed, but do not replace engine simulation with custom frame-by-frame physics integrators.

Use custom physics math only when the engine cannot reasonably represent the behavior. Document that limitation beside the implementation and keep the custom portion narrowly bounded.
