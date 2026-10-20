# special-artojas

Tripo H3.1 character generated from the selected portrait concept. The editable
`special-artojas.blend` is the source for `special-artojas.glb`. Textures are
embedded; the GLB has 4,726 triangles and a 57-joint humanoid skin.

Select the live playable model through the existing graphics settings store:

```js
graphicsSettingsStore.heroModel = "special-artojas";
graphicsSettingsStore.heroModel = "heroe"; // default
```

Both assets preload through `Hero.modelUrls`. Hero owns selection and replacement;
the setting takes effect on the ground after the current action and mood reaction
finish. Switching preserves the hero's position, inventory, health and controls.
Unknown model names resolve to `heroe`. The store follows the existing graphics
settings' session-only lifetime.

Use `/map/test_special-artojas?camera-test` for the two model-switch HUD buttons.
Click or rub the hero's head to use the existing animated patting hand.

The Tripo auto-rig export incorrectly assigned almost all vertices to Hips.
The editable source repairs those weights, aligns the skeleton to the textured
mesh, and preserves the semantic joints used by Hero. Idle, Walk, Run and
PatAnnoyed are authored on this fitted rig. The remaining clip names are carried
from the production hero export. HappyPat, AngryPat, AnnoyedPat and Blink shapes
are available to the shared facial-reaction code.

The neutral soles are authored at height zero, matching Hero's terrain contact
origin. HappyPat widens the textured lips, lifts the mouth corners and cheeks,
and squints the eyes; the deformation is localized to the actual facial surface.

This variant uses a continuous skinned mesh. It does not have the default hero's
separate boot-surface adjustment meshes, physical hair locks or individually
articulated gloves. Advanced tool and climbing contacts have not been calibrated
for these different proportions.

Regenerate the adjacent GLB with `npm run blender:export`. Provider details and
source hashes are in `provenance.json`.
