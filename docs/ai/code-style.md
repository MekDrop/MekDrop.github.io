# Repository Code Style

Follow `.editorconfig`: UTF-8, LF endings, two-space indentation, final newlines, and no trailing whitespace. Vue component filenames and component names use PascalCase. Prefer configured aliases over deep relative imports. Use explicit braces for guard conditionals.

## JavaScript and JSDoc

- In class code, extract repeated object creation or placement with substantial shared configuration into a named private method. For a fixed pair of placements (such as left and right entrance lanterns), call the method twice explicitly, for example `this.#addEntranceLantern(add, layout, entrance, -1)` and `this.#addEntranceLantern(add, layout, entrance, 1)`, instead of wrapping the configuration in `for (const flank of [-1, 1])`. Keep shared configuration inside the method and pass only the context and values that vary. Preserve placement order and behavior. Keep loops for genuinely data-driven collections or variable counts; do not unroll those into individual calls.
- If a base constructor invokes an overridden setup hook, use static private helpers for extracted setup in the subclass, passing the instance explicitly when needed. Subclass instance private methods are not available until `super()` returns.
- Prefer named private class methods (`#callback()`) for class-owned callbacks whenever they can be extracted without changing behavior, including callbacks in class-field initializers. Use static private methods for callbacks that do not need instance state. Pass the method directly when it does not need a receiver; otherwise bind the instance or use a private arrow-function field, preserving the same callback reference wherever listener cleanup requires it. Keep closures when they capture per-call local state or defer access to `this` until after `super()`. Preserve callback arguments, return values, and asynchronous behavior. Apply this to collection callbacks, event handlers, timers, and promise handlers as well as named local functions; do not introduce classes solely to house callbacks outside classes.
- Use the library's two-dimensional vector type (`Vec2` in PlayCanvas, also commonly called `Vector2`) for runtime positions, offsets, directions, and other 2D vectors instead of custom `{ x, y }` objects or duplicate vector classes. For example, use `new pc.Vec2(0, 0)` instead of `{ x: 0, y: 0 }`. Use the vector type in JSDoc as well. Keep plain coordinate objects only where a serialized data format or external API requires them, and convert at that boundary.
- Name abstract base classes with an `Abstract` prefix or `Base` suffix, mark them `@abstract`, and do not instantiate them directly. Prefer `Abstract` for polymorphic contracts.
- Specify every function and method argument with JSDoc `@param`. Document class property types and getter return types with `@returns`, except a getter that directly returns an already-typed property.
- Use specific named types where code depends on object properties or methods; avoid broad placeholder types such as `object`, `*`, or `unknown`. Type polymorphic collections to their shared abstract base class.
- Format class and method JSDoc as multiline starred blocks. Keep abstract or overridable method documentation concise and limited to non-obvious responsibilities, inputs, outputs, or lifecycle behavior.
- Before adding custom JSDoc or lint enforcement, check npm for an established, maintained ESLint package that provides the rule.

ESLint and Prettier configuration are authoritative for enforced style. Game-specific class, error, enum, and registry conventions are in [game-code-style.md](game-code-style.md).

Place constructor `super()` calls on their own lines, with a blank line before any following statement. Multiline arguments are allowed; no blank line is required when `super()` is the last statement.

Write object literals with two or more properties on multiple lines: put each property or spread on its own line, place the braces on separate lines, indent properties by two spaces, and include a trailing comma. ESLint enforces the object layout after the Prettier compatibility configuration. `npm run format` reapplies ESLint fixes after Prettier; when running Prettier directly, run `npm run lint -- --fix` afterward to restore this layout.

In `if` conditions, pass named predicates or call named helpers instead of defining inline arrow or function callbacks. For example, use `values.every(isPositiveFiniteNumber)` or `everyFiniteNumber(values)`. ESLint enforces this for callbacks inside the condition; callbacks in the branch body remain allowed.

## Repository Workflow

Keep commits focused and use short imperative summaries. Store temporary helper, conversion, migration, or diagnostic scripts in the ignored project-root `tmp/`; never stage or commit its contents.
