# Architecture

## Directory structure

```
src/
  model/          Types, A1 addresses, sparse sheet model (transactions / Undo / Redo), validation rules
  clipboard/      Excel-compatible TSV / HTML serialization and parsing, paste range calculation
  keyboard/       Key combo parsing and keymap
  render/         Virtual-scrolling rendering (cells, headers, borders, selection, editor), axis layout
  ui/             Toolbar, color picker, context menu, formula bar, status bar, dropdowns
  defaults/       Default commands, key bindings, toolbar items, menu items
  plugins/        Type definitions for the extension API
  spreadsheet.ts  Component that ties everything together
  element.ts      Web Component <cell-ui-sheet>
  i18n.ts         UI strings (ja / en)
  styles.css      Styles
examples/         Demo (demo.ts) and formula plugin sample
docs/             Documentation (en / ja)
test/             vitest unit tests
scripts/e2e.mjs   Browser checks in Chromium
index.html        Demo page
embed.html        Embedding sample
```

## Layers

```
Spreadsheet (controller)
 ├─ SheetModel        Values, formatting, meta, sizes, validation rules / transactions / Undo
 ├─ Selection         Active cell, range, mode
 ├─ CommandRegistry   All operations
 ├─ Keymap            Key → command
 ├─ ClipboardState    Most recently copied content
 ├─ GridView          DOM rendering and mouse interaction
 └─ Toolbar / FormulaBar / StatusBar / ContextMenu
```

- **The model knows nothing about the UI.** `SheetModel` has no DOM dependency and can be used on its own in Node.js.
- **Every change is a transaction.** Public methods implicitly open a single transaction, and grouping changes with `transact()` makes them a single Undo step. A transaction records the before/after state of cells, sizes, dimensions, and validation rules, and fires `change` exactly once when it ends.
- **Operations are commands.** Key input, the toolbar, and menus all go through `commands.execute()`, and every command can be replaced.

## Rendering (`GridView`)

- Row and column positions are managed by `AxisLayout` (cumulative offsets), and coordinate → index lookups use binary search. On resize, `invalidateLayout()` triggers a recalculation.
- Only cells in the visible range are created as DOM elements, and they are reused from a pool keyed by `"row,col"`. Rendering is batched with `requestAnimationFrame`.
- Layer order (bottom to top): gridlines → cells (fill + text) → borders → overlays (selection range, active cell outline, fill handle, cut marquee, validation errors, ▾ button) → editor.
- As in Excel, left-aligned text overflows into empty cells to its right (width is measured with Canvas `measureText`).
- Headers are separate elements that follow scrolling via `transform`. When headers are hidden, their size becomes 0.
- With `fitContent`, the grid element's width and height match its content, and viewport scrolling is disabled.

## Editing and key input

- The `textarea.cui-editor` inside the grid always holds focus. When not editing it is invisible, and a sentinel character (a space) is kept selected so that the `input` event from a character key can be treated directly as "start editing". This approach also lets IME composition work as-is.
- `keydown` is resolved through the keymap, and `preventDefault` is called only when a command handled it. How the arrow keys behave depends on the edit mode (`'enter'` / `'edit'` / `'formula'`).
- On commit, processing runs in this order: `parseInput()` (the value parser chain) → validation → write to the model.

## Clipboard

- For keyboard operations, the browser's `copy` / `cut` / `paste` events are received by the hidden editor, and TSV and HTML are written to `clipboardData` (no permission required).
- From menus / buttons, the asynchronous Clipboard API is used, falling back to `execCommand` or the internal payload on failure.
- Pasted data is interpreted in this order: "internal payload (if the text matches) → HTML `<table>` → TSV".

## Web Component

- `CellUiElement` injects CSS into its Shadow Root and creates a `Spreadsheet` inside it. Attribute changes are applied via `attributeChangedCallback` to methods such as `setVisible()`.
- Popovers are attached to `popoverHost` (the Shadow Root), and focus checks use `getRootNode().activeElement`.

## Design constraints

- Selection is a single rectangle (plus row / column / select-all modes). Multiple-range selection is not supported.
- Merged cells, freeze panes, multiple sheets, and formulas are not supported (formulas can be added with a plugin).
- Row counts up to a few hundred thousand are expected (recalculating cumulative offsets is O(n)).
