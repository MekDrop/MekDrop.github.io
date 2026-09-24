# Game Code Style Rules

Read this when changing class internals, accessors, mutators, errors, enums, or registry keys, especially under `src/game/`.

For class methods that are zero-argument, read-only accessors, prefer ES6 getter syntax (`get value()`) over `getValue()` methods when the method is called like property access.

For class mutators that are simple one-argument property writes and are naturally used as properties, prefer ES6 setter syntax (`set value(...)`) over explicit methods.

For JavaScript class internals, use modern ES private class syntax (`#privateField`, `#privateMethod()`) instead of underscore-prefixed pseudo-private fields or methods.

Prefer one primary class per JavaScript file when the code models a distinct system or component. Avoid large utility-style files that accumulate many unrelated constants, variables, and free functions when that logic belongs inside a cohesive class.

When a `Map`, registry, or lookup key represents a class-owned type or instance category, prefer the class name (`SomeClass.name`) as the key wherever possible instead of maintaining a parallel string constant.

Never throw or reject with the built-in `Error` directly (`new Error(...)`). Define a named custom class that extends `Error`; the class must own its predefined message or message template, while call sites pass only structured context needed by that template. Use a separate error class for each distinct failure condition: call sites must not provide an error message or select one through an error code.

Store every error owned or thrown by code under `src/game/` in `src/game/errors/`, even when the failure involves a browser API. Store errors for code outside the game subsystem in `src/errors/`.

Within each error root, group classes into subfolders by their owning feature or area, for example `map/`, `castle/`, `path/`, `screenshot/`, or `assets/`, and import them through that area's index file.

Model enums as frozen plain objects (`export const GRAPHICS_DRIVER = Object.freeze({ ... })`) whose values are primitive literals. Name the export in SCREAMING_SNAKE_CASE and keys in SCREAMING_SNAKE_CASE. Define exactly one enum per file, in a PascalCase file named after the enum, for example `GraphicsDriver.js`.

Store enums owned by code under `src/game/` in `src/game/enum/`; store enums for code outside the game subsystem in `src/enum/`. Do not declare enum-like frozen literal objects anywhere else, and do not put anything other than the single enum into an enum file. ESLint enforces these rules via `no-restricted-syntax` overrides in `eslint.config.js`.
