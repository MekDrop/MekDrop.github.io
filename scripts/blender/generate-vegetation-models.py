from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = ROOT / "src" / "game" / "models" / "vegetation"
BLOCK_SIZE = 0.25
PC_TO_BLENDER = Matrix(
    (
        (1, 0, 0, 0),
        (0, 0, -1, 0),
        (0, 1, 0, 0),
        (0, 0, 0, 1),
    )
)


def color(value: int) -> tuple[float, float, float, float]:
    return (
        ((value >> 16) & 0xFF) / 255,
        ((value >> 8) & 0xFF) / 255,
        (value & 0xFF) / 255,
        1,
    )


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials):
        for item in list(collection):
            collection.remove(item)


def material(name: str, value: int) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color(value)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color(value)
    shader.inputs["Roughness"].default_value = 0.84
    return result


def pc_location(location: tuple[float, float, float]) -> Vector:
    converted = PC_TO_BLENDER @ Vector((*location, 1))
    return Vector((converted.x, converted.y, converted.z))


def add_block(
    name: str,
    block_material: bpy.types.Material,
    grid_position: tuple[int, int, int],
) -> bpy.types.Object:
    x, y, z = grid_position
    bpy.ops.mesh.primitive_cube_add(size=BLOCK_SIZE)
    block = bpy.context.object
    block.name = name
    block.location = pc_location(
        (x * BLOCK_SIZE, (y + 0.5) * BLOCK_SIZE, z * BLOCK_SIZE)
    )
    block.data.materials.append(block_material)
    bevel = block.modifiers.new("Soft voxel edge", "BEVEL")
    bevel.width = 0.015
    bevel.segments = 1
    bevel.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = block
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return block


def join_blocks(
    blocks: list[bpy.types.Object],
    name: str,
) -> None:
    if not blocks:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for block in blocks:
        block.select_set(True)
    bpy.context.view_layer.objects.active = blocks[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    joined.data.name = f"{name} mesh"
    joined.select_set(False)


def export_model(
    filename: str,
    trunk_blocks: list[tuple[int, int, int]],
    leaf_groups: list[tuple[int, list[tuple[int, int, int]]]],
) -> None:
    reset_scene()
    # Imported glTF base colors are linear in PlayCanvas and the game uses a
    # strong key light, so these values are intentionally deeper than CSS-like
    # palette values. They render as warm brown and vivid greens in-game.
    trunk = material("Warm voxel bark", 0x2A0E04)
    leaf_materials = [
        material("Leaf lime", 0x0A5206),
        material("Leaf green", 0x063A05),
        material("Leaf shade", 0x032203),
    ]

    grouped_blocks: list[list[bpy.types.Object]] = [[], [], [], []]
    for index, position in enumerate(trunk_blocks):
        grouped_blocks[0].append(
            add_block(f"Trunk block {index + 1}", trunk, position)
        )
    for material_index, positions in leaf_groups:
        for index, position in enumerate(positions):
            grouped_blocks[material_index + 1].append(
                add_block(
                    f"Leaf block {material_index + 1}-{index + 1}",
                    leaf_materials[material_index],
                    position,
                )
            )

    for index, blocks in enumerate(grouped_blocks):
        join_blocks(blocks, "Voxel bark" if index == 0 else f"Voxel leaves {index}")

    target = MODEL_ROOT / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
    )


def cross(y: int) -> list[tuple[int, int, int]]:
    return [(0, y, 0), (-1, y, 0), (1, y, 0), (0, y, -1), (0, y, 1)]


export_model(
    "oak.glb",
    [(0, 0, 0), (0, 1, 0), (0, 2, 0)],
    [
        (2, cross(3)),
        (1, [(x, 4, z) for x in (-1, 0, 1) for z in (-1, 0, 1)]),
        (0, cross(5)),
    ],
)

export_model(
    "pine.glb",
    [(0, 0, 0), (0, 1, 0), (0, 2, 0)],
    [
        (2, [(x, 2, z) for x in (-1, 0, 1) for z in (-1, 0, 1)]),
        (1, cross(3)),
        (0, [(0, 4, 0), (-1, 4, 0), (0, 4, 1)]),
        (0, [(0, 5, 0)]),
    ],
)

export_model(
    "tall-tree.glb",
    [(0, 0, 0), (0, 1, 0), (0, 2, 0), (0, 3, 0)],
    [
        (2, [(-1, 3, 0), (1, 3, 0), (0, 3, -1), (0, 3, 1)]),
        (1, cross(4) + [(-1, 4, 1), (1, 4, -1)]),
        (0, [(x, 5, z) for x in (-1, 0, 1) for z in (0, 1)]),
        (0, [(0, 6, 0), (0, 6, 1)]),
    ],
)

export_model(
    "sapling.glb",
    [(0, 0, 0), (0, 1, 0)],
    [
        (2, [(-1, 1, 0), (1, 1, 0), (0, 1, -1)]),
        (1, cross(2)),
        (0, [(0, 3, 0), (1, 3, 0)]),
    ],
)

export_model(
    "round-bush.glb",
    [],
    [
        (2, cross(0) + [(-1, 0, 1), (1, 0, -1)]),
        (1, cross(1)),
        (0, [(0, 2, 0)]),
    ],
)

export_model(
    "wide-bush.glb",
    [],
    [
        (2, [(x, 0, 0) for x in (-2, -1, 0, 1, 2)]),
        (1, [(x, 0, 1) for x in (-1, 0, 1)] + [(x, 0, -1) for x in (0, 1)]),
        (0, [(-1, 1, 0), (0, 1, 0), (1, 1, 0)]),
    ],
)
