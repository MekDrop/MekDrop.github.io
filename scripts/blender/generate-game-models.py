from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_ROOT = ROOT / "src" / "game" / "models"
PC_TO_BLENDER = Matrix(
    (
        (1, 0, 0, 0),
        (0, 0, -1, 0),
        (0, 1, 0, 0),
        (0, 0, 0, 1),
    )
)
BLENDER_TO_PC = PC_TO_BLENDER.inverted()


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
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(collection):
            collection.remove(item)


def material(
    name: str,
    value: int,
    *,
    roughness: float = 0.72,
    metallic: float = 0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color(value)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color(value)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return result


def wood_material(name: str) -> bpy.types.Material:
    size = 64
    image = bpy.data.images.new(f"{name} grain", width=size, height=size, alpha=True)
    image.colorspace_settings.name = "sRGB"
    pixels: list[float] = []
    for y in range(size):
        for x in range(size):
            wave = math.sin(y * 0.38 + math.sin(x * 0.31) * 1.8) * 0.1
            fine = math.sin(y * 0.91 - x * 0.17) * 0.035
            edge = abs(x / (size - 1) - 0.5) * 2
            knot_x = x - size * 0.63
            knot_y = ((y + 19) % 43) - 21
            knot_distance = math.sqrt(knot_x * knot_x * 1.7 + knot_y * knot_y)
            shade = 0.88 + wave + fine - edge * 0.08
            if 5 < knot_distance < 8:
                shade *= 0.58
            elif knot_distance <= 5:
                shade *= 0.78
            pixels.extend(
                (
                    max(0.08, min(0.48, 0.34 * shade)),
                    max(0.035, min(0.26, 0.16 * shade)),
                    max(0.018, min(0.14, 0.075 * shade)),
                    1,
                )
            )
    image.pixels.foreach_set(pixels)
    image.pack()

    result = material(name, 0xFFFFFF, roughness=0.88)
    shader = result.node_tree.nodes.get("Principled BSDF")
    texture = result.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.interpolation = "Closest"
    result.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    return result


def stone_material(name: str, value: int) -> bpy.types.Material:
    size = 32
    tint = color(value)
    image = bpy.data.images.new(f"{name} face", width=size, height=size, alpha=True)
    image.colorspace_settings.name = "sRGB"
    pixels: list[float] = []
    for y in range(size):
        for x in range(size):
            edge = min(x, y, size - 1 - x, size - 1 - y)
            shade = 0.78
            if edge < 2:
                shade = 0.39
            elif x < 6 or y >= size - 6:
                shade = 0.94
            elif x >= size - 6 or y < 6:
                shade = 0.61
            elif (x > 19 and 9 < y < 12) or (8 < x < 11 and y > 20):
                shade = 0.57
            elif (x + y * 3) % 17 < 2:
                shade = 0.72
            pixels.extend(
                (
                    shade * tint[0],
                    shade * tint[1],
                    min(1, (shade + 0.015) * tint[2]),
                    1,
                )
            )
    image.pixels.foreach_set(pixels)
    image.pack()

    result = material(name, value, roughness=0.88)
    shader = result.node_tree.nodes.get("Principled BSDF")
    texture = result.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.interpolation = "Closest"
    result.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    return result


def pc_matrix(
    location=(0, 0, 0),
    rotation=(0, 0, 0),
    scale=(1, 1, 1),
) -> Matrix:
    translation = Matrix.Translation(Vector(location))
    orientation = Euler(tuple(math.radians(value) for value in rotation), "XYZ")
    scaling = Matrix.Diagonal((*scale, 1))
    return PC_TO_BLENDER @ translation @ orientation.to_matrix().to_4x4() @ scaling @ BLENDER_TO_PC


def set_transform(
    obj: bpy.types.Object,
    location=(0, 0, 0),
    scale=(1, 1, 1),
    rotation=(0, 0, 0),
) -> None:
    obj.matrix_local = pc_matrix(location, rotation, scale)


def empty(
    name: str,
    *,
    parent: bpy.types.Object | None = None,
    location=(0, 0, 0),
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    set_transform(obj, location)
    return obj


def finish_mesh(obj: bpy.types.Object, bevel: float = 0.018) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def box(
    name: str,
    mat: bpy.types.Material,
    location,
    dimensions,
    *,
    rotation=(0, 0, 0),
    parent: bpy.types.Object | None = None,
    bevel: float = 0.018,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    set_transform(obj, location, dimensions, rotation)
    return finish_mesh(obj, min(bevel, min(dimensions) * 0.2))


def sphere(
    name: str,
    mat: bpy.types.Material,
    location,
    dimensions,
    *,
    parent: bpy.types.Object | None = None,
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=0.5)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    set_transform(obj, location, dimensions)
    return finish_mesh(obj, 0)


def cylinder(
    name: str,
    mat: bpy.types.Material,
    location,
    dimensions,
    *,
    rotation=(0, 0, 0),
    parent: bpy.types.Object | None = None,
    vertices: int = 12,
    bevel: float = 0.014,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=0.5, depth=1)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    set_transform(obj, location, dimensions, rotation)
    return finish_mesh(obj, min(bevel, min(dimensions) * 0.15))


def cone(
    name: str,
    mat: bpy.types.Material,
    location,
    dimensions,
    *,
    rotation=(0, 0, 0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.5, radius2=0, depth=1)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    set_transform(obj, location, dimensions, rotation)
    return finish_mesh(obj, 0.01)


def torus(
    name: str,
    mat: bpy.types.Material,
    location,
    major_radius: float,
    minor_radius: float,
    *,
    rotation=(0, 0, 0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=12,
        minor_segments=6,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    set_transform(obj, location, rotation=rotation)
    return obj


def pc_vertex(point) -> tuple[float, float, float]:
    converted = PC_TO_BLENDER @ Vector((*point, 1))
    return converted.x, converted.y, converted.z


def prism(
    name: str,
    mat: bpy.types.Material,
    outline: list[tuple[float, float]],
    depth: float,
    *,
    parent: bpy.types.Object | None = None,
    bevel: float = 0.012,
) -> bpy.types.Object:
    count = len(outline)
    points = [pc_vertex((x, y, depth / 2)) for x, y in outline]
    points += [pc_vertex((x, y, -depth / 2)) for x, y in outline]
    faces = [tuple(range(count)), tuple(range(count, count * 2))[::-1]]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name} mesh")
    mesh.from_pydata(points, [], faces)
    min_x = min(point[0] for point in outline)
    max_x = max(point[0] for point in outline)
    min_y = min(point[1] for point in outline)
    max_y = max(point[1] for point in outline)
    width = max(max_x - min_x, 0.0001)
    height = max(max_y - min_y, 0.0001)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            outline_index = mesh.loops[loop_index].vertex_index % count
            x, y = outline[outline_index]
            uv_layer.data[loop_index].uv = (
                (x - min_x) / width,
                (y - min_y) / height,
            )
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return finish_mesh(obj, bevel)


def add_animation_clip(
    obj: bpy.types.Object,
    clip_name: str,
    keyframes: list[tuple[int, tuple, tuple, tuple]],
) -> None:
    obj.animation_data_create()
    action = bpy.data.actions.new(f"{clip_name} | {obj.name}")
    obj.animation_data.action = action
    for frame, location, rotation, scale in keyframes:
        set_transform(obj, location, rotation=rotation, scale=scale)
        obj.keyframe_insert(data_path="location", frame=frame, group=obj.name)
        obj.keyframe_insert(data_path="rotation_euler", frame=frame, group=obj.name)
        obj.keyframe_insert(data_path="scale", frame=frame, group=obj.name)
    track = obj.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, int(action.frame_range[0]), action)
    strip.name = clip_name
    obj.animation_data.action = None


def export(relative_path: str) -> None:
    target = MODEL_ROOT / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animation_mode="NLA_TRACKS",
        export_anim_slide_to_zero=True,
        # Constant channels are intentional rest-pose targets. Removing them
        # makes a transition inherit the previous clip's last limb pose.
        export_optimize_animation_size=False,
    )
    bpy.ops.object.select_all(action="DESELECT")


def add_hero_animations(rig, left_leg, right_leg, left_arm, right_arm) -> None:
    one = (1, 1, 1)
    rig_rest = ((0, 0, 0), (0, 0, 0), one)
    left_leg_rest = ((-0.2, 0.71, 0), (0, 0, 0), one)
    right_leg_rest = ((0.2, 0.71, 0), (0, 0, 0), one)
    left_arm_rest = ((-0.49, 1.24, 0), (0, 0, -18), one)
    right_arm_rest = ((0.47, 1.22, 0), (0, 0, 18), one)

    clips = {
        "Idle": {
            rig: [(1, *rig_rest), (31, (0, 0.018, 0), (0, 0, 0), (0.99, 1.015, 0.99)), (61, *rig_rest)],
            left_leg: [(1, *left_leg_rest), (31, (-0.215, 0.71, 0), (0, -1, 0), one), (61, *left_leg_rest)],
            right_leg: [(1, *right_leg_rest), (31, (0.215, 0.71, 0), (0, 1, 0), one), (61, *right_leg_rest)],
            left_arm: [(1, *left_arm_rest), (31, left_arm_rest[0], (2, 0, -18), one), (61, *left_arm_rest)],
            right_arm: [(1, *right_arm_rest), (31, right_arm_rest[0], (-2, 0, 18), one), (61, *right_arm_rest)],
        },
        "Walk": {
            rig: [
                (1, (0, 0, 0), (0, 0, -1.5), one),
                (7, (0, 0.035, 0), (0, 0, 0), one),
                (13, (0, 0, 0), (0, 0, 1.5), one),
                (19, (0, 0.035, 0), (0, 0, 0), one),
                (25, (0, 0, 0), (0, 0, -1.5), one),
            ],
            left_leg: [(1, left_leg_rest[0], (-24, 0, 0), one), (7, *left_leg_rest), (13, left_leg_rest[0], (24, 0, 0), one), (19, *left_leg_rest), (25, left_leg_rest[0], (-24, 0, 0), one)],
            right_leg: [(1, right_leg_rest[0], (24, 0, 0), one), (7, *right_leg_rest), (13, right_leg_rest[0], (-24, 0, 0), one), (19, *right_leg_rest), (25, right_leg_rest[0], (24, 0, 0), one)],
            left_arm: [(1, left_arm_rest[0], (30, 0, -18), one), (7, *left_arm_rest), (13, left_arm_rest[0], (-30, 0, -18), one), (19, *left_arm_rest), (25, left_arm_rest[0], (30, 0, -18), one)],
            right_arm: [(1, right_arm_rest[0], (-30, 0, 18), one), (7, *right_arm_rest), (13, right_arm_rest[0], (30, 0, 18), one), (19, *right_arm_rest), (25, right_arm_rest[0], (-30, 0, 18), one)],
        },
        "Run": {
            rig: [
                (1, (0, -0.01, -0.035), (11, 0, -2.8), (1.015, 0.97, 1.015)),
                (5, (0, 0.065, -0.035), (11, 0, 0), one),
                (10, (0, -0.01, -0.035), (11, 0, 2.8), (1.015, 0.97, 1.015)),
                (14, (0, 0.065, -0.035), (11, 0, 0), one),
                (19, (0, -0.01, -0.035), (11, 0, -2.8), (1.015, 0.97, 1.015)),
            ],
            left_leg: [(1, (-0.2, 0.82, 0), (-48, 0, 0), one), (5, *left_leg_rest), (10, left_leg_rest[0], (48, 0, 0), one), (14, *left_leg_rest), (19, (-0.2, 0.82, 0), (-48, 0, 0), one)],
            right_leg: [(1, right_leg_rest[0], (48, 0, 0), one), (5, *right_leg_rest), (10, (0.2, 0.82, 0), (-48, 0, 0), one), (14, *right_leg_rest), (19, right_leg_rest[0], (48, 0, 0), one)],
            left_arm: [(1, left_arm_rest[0], (46, 0, -10), one), (5, left_arm_rest[0], (-8, 0, -10), one), (10, left_arm_rest[0], (-58, 0, -10), one), (14, left_arm_rest[0], (-8, 0, -10), one), (19, left_arm_rest[0], (46, 0, -10), one)],
            right_arm: [(1, right_arm_rest[0], (-58, 0, 10), one), (5, right_arm_rest[0], (-8, 0, 10), one), (10, right_arm_rest[0], (46, 0, 10), one), (14, right_arm_rest[0], (-8, 0, 10), one), (19, right_arm_rest[0], (-58, 0, 10), one)],
        },
        "Jump": {
            rig: [(1, *rig_rest), (5, (0, 0.045, 0), (-4, 0, 0), (0.96, 1.1, 0.96)), (11, (0, 0.08, 0), (2, 0, 0), (1.02, 0.97, 1.02)), (19, (0, 0.035, 0), (0, 0, 0), one)],
            left_leg: [(1, left_leg_rest[0], (8, 0, 0), one), (5, left_leg_rest[0], (52, 0, 0), one), (19, left_leg_rest[0], (28, 0, 0), one)],
            right_leg: [(1, right_leg_rest[0], (-8, 0, 0), one), (5, right_leg_rest[0], (-48, 0, 0), one), (19, right_leg_rest[0], (-30, 0, 0), one)],
            left_arm: [(1, *left_arm_rest), (5, left_arm_rest[0], (-72, 0, -12), one), (19, left_arm_rest[0], (-48, 0, -14), one)],
            right_arm: [(1, *right_arm_rest), (5, right_arm_rest[0], (-72, 0, 12), one), (19, right_arm_rest[0], (-48, 0, 14), one)],
        },
        "BlockedPush": {
            rig: [(1, (0, -0.025, -0.025), (14, 0, -1), (1.02, 0.96, 1.02)), (8, (0, -0.055, -0.055), (18, 0, 1), (1.03, 0.94, 1.03)), (16, (0, -0.01, -0.08), (12, 0, -1), (0.99, 1.02, 0.99)), (24, (0, -0.055, -0.055), (18, 0, 1), (1.03, 0.94, 1.03)), (31, (0, -0.025, -0.025), (14, 0, -1), (1.02, 0.96, 1.02))],
            left_leg: [(1, left_leg_rest[0], (14, 0, 0), one), (16, left_leg_rest[0], (8, 0, 0), one), (31, left_leg_rest[0], (14, 0, 0), one)],
            right_leg: [(1, right_leg_rest[0], (-12, 0, 0), one), (16, right_leg_rest[0], (-7, 0, 0), one), (31, right_leg_rest[0], (-12, 0, 0), one)],
            left_arm: [(1, left_arm_rest[0], (-66, 0, -8), one), (8, left_arm_rest[0], (-78, 0, -6), one), (16, left_arm_rest[0], (-62, 0, -8), one), (24, left_arm_rest[0], (-78, 0, -6), one), (31, left_arm_rest[0], (-66, 0, -8), one)],
            right_arm: [(1, right_arm_rest[0], (-66, 0, 8), one), (8, right_arm_rest[0], (-78, 0, 6), one), (16, right_arm_rest[0], (-62, 0, 8), one), (24, right_arm_rest[0], (-78, 0, 6), one), (31, right_arm_rest[0], (-66, 0, 8), one)],
        },
        "EdgeRefuse": {
            rig: [(1, *rig_rest), (3, (0, 0, -0.12), (-18, 0, 0), (1.03, 0.96, 1.03)), (7, (0, 0, -0.08), (-12, 0, 4), one), (11, (0, 0, -0.04), (-7, 0, -2), (1.01, 0.99, 1.01)), (16, *rig_rest)],
            left_leg: [(1, *left_leg_rest), (3, (-0.21, 0.71, 0), (0, -3, 0), one), (7, (-0.22, 0.71, 0), (0, -4, 0), one), (11, (-0.21, 0.71, 0), (0, -2, 0), one), (16, *left_leg_rest)],
            right_leg: [(1, *right_leg_rest), (3, (0.21, 0.71, 0), (0, 3, 0), one), (7, (0.22, 0.71, 0), (0, 4, 0), one), (11, (0.21, 0.71, 0), (0, 2, 0), one), (16, *right_leg_rest)],
            left_arm: [(1, *left_arm_rest), (3, left_arm_rest[0], (18, 0, -72), one), (7, left_arm_rest[0], (10, 0, -56), one), (11, left_arm_rest[0], (5, 0, -38), one), (16, *left_arm_rest)],
            right_arm: [(1, *right_arm_rest), (3, right_arm_rest[0], (18, 0, 72), one), (7, right_arm_rest[0], (10, 0, 56), one), (11, right_arm_rest[0], (5, 0, 38), one), (16, *right_arm_rest)],
        },
        "BoredLook": {
            rig: [(1, *rig_rest), (24, (0, 0.01, 0), (0, -14, -1), one), (50, (0, 0.01, 0), (0, 15, 1), one), (76, (0, 0.01, 0), (0, -8, 0), one), (91, *rig_rest)],
            left_leg: [(1, *left_leg_rest), (91, *left_leg_rest)],
            right_leg: [(1, *right_leg_rest), (91, *right_leg_rest)],
            left_arm: [(1, *left_arm_rest), (50, left_arm_rest[0], (5, 0, -20), one), (91, *left_arm_rest)],
            right_arm: [(1, *right_arm_rest), (50, right_arm_rest[0], (-5, 0, 20), one), (91, *right_arm_rest)],
        },
        "BoredStretch": {
            rig: [(1, *rig_rest), (34, (0, 0.05, 0), (-3, 0, 0), (0.97, 1.08, 0.97)), (67, (0, 0.05, 0), (-3, 0, 0), (0.97, 1.08, 0.97)), (106, *rig_rest)],
            left_leg: [(1, *left_leg_rest), (106, *left_leg_rest)],
            right_leg: [(1, *right_leg_rest), (106, *right_leg_rest)],
            left_arm: [(1, *left_arm_rest), (34, left_arm_rest[0], (-142, 0, -8), one), (67, left_arm_rest[0], (-142, 0, -8), one), (106, *left_arm_rest)],
            right_arm: [(1, *right_arm_rest), (34, right_arm_rest[0], (-142, 0, 8), one), (67, right_arm_rest[0], (-142, 0, 8), one), (106, *right_arm_rest)],
        },
        "BoredTap": {
            rig: [(1, *rig_rest), (91, *rig_rest)],
            left_leg: [(1, *left_leg_rest), (91, *left_leg_rest)],
            right_leg: [(1, *right_leg_rest), (18, (0.2, 0.77, 0.04), (-16, 0, 0), one), (30, *right_leg_rest), (44, (0.2, 0.77, 0.04), (-16, 0, 0), one), (56, *right_leg_rest), (70, (0.2, 0.77, 0.04), (-16, 0, 0), one), (91, *right_leg_rest)],
            left_arm: [(1, *left_arm_rest), (36, left_arm_rest[0], (8, 0, -24), one), (68, left_arm_rest[0], (-4, 0, -18), one), (91, *left_arm_rest)],
            right_arm: [(1, *right_arm_rest), (36, right_arm_rest[0], (-28, 0, 24), one), (68, right_arm_rest[0], (-8, 0, 18), one), (91, *right_arm_rest)],
        },
    }

    for clip_name, objects in clips.items():
        for obj, keyframes in objects.items():
            add_animation_clip(obj, clip_name, keyframes)

    for obj, (location, rotation, scale) in (
        (rig, rig_rest),
        (left_leg, left_leg_rest),
        (right_leg, right_leg_rest),
        (left_arm, left_arm_rest),
        (right_arm, right_arm_rest),
    ):
        set_transform(obj, location, rotation=rotation, scale=scale)


def generate_hero() -> None:
    reset_scene()
    bpy.context.scene.render.fps = 30
    model_root = empty("Hero model")
    root = empty("Hero animation rig", parent=model_root)
    palette = {
        "hair": material("Hero cyan hair", 0x087C9A, roughness=0.42),
        "hairDark": material("Hero dark cyan hair", 0x06485B, roughness=0.5),
        "hairLight": material("Hero bright cyan hair", 0x16A8BF, roughness=0.36),
        "skin": material("Hero warm skin", 0xB96F50, roughness=0.62),
        "skinLight": material("Hero warm skin light", 0xD58C68, roughness=0.58),
        "armor": material("Hero blue overall", 0x123E9A, roughness=0.42, metallic=0.03),
        "armorLight": material("Hero blue overall light", 0x277BD0, roughness=0.36, metallic=0.03),
        "emerald": material("Hero green pauldron", 0x087846, roughness=0.42),
        "emeraldLight": material("Hero green pauldron light", 0x35B960, roughness=0.36),
        "scarf": material("Hero yellow scarf", 0xB76B06, roughness=0.54),
        "scarfLight": material("Hero yellow scarf light", 0xE39A16, roughness=0.46),
        "tunic": material("Hero red tunic", 0x901822, roughness=0.58),
        "tunicLight": material("Hero red tunic light", 0xCB3438, roughness=0.5),
        "trousers": material("Hero blue trousers", 0x102D72, roughness=0.58),
        "leather": material("Hero dark boot leather", 0x24120B, roughness=0.7),
        "leatherLight": material("Hero warm boot leather", 0x5B2C14, roughness=0.62),
        "glove": material("Hero ivory glove", 0xBAB6AA, roughness=0.5),
        "gold": material("Hero gold", 0xC98909, roughness=0.4, metallic=0.08),
        "eye": material("Hero eye", 0x172124, roughness=0.5),
        "highlight": material("Hero highlight", 0xF4EAD2, roughness=0.35),
    }

    left_leg = empty("Left leg", parent=root, location=(-0.2, 0.71, 0))
    right_leg = empty("Right leg", parent=root, location=(0.2, 0.71, 0))
    for side, pivot in ((-1, left_leg), (1, right_leg)):
        sphere("Thick trouser leg", palette["trousers"], (0, -0.16, 0), (0.23, 0.36, 0.23), parent=pivot)
        box(
            "Boot shaft",
            palette["leather"],
            (0, -0.39, -0.015),
            (0.32, 0.38, 0.3),
            rotation=(0, side * 2, 0),
            parent=pivot,
            bevel=0.055,
        )
        box(
            "Boot foot",
            palette["leatherLight"],
            (0, -0.57, 0.15),
            (0.36, 0.2, 0.52),
            rotation=(0, side * 2, 0),
            parent=pivot,
            bevel=0.065,
        )
        box(
            "Boot toe",
            palette["leatherLight"],
            (0, -0.585, 0.39),
            (0.35, 0.16, 0.2),
            rotation=(0, side * 2, 0),
            parent=pivot,
            bevel=0.07,
        )
        box(
            "Boot heel",
            palette["leather"],
            (0, -0.61, -0.09),
            (0.29, 0.14, 0.17),
            parent=pivot,
            bevel=0.035,
        )
        box(
            "Boot sole",
            palette["eye"],
            (0, -0.69, 0.15),
            (0.37, 0.07, 0.58),
            rotation=(0, side * 2, 0),
            parent=pivot,
            bevel=0.025,
        )
        box(
            "Boot cuff",
            palette["leatherLight"],
            (0, -0.22, -0.005),
            (0.38, 0.13, 0.35),
            parent=pivot,
            bevel=0.035,
        )
        box(
            "Boot front strap",
            palette["leather"],
            (0, -0.45, 0.17),
            (0.355, 0.09, 0.38),
            rotation=(0, side * 2, 0),
            parent=pivot,
            bevel=0.025,
        )

    sphere("Short red tunic", palette["tunic"], (0, 1.02, 0), (0.7, 0.69, 0.5), parent=root)
    cylinder("Tunic shadow hem", palette["leather"], (0, 0.78, 0), (0.66, 0.14, 0.47), parent=root)
    box("Red lower tunic flap", palette["tunicLight"], (0, 0.68, 0.32), (0.36, 0.28, 0.12), parent=root)
    cylinder("Golden waist trim", palette["gold"], (0, 0.83, 0), (0.66, 0.12, 0.48), parent=root)
    sphere("Rounded chest armor", palette["armor"], (0, 1.1, 0.22), (0.61, 0.54, 0.27), parent=root)
    sphere("Chest armor highlight", palette["armorLight"], (-0.14, 1.24, 0.42), (0.22, 0.13, 0.05), parent=root)
    for x in (-0.19, 0.19):
        sphere("Overall gold button", palette["gold"], (x, 1.18, 0.475), (0.075, 0.075, 0.035), parent=root)
    cylinder("Scarf lower fold", palette["scarf"], (0, 1.38, 0), (0.75, 0.18, 0.62), parent=root)
    cylinder("Scarf middle fold", palette["scarfLight"], (0, 1.46, 0.025), (0.69, 0.14, 0.58), rotation=(0, 7, 0), parent=root)
    cylinder("Scarf upper fold", palette["scarf"], (0, 1.53, -0.015), (0.63, 0.12, 0.54), rotation=(0, -8, 0), parent=root)
    box("Scarf highlight", palette["scarfLight"], (-0.24, 1.47, 0.32), (0.2, 0.11, 0.05), rotation=(0, 0, -8), parent=root)
    box("Scarf tail", palette["scarf"], (-0.24, 1.27, -0.34), (0.2, 0.38, 0.1), rotation=(14, 0, -15), parent=root)

    left_arm = empty("Left arm", parent=root, location=(-0.49, 1.24, 0))
    right_arm = empty("Right arm", parent=root, location=(0.47, 1.22, 0))
    set_transform(left_arm, (-0.49, 1.24, 0), rotation=(0, 0, -18))
    set_transform(right_arm, (0.47, 1.22, 0), rotation=(0, 0, 18))
    sphere("Emerald pauldron", palette["emerald"], (-0.025, 0, 0.01), (0.39, 0.36, 0.38), parent=left_arm)
    sphere("Pauldron highlight", palette["emeraldLight"], (-0.12, 0.09, 0.2), (0.15, 0.12, 0.07), parent=left_arm)
    sphere("Short blue sleeve", palette["armor"], (0, -0.23, 0), (0.2, 0.35, 0.21), parent=left_arm)
    cylinder("Blue forearm cuff", palette["armorLight"], (0, -0.4, 0.02), (0.23, 0.22, 0.23), parent=left_arm)
    sphere("Left white glove", palette["glove"], (0, -0.55, 0.05), (0.27, 0.24, 0.28), parent=left_arm)
    sphere("Red upper sleeve", palette["tunicLight"], (0, -0.17, 0), (0.24, 0.42, 0.24), parent=right_arm)
    sphere("Blue gauntlet", palette["armor"], (0, -0.42, 0.02), (0.24, 0.36, 0.25), parent=right_arm)
    for y in (-0.33, -0.44):
        cylinder("Golden gauntlet strap", palette["gold"], (0, y, 0.02), (0.25, 0.055, 0.26), parent=right_arm)
    sphere("Right white glove", palette["glove"], (0, -0.61, 0.06), (0.28, 0.25, 0.29), parent=right_arm)

    sphere("Cyan hair mass", palette["hairDark"], (0, 1.92, -0.03), (1.01, 1.03, 0.9), parent=root)
    sphere("Round face", palette["skin"], (0, 1.82, 0.38), (0.73, 0.72, 0.32), parent=root)
    sphere("Bright cyan hair cap", palette["hair"], (0, 2.12, -0.03), (0.99, 0.65, 0.86), parent=root)
    for x, y, dimensions, roll in (
        (-0.27, 2.07, (0.27, 0.27, 0.13), -11),
        (0, 2.02, (0.29, 0.32, 0.14), 0),
        (0.27, 2.07, (0.27, 0.27, 0.13), 11),
    ):
        box("Segmented bang", palette["hair"], (x, y, 0.46), dimensions, rotation=(0, 0, roll), parent=root)
    for x, roll in ((-0.44, -6), (0.44, 6)):
        box("Upper side lock", palette["hair"], (x, 1.79, 0.3), (0.18, 0.36, 0.17), rotation=(0, 0, roll), parent=root)
    for x, roll in ((-0.45, -10), (0.45, 10)):
        box("Lower side lock", palette["hairDark"], (x, 1.6, 0.29), (0.15, 0.2, 0.15), rotation=(0, 0, roll), parent=root)
    sphere("Hair highlight", palette["hairLight"], (-0.25, 2.25, 0.37), (0.23, 0.13, 0.06), parent=root)
    for x in (-0.42, 0.42):
        sphere("Ear", palette["skinLight"], (x, 1.79, 0.21), (0.14, 0.19, 0.12), parent=root)
    for x in (-0.14, 0.14):
        sphere("Eye", palette["eye"], (x, 1.82, 0.56), (0.05, 0.075, 0.028), parent=root)
        sphere("Eye highlight", palette["highlight"], (x - 0.012, 1.844, 0.584), (0.014, 0.019, 0.009), parent=root)
    sphere("Nose", palette["skinLight"], (0, 1.74, 0.56), (0.045, 0.035, 0.025), parent=root)
    box("Mouth", palette["eye"], (0, 1.68, 0.558), (0.065, 0.015, 0.012), parent=root, bevel=0.004)
    sphere("Ponytail knot", palette["hair"], (0, 2.38, -0.46), (0.32, 0.29, 0.32), parent=root)
    cylinder("Ponytail band", palette["gold"], (0, 2.3, -0.46), (0.22, 0.1, 0.22), parent=root)
    for name, location, rotation, mat in (
        ("Ponytail upper tuft", (0, 2.54, -0.48), (0, 0, 0), palette["hairLight"]),
        ("Ponytail left tuft", (-0.15, 2.48, -0.5), (0, 0, 20), palette["hair"]),
        ("Ponytail right tuft", (0.15, 2.48, -0.5), (0, 0, -20), palette["hair"]),
        ("Ponytail rear tuft", (0, 2.42, -0.64), (48, 0, 0), palette["hairDark"]),
    ):
        cone(name, mat, location, (0.22, 0.24, 0.22), rotation=rotation, parent=root)
    add_hero_animations(root, left_leg, right_leg, left_arm, right_arm)
    export("hero/hero.glb")


CASTLE_DOOR_INNER_RADIUS = 1.0
CASTLE_DOOR_SPRING_HEIGHT = 1.25


def generate_doors() -> None:
    reset_scene()
    root = empty("Castle doors")
    wood = wood_material("Castle door wood")
    wood_shadow = material("Castle door shadowed wood", 0x241109, roughness=0.92)
    iron = material("Castle door forged iron", 0x050708, roughness=0.48, metallic=0.66)
    hinges = []

    def arch_height(distance_from_hinge: float) -> float:
        distance_from_center = CASTLE_DOOR_INNER_RADIUS - distance_from_hinge
        return CASTLE_DOOR_SPRING_HEIGHT + math.sqrt(
            max(0, CASTLE_DOOR_INNER_RADIUS**2 - distance_from_center**2)
        )

    for name, side in (("Left castle door", -1), ("Right castle door", 1)):
        hinge = empty(f"{name} hinge", parent=root, location=(side, 0, 0))
        hinges.append((hinge, side))
        direction = -side

        backing_outline = [(0, 0), (direction, 0)]
        backing_outline.extend(
            (direction * distance, arch_height(distance))
            for distance in (1, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0)
        )
        prism(
            f"{name} dark backing",
            wood_shadow,
            backing_outline,
            0.14,
            parent=hinge,
            bevel=0,
        )

        plank_count = 4
        gap = 0.014
        for plank_index in range(plank_count):
            near = plank_index / plank_count + gap
            far = (plank_index + 1) / plank_count - gap
            outline = [
                (direction * near, 0),
                (direction * far, 0),
                (direction * far, arch_height(far)),
                (direction * near, arch_height(near)),
            ]
            prism(
                f"{name} plank {plank_index + 1}",
                wood,
                outline,
                0.17,
                parent=hinge,
                bevel=0.012,
            )

        for face in (-1, 1):
            face_depth = face * 0.105
            for band_index, (height, width) in enumerate(
                ((0.42, 0.84), (1.02, 0.78), (1.56, 0.64)),
            ):
                box(
                    f"{name} iron strap {band_index + 1}",
                    iron,
                    (direction * width / 2, height, face_depth),
                    (width, 0.09, 0.042),
                    parent=hinge,
                    bevel=0.012,
                )
                for distance in (0.15, width - 0.15):
                    cylinder(
                        f"{name} iron stud",
                        iron,
                        (direction * distance, height, face * 0.137),
                        (0.072, 0.035, 0.072),
                        rotation=(90, 0, 0),
                        parent=hinge,
                        vertices=10,
                    )

            box(
                f"{name} hinge spine",
                iron,
                (direction * 0.075, 0.8, face_depth),
                (0.11, 1.48, 0.045),
                parent=hinge,
                bevel=0.012,
            )
            box(
                f"{name} meeting stile",
                iron,
                (direction * 0.96, 0.78, face_depth),
                (0.075, 1.42, 0.045),
                parent=hinge,
                bevel=0.01,
            )
            box(
                f"{name} diagonal brace",
                iron,
                (direction * 0.52, 1.78, face_depth),
                (0.62, 0.075, 0.038),
                rotation=(0, 0, -direction * 18),
                parent=hinge,
                bevel=0.01,
            )
            cylinder(
                f"{name} handle mount",
                iron,
                (direction * 0.78, 0.9, face * 0.14),
                (0.13, 0.04, 0.13),
                rotation=(90, 0, 0),
                parent=hinge,
                vertices=12,
            )
            torus(
                f"{name} ring handle",
                iron,
                (direction * 0.78, 0.81, face * 0.19),
                0.095,
                0.018,
                rotation=(90, 0, 0),
                parent=hinge,
            )
    for hinge, side in hinges:
        add_animation_clip(
            hinge,
            "Open",
            [
                (1, (side, 0, 0), (0, 0, 0), (1, 1, 1)),
                (31, (side, 0, 0), (0, -side * 92, 0), (1, 1, 1)),
            ],
        )
    export("castle/doors/castle-doors.glb")


def generate_arch() -> None:
    reset_scene()
    root = empty("Castle entrance arch")
    stone = stone_material("Castle arch stone", 0x424B4F)
    mortar = material("Castle arch mortar", 0x0E1315, roughness=0.94)
    inner_radius = CASTLE_DOOR_INNER_RADIUS
    outer_radius = 1.31
    spring_height = CASTLE_DOOR_SPRING_HEIGHT
    # Reaches inward to overlap the closed doors, so there is no bright seam
    # between the imported frame and the animated leaves.
    depth = 0.5
    jamb_width = outer_radius - inner_radius
    rows = math.ceil(spring_height / 0.31)
    for side in (-1, 1):
        box(
            f"Castle arch solid jamb {side}",
            mortar,
            (side * (inner_radius + jamb_width / 2), spring_height / 2, 0),
            (jamb_width, spring_height, depth * 0.82),
            parent=root,
            bevel=0,
        )
        for row in range(rows):
            height = min(0.31, spring_height - row * 0.31)
            box(
                f"Castle arch jamb stone {side} {row}",
                stone,
                (side * (inner_radius + jamb_width / 2), row * 0.31 + height / 2, 0),
                (jamb_width * (1.08 if row % 2 == 0 else 0.96), max(0.04, height - 0.004), depth),
                parent=root,
                bevel=0.01,
            )
    for segment in range(9):
        raw_start = math.pi - segment / 9 * math.pi
        raw_end = math.pi - (segment + 1) / 9 * math.pi
        core_outline = [
            (math.cos(raw_start) * inner_radius, spring_height + math.sin(raw_start) * inner_radius),
            (math.cos(raw_end) * inner_radius, spring_height + math.sin(raw_end) * inner_radius),
            (math.cos(raw_end) * outer_radius, spring_height + math.sin(raw_end) * outer_radius),
            (math.cos(raw_start) * outer_radius, spring_height + math.sin(raw_start) * outer_radius),
        ]
        prism(
            f"Castle arch solid wedge {segment}",
            mortar,
            core_outline,
            depth * 0.82,
            parent=root,
            bevel=0,
        )
        gap = 0.003
        start = raw_start - gap
        end = raw_end + gap
        face_outline = [
            (math.cos(start) * inner_radius, spring_height + math.sin(start) * inner_radius),
            (math.cos(end) * inner_radius, spring_height + math.sin(end) * inner_radius),
            (math.cos(end) * outer_radius, spring_height + math.sin(end) * outer_radius),
            (math.cos(start) * outer_radius, spring_height + math.sin(start) * outer_radius),
        ]
        prism(
            f"Castle arch face stone {segment}",
            stone,
            face_outline,
            depth,
            parent=root,
            bevel=0.005,
        )
    export("castle/doors/entrance-arch.glb")


def royal_materials(role: str) -> dict[str, bpy.types.Material]:
    styles = {
        "king": (0x8F2638, 0xC3424F, 0x4A2B1E),
        "queen": (0x315AA6, 0x5884CF, 0x6B3B22),
        "princess": (0xA63E70, 0xD76598, 0x5B321F),
    }
    robe, robe_light, hair = styles[role]
    return {
        "robe": material(f"{role} robe", robe),
        "robeLight": material(f"{role} robe light", robe_light),
        "hair": material(f"{role} hair", hair),
        "skin": material("Royal skin", 0xB97855),
        "skinLight": material("Royal skin light", 0xD6956F),
        "eye": material("Royal eye", 0x171719),
        "gold": material("Royal gold", 0xD8A936, roughness=0.35, metallic=0.34),
        "goldLight": material("Royal gold light", 0xF0CF62, roughness=0.3, metallic=0.3),
        "boot": material("Royal boot", 0x3D241C),
    }


def generate_royal(role: str) -> None:
    reset_scene()
    mats = royal_materials(role)
    root = empty(f"Seated {role}")
    box("Royal seated robe", mats["robe"], (0, 0.73, 0), (0.68, 0.75, 0.46), parent=root, bevel=0.06)
    box("Royal robe front", mats["robeLight"], (0, 0.47, 0.25), (0.52, 0.56, 0.12), parent=root, bevel=0.035)
    box("Royal belt", mats["gold"], (0, 0.82, 0.255), (0.66, 0.09, 0.08), parent=root, bevel=0.015)
    for x in (-0.2, 0.2):
        box("Royal bent leg", mats["robe"], (x, 0.42, 0.37), (0.25, 0.24, 0.44), rotation=(-18, 0, 0), parent=root, bevel=0.04)
        box("Royal boot", mats["boot"], (x, 0.23, 0.58), (0.29, 0.22, 0.4), parent=root, bevel=0.045)
    for x, roll in ((-0.42, -8), (0.42, 8)):
        box("Royal sleeve", mats["robeLight"], (x, 0.78, 0.11), (0.24, 0.55, 0.26), rotation=(12, 0, roll), parent=root, bevel=0.05)
        box("Royal hand", mats["skin"], (x * 0.91, 0.53, 0.29), (0.2, 0.2, 0.2), parent=root, bevel=0.055)
    box("Royal neck", mats["skin"], (0, 1.16, 0), (0.22, 0.2, 0.2), parent=root, bevel=0.045)
    box("Royal hair mass", mats["hair"], (0, 1.48, -0.035), (0.71, 0.7, 0.57), parent=root, bevel=0.09)
    box("Royal face", mats["skinLight"], (0, 1.43, 0.28), (0.62, 0.52, 0.13), parent=root, bevel=0.06)
    for x in (-0.16, 0.16):
        box("Royal eye", mats["eye"], (x, 1.5, 0.355), (0.055, 0.085, 0.035), parent=root, bevel=0.01)
    box("Royal nose", mats["skin"], (0, 1.4, 0.36), (0.06, 0.06, 0.045), parent=root, bevel=0.012)
    if role in ("queen", "princess"):
        for x in (-0.31, 0.31):
            box("Royal long side hair", mats["hair"], (x, 1.25, 0.06), (0.18, 0.58, 0.23), parent=root, bevel=0.04)
    if role == "king":
        box("King beard", mats["hair"], (0, 1.25, 0.34), (0.42, 0.28, 0.11), rotation=(-8, 0, 0), parent=root, bevel=0.035)
    crown_scale = {"king": 1, "queen": 0.92, "princess": 0.72}[role]
    crown = empty(f"{role} crown", parent=root, location=(0, 1.86, -0.01))
    set_transform(crown, (0, 1.86, -0.01), scale=(crown_scale,) * 3)
    box("Crown band", mats["gold"], (0, 0, 0), (0.58, 0.14, 0.47), parent=crown, bevel=0.025)
    points = (-0.18, 0, 0.18) if role == "princess" else (-0.23, 0, 0.23)
    for x in points:
        height = 0.31 if x == 0 else 0.24
        cone("Crown point", mats["goldLight"], (x, 0.12 + height / 2, 0.02), (0.16, height, 0.16), parent=crown)
    export(f"castle/royals/{role}.glb")


def generate_throne() -> None:
    reset_scene()
    root = empty("Throne")
    wood = material("Throne dark wood", 0x4A281A, roughness=0.76)
    wood_light = material("Throne light wood", 0x6B3A22, roughness=0.7)
    gold = material("Throne gold", 0xD8A936, roughness=0.34, metallic=0.3)
    for level in range(3):
        width = 2.6 - level * 0.32
        depth = 1.55 - level * 0.2
        box("Throne dais step", wood_light if level % 2 else wood, (0, 0.09 + level * 0.14, 0.1), (width, 0.18, depth), parent=root, bevel=0.045)
    box("Throne seat", wood_light, (0, 0.6, 0), (1.3, 0.28, 0.82), parent=root, bevel=0.06)
    box("Throne back", wood, (0, 1.38, 0.36), (1.38, 1.82, 0.24), parent=root, bevel=0.065)
    for lateral in (-0.74, 0.74):
        cylinder("Throne carved post", gold, (lateral, 1.31, 0.36), (0.16, 1.72, 0.16), parent=root, vertices=10)
        box("Throne arm", wood_light, (lateral * 0.82, 0.89, -0.05), (0.18, 0.2, 0.76), parent=root, bevel=0.04)
    box("Throne crown crest", gold, (0, 2.34, 0.37), (0.62, 0.24, 0.14), parent=root, bevel=0.04)
    export("castle/throne/throne.glb")


def join_objects(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    result.data.name = f"{name} mesh"
    result.select_set(False)
    return result


def generate_gateway() -> None:
    reset_scene()
    root = empty("Gateway frame")
    stones = [
        # glTF base colors are linear; these deliberately low values render in
        # the same range as the castle's darker, texture-multiplied masonry.
        material("Gateway stone dark", 0x090D0F, roughness=0.88),
        material("Gateway stone mid", 0x111719, roughness=0.86),
        material("Gateway stone light", 0x1B2326, roughness=0.84),
    ]
    size = 0.25
    grouped: list[list[bpy.types.Object]] = [[], [], []]

    def position(column: int, row: int, depth: int):
        return ((depth - 1) * size, (row + 0.5) * size, (column - 7.5) * size)

    def add(column: int, row: int, depth: int) -> None:
        index = abs(column * 17 + row * 31 + depth * 13) % len(stones)
        grouped[index].append(box("Gateway block", stones[index], position(column, row, depth), (size, size, size), parent=root, bevel=0.018))

    for depth in range(3):
        for row in range(13):
            for column in range(4):
                add(column, row, depth)
                add(15 - column, row, depth)
        for row in range(8, 11):
            for column in range(4, 12):
                add(column, row, depth)
        add(4, 6, depth)
        add(11, 6, depth)
        for column in (4, 5, 10, 11):
            add(column, 7, depth)
        for start in (4, 7, 10):
            add(start, 11, depth)
            add(start + 1, 11, depth)
        for column in range(4):
            add(column, 13, depth)
            add(15 - column, 13, depth)
        for column in (0, 3, 12, 15):
            add(column, 14, depth)
    for depth in (-1, 3):
        for column in range(4):
            add(column, 13, depth)
            add(15 - column, 13, depth)

    for index, objects in enumerate(grouped):
        if not objects:
            continue
        objects[0].parent = root
        joined = join_objects(objects, f"Gateway stonework {index + 1}")
        joined.parent = root
    empty("Gateway banner anchor", parent=root, location=(0.387, 2.7, 0))
    empty("Gateway portal anchor", parent=root, location=(0, 0, 0))
    export("gateway/gateway-frame.glb")


generate_hero()
generate_doors()
generate_arch()
for royal_role in ("king", "queen", "princess"):
    generate_royal(royal_role)
generate_throne()
generate_gateway()
