# Selective game updates in SPA development

Run `npm run dev:spa`. Vite boundaries are installed only for SPA development;
production, SSR and SSG use their normal module graph. Restart an already-running
server once after changing `quasar.config.js` or the HMR plugin.

Each open tab uses its active map to decide whether a save affects its scene.
An object outside the camera view still counts if it belongs to that map.

| Saved change | Result |
| --- | --- |
| Registered object absent from the active map | Install its new constructor for future maps; leave the current scene alone |
| Static visual-only castle prop, such as `Chair` | Replace its model, materials, batches and authored colliders; retain object/root identity, hero and camera |
| Stateful registered object or enemy present in the map | Rebuild the active map through the existing loading lifecycle; retain the camera viewport |
| Current test-map JSON | Replace that map's loader and rebuild the map; retain the camera viewport |
| Other test-map JSON | Keep the current map running; use the updated JSON when navigating there |
| Coin, life, mood, game-status or map-test HUD | Replace that HUD only; preserve dependencies, visibility and supported display state |
| Renderer, shared infrastructure, inventory/game-over UI or a dependency with another unhandled import path | Existing full-page reload fallback |

Map rebuilds restart map gameplay, including enemies and hero state. Only local
prop/HUD updates preserve the running gameplay state. Do not rely on an HMR
session to validate a fresh game startup.

## Ownership and cleanup

`scripts/game-hmr/vite-plugin.cjs` generates literal `import.meta.hot.accept`
lists from the canonical `MapObjectFactory` imports, enemy entry points and saved
test-map filenames. Keep adding objects through the factory and map `objects`
array; there is no additional object manifest to maintain.

The UI barrel uses live exports in development so future HUD creation receives
the latest constructor. `HudCollection` retains construction options and uses
the HUD's optional `developmentState` getter/setter when replacing a live HUD.
The replacement is constructed and attached before the old instance is retired.

The plugin marks direct `AbstractCastleProp` subclasses as locally replaceable
only when every member is a static model or collision declaration (`modelUrl`,
`modelUrls`, `hasAuthoredCollision`, `omittedModelNodes`). Constructors, instance
fields (including private fields), and instance methods require a map rebuild.
This avoids prototype patching and private-field brand mismatches. The base owns
collider teardown, model disposal and rebatching while retaining the public root.

`GameDevelopmentReload` coalesces rapid saves and waits for map navigation before
checking the active map. Unmount cancels pending work and removes its subscription.
Errors use the normal game runtime-error reporting path. Syntax errors remain
visible through Vite's error handling; an invalid module is not installed.

Shared dependencies can reach multiple HMR boundaries. An unhandled import path
still triggers the full reload fallback deliberately; adding an empty accept
handler would hide stale code rather than update its existing owners.

## Focused verification

Run the tests under `test/unit/game/development/`, the game HMR plugin tests under
`test/unit/scripts/game-hmr/`, `castle-prop-hot-reload.test.js`, and the HUD
collection/test-control tests. Browser checks should save real files while two
normal test-map routes are open and verify both the affected and unaffected tabs.
