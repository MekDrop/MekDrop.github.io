# Repository Code Style

Follow `.editorconfig`: UTF-8, LF endings, two-space indentation, final newlines, and no trailing whitespace. Vue component filenames and component names use PascalCase. Prefer configured aliases over deep relative imports. Use explicit braces for guard conditionals.

## JavaScript and JSDoc

- Name abstract base classes with an `Abstract` prefix or `Base` suffix, mark them `@abstract`, and do not instantiate them directly. Prefer `Abstract` for polymorphic contracts.
- Specify every function and method argument with JSDoc `@param`. Document class property types and getter return types with `@returns`, except a getter that directly returns an already-typed property.
- Use specific named types where code depends on object properties or methods; avoid broad placeholder types such as `object`, `*`, or `unknown`. Type polymorphic collections to their shared abstract base class.
- Format class and method JSDoc as multiline starred blocks. Keep abstract or overridable method documentation concise and limited to non-obvious responsibilities, inputs, outputs, or lifecycle behavior.
- Before adding custom JSDoc or lint enforcement, check npm for an established, maintained ESLint package that provides the rule.

ESLint and Prettier configuration are authoritative for enforced style. Game-specific class, error, enum, and registry conventions are in [game-code-style.md](game-code-style.md).

## Repository Workflow

Keep commits focused and use short imperative summaries. Store temporary helper, conversion, migration, or diagnostic scripts in the ignored project-root `tmp/`; never stage or commit its contents.
