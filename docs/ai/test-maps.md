# Reproducible game previews

For main-object `preview.png` captures, reuse these routes and the small
`/map/test_object-previews` fixture for flag, painting, window, fire, and
ground-cover variants. Render the complete representative object into a
transparent RGBA target using the production meshes and materials; exclude HUD,
unrelated meshes, and their shadow casters. Include opaque and transparent passes,
calculate bounds from instance transforms for batched geometry, and check image
orientation (WebGPU and WebGL readback use different row conventions). Particle
materials normally disable alpha writes; enable them only for capture and export
straight alpha. Verify visible pixels, transparent pixels, and clear image margins.
Refresh the owning main object's preview after appearance changes; do not create
separate previews for its subobjects or component parts.

Use saved JSON maps under `src/game/maps/tests/` for interactive visual checks.
Open them through the normal `/map/test_<filename>` route. Reuse production
object classes, camera, lighting, HUD, physics, and asset loading. Do not create
standalone HTML/JavaScript preview apps when a test map can cover the behavior.
Temporary conversion scripts and offline Blender renders still belong in `tmp/`.

Testing controls belong in the map's optional `testControls.panels` properties,
rendered by `src/game/ui/MapTestControlsHud.js`. Do not add visible HTML controls
over the game canvas or put entity-specific testing branches in the renderer.
All scene entities must still be authored through `objects`.

```json
{
  "testControls": {
    "panels": [{
      "title": "Castle entrance",
      "x": 16,
      "y": 140,
      "statusTargetId": "entrance-castle",
      "buttons": [
        {"label": "Open doors", "script": "for (const castle of objects.getAll('castle')) { if (castle.definition.id === 'entrance-castle') castle.testEntranceOpenAmount = 1; }"},
        {"label": "Entrance view", "script": "camera.setViewport({zoom: 4.5, rotation: 2, panX: -1, panZ: -6});"}
      ]
    }]
  }
}
```

Panel coordinates use the HUD's 1280 × 720 reference resolution, measured from
the top left. Maps with multiple panels automatically show them as tabs in a
fixed-width HUD at (16, 106), joined to the selected panel at (16, 140).
Tabs use flat borders, with the active tab sharing the panel's surface.
The `<` and `>` buttons scroll the tab strip one tab at a time; selecting a tab
shows only that group's controls and live status. Existing panel titles become
tab labels. Explicit panel positions still apply to maps with a single panel.
Use `animationViewport` for the initial camera, and `heroSpawn` for reproducible
actor placement. Test map controls appear only on maps declaring these properties.

Place buildings on normal terrain. Do not replace their footprint or surrounding
lawn with a broad path patch to avoid grass clipping. Include a `tileMeta` matrix
with an object for every grid cell so castle preparation can publish foundation
cutouts and suppress indoor grass while retaining turf beside the walls.

Each button owns a `script` string, executed once per completed press, like
`TriggerArea.script`. Scripts run in strict mode with `active` set to `true`,
the live `objects` registry (`getAll`, iteration, etc.), `trigger` and `button`
as aliases for the button definition, the current `map`, and
`camera.setViewport(viewport)`. Compilation and execution failures go through
normal runtime error reporting. Scripts have the same JavaScript privileges as
trigger scripts; they are authored project code, not a sandbox for external code.
Keep scripts short and put substantial behavior in the owning object class.
Expose optional `testStatus` for live panel text selected by `statusTargetId`.

Set `castle.testEntranceOpenAmount` to `1` to open, `0` to close, or `null` to
restore automatic proximity behavior. These commands change the
destination of exterior doors only; the normal inward animation, swing collision,
and obstruction checks remain active. Status shows the actual opening percentage.
Direct clicks on a door release its forced test destination and use the normal
temporary opening behavior, so test buttons cannot silently disable interaction.
Use `/map/test_castle-entrance` for entrance checks, including both camera presets.

Verify button clicks, outside-panel gameplay input, both camera presets, live
status, and switching to a map without controls. Capture the real game route for
visual evidence. Run the focused dispatcher test and lint changed files.

For interior architectural changes, capture first-person views from inside with doors both open and closed. Provide a repeatable inside-view control using the hero's teleport API and camera.setFirstPerson(enabled); an outside screenshot alone does not verify the inside wall.
