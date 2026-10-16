# Shelf

`Shelf` owns the cabinet model, static compound collision, island placement,
and teardown. Castle preparation publishes storage and study cabinets into the
map's normal `objects` array; the renderer has no shelf-specific branch.

- The default cabinet uses `from`, `to`, `height`, `facing`, `joinStart`, and
  `joinEnd`. It preserves the former bookshelf's modular boards and book packing.
  `seed` makes the individual book arrangement repeatable; `books: false` leaves
  the cabinet empty.
- `variant: "storage"` uses the original storage rack with `position`, `rotation`,
  and optional `scale`/`stretch`. Omitted `items` retains its authored supply crates.
- `items` replaces the default contents on either cabinet. Each entry is a normal
  map-object definition. Its `position` is shelf-local, measured from the bottom
  center; its heading and scale are relative to the shelf. Entries without a
  position are spaced across the bottom board. Use explicit poses and suitable
  item scales for multiple levels or large items. `items: []` creates an empty rack.

Contents become independently registered map objects with stable IDs,
`sourceShelfId`, and shared tile ownership. Books retain their interaction and
binding properties and share the shelf collision. Repeated preparation replaces
generated content instead of accumulating duplicates.

`/en/map/test_bookshelf?camera-test` contains ranged cabinets, stocked storage,
an empty rack, and a storage rack with a supplied book. `preview.png` is captured
from the real game using a representative cabinet and its independently rendered
books, with transparent background and no scenery or HUD.
