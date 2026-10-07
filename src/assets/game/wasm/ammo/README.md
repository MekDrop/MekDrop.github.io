# Ammo WebAssembly

Vendored from PlayCanvas Engine v2.21.4, matching the installed engine:

- https://github.com/playcanvas/engine/blob/v2.21.4/examples/assets/wasm/ammo/ammo.wasm.js
- https://github.com/playcanvas/engine/blob/v2.21.4/examples/assets/wasm/ammo/ammo.wasm.wasm

Ammo/Bullet uses the zlib license. The loader contains the upstream notice.
Keep the loader and binary together when updating.

The upstream glue has one appended ES module export. Initialization binds its legacy factory to globalThis for both browser and worker use.
