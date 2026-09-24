# API Reference

See `dist/index.d.ts` for full type details. This page summarizes the public members of the main classes.

## `Spreadsheet`

```ts
new Spreadsheet(container: HTMLElement, options?: SpreadsheetOptions)
createSpreadsheet(container, options)   // Equivalent factory function
```

### Properties

| Name | Type | Description |
| --- | --- | --- |
| `model` | `SheetModel` | Data, formatting, validation rules, and Undo |
| `selection` | `Selection` | Selection state |
| `commands` | `CommandRegistry<Spreadsheet>` | Commands |
| `keymap` | `Keymap` | Key bindings |
| `toolbar` / `contextMenu` / `formulaBar` / `statusBar` | UI classes | Individual UI components |
| `grid` | `GridView` | Rendering engine |
| `clipboard` | `ClipboardState` | State of the most recent copy / cut |
| `events` | `Emitter<SpreadsheetEvents>` | Events |
| `options` | `SpreadsheetOptions` | Current options (updated when visibility is toggled) |
| `strings` | `Strings` | Current UI strings |
| `root` | `HTMLElement` | Root element `.cui-root` |
| `isMac` | `boolean` | Whether running on macOS (affects ⌘ handling) |
| `popoverHost` | `HTMLElement \| ShadowRoot` | Where popovers are attached |
| `activeElement` | `Element \| null` | Focused element, accounting for Shadow DOM |
| `hasFocus` | `boolean` | Whether focus is inside the component |
| `activeRef` | `string` | A1 reference of the active cell |

### Editing

| Method | Description |
| --- | --- |
| `isEditing` / `editMode` / `editorText` | Editing state (`'enter' \| 'edit' \| 'formula' \| null`) |
| `startEdit(mode = 'edit', initialText?)` | Start editing |
| `commitEdit({ fillSelection? })` | Commit. Returns `false` on a validation failure or if nothing was being edited |
| `cancelEdit()` | Cancel |
| `setEditMode(mode)` / `toggleEditMode()` | Switch modes |
| `setEditorText(text)` / `insertEditorText(text)` | Manipulate the editor text |
| `enterText(text)` | Enter text into the active cell and commit (inserts it if already editing) |
| `focus()` | Make the component ready to receive keyboard input |

### Navigation and selection

| Method | Description |
| --- | --- |
| `goTo(address, extend?)` | Move and scroll into view |
| `moveActive(dRow, dCol, { extend?, jump? })` | Equivalent to the arrow keys |
| `jumpTarget(from, dRow, dCol)` | Compute the destination of Ctrl+Arrow |
| `tabMove(±1)` / `enterMove(±1)` | Equivalent to Tab / Enter |
| `isSelected(address)` | Whether the address is inside the selection |

### Formatting

| Method | Description |
| --- | --- |
| `applyStyle(patch)` | Apply formatting to the selection |
| `toggleStyle('bold' \| 'italic' \| 'underline' \| 'strikethrough' \| 'wrap')` | Toggle |

### Clipboard and fill

| Method | Description |
| --- | --- |
| `copyToClipboard(cut, event?)` | Copy / cut |
| `pasteFromClipboard({ valuesOnly?, event? })` | Paste |
| `pasteData({ html?, text? }, { valuesOnly? })` | Paste arbitrary data |
| `pasteBlock(parsed)` | Paste a parsed block |
| `fillRange(source, target, { series? })` | Fill (series) |

### Layout and visibility

| Method | Description |
| --- | --- |
| `appendRows(n)` / `appendColumns(n)` | Append at the end |
| `setVisible(part, visible)` / `isVisible(part)` | Toggle visibility of UI parts. `part`: `'toolbar' \| 'formulaBar' \| 'nameBox' \| 'formulaInput' \| 'statusBar' \| 'contextMenu' \| 'headers' \| 'rowHeaders' \| 'columnHeaders' \| 'gridlines' \| 'fillHandle'` |
| `formulaBarParts()` | Visibility of `{ nameBox, input }` |
| `isFixedWidth` | Whether `fitContent` is `true` / `'width'` |
| `columnLabel(col)` / `setColumnLabels(labels)` | Column labels |

### Validation

| Method | Description |
| --- | --- |
| `registerValidator(type, fn)` | Register a rule type (returns an unregister function) |
| `getValidation(address)` | The rule in effect |
| `validate(address, value)` | Error message or `null` |
| `isInvalid(address)` | Whether the stored value violates its rule |
| `validateAll()` | List of invalid cells |
| `showValidationError(address, message)` / `hideValidationError()` | Show an error |
| `openListDropdown()` / `closeListDropdown()` | List dropdown |

### Extensions

| Method | Description |
| --- | --- |
| `use(plugin)` / `removePlugin(name)` | Plugins |
| `addValueParser` / `addDisplayResolver` / `addEditTextResolver` / `addCellRenderer` | Hooks (return an unregister function) |
| `displayText(address, cell?)` / `editText(address)` / `parseInput(text, address)` | Conversions that go through the hooks |

### Persistence and teardown

| Method | Description |
| --- | --- |
| `toJSON()` | Snapshot |
| `load(snapshot)` | Replace contents (can be reverted with a single Undo) |
| `destroy()` | Release DOM, events, and `window` listeners |

## `SheetModel`

```ts
new SheetModel({ rows?, cols?, defaultColumnWidth?, defaultRowHeight?, historyLimit?, defaultStyle? })
```

| Member | Description |
| --- | --- |
| `rowCount` / `colCount` / `cellCount` | Size |
| `getCell(r, c)` / `getValue(r, c)` / `getStyle(r, c)` / `getEffectiveStyle(r, c)` | Reading (do not mutate the value returned by `getCell`) |
| `entries()` | Iterator over non-empty cells, `[address, data]` |
| `usedRange()` / `hasContent(r, c)` | Used range |
| `setCell(r, c, data \| null)` / `setValue(r, c, value)` / `setStyle(r, c, patch)` / `setMeta(r, c, patch \| null)` | Writing (unspecified fields are preserved) |
| `setCells(origin, block)` / `getCells(range)` | 2D blocks |
| `applyStyle(range, patch)` / `clearRange(range, { values?, styles?, meta? })` | Range operations |
| `getColumnWidth(c)` / `setColumnWidth(c, w \| undefined)` / `getRowHeight(r)` / `setRowHeight(r, h \| undefined)` | Sizes (0 hides) |
| `insertRows(at, n)` / `deleteRows(at, n)` / `insertColumns(at, n)` / `deleteColumns(at, n)` / `appendRows(n)` / `appendColumns(n)` | Structural changes |
| `ensureSize(rows, cols)` / `resize(rows, cols)` | Resizing |
| `setValidation(range, rule \| null)` / `getValidation(r, c)` / `getValidations()` / `clearValidations()` | Validation rules |
| `transact(label, fn)` | Group multiple changes into a single Undo (can be nested) |
| `undo()` / `redo()` / `canUndo` / `canRedo` / `clearHistory()` | History |
| `toJSON()` / `load(snapshot)` | Persistence |
| `events` | `change` / `history` |
| `defaultStyle` / `defaultColumnWidth` / `defaultRowHeight` | Defaults |

## `Selection`

| Member | Description |
| --- | --- |
| `active` / `range` / `anchor` / `mode` / `isSingleCell` | State |
| `setActive(address)` | Select a single cell |
| `extendTo(address)` | Extend from the anchor |
| `selectRange(range, active?, mode?)` | Arbitrary range |
| `selectRows(from, to?, activeCol?)` / `selectColumns(from, to?, activeRow?)` / `selectAll()` | Rows / columns / everything |
| `moveActiveWithin(dRow, dCol)` | Cycle the active cell within the range |
| `revalidate()` | Adjust after a resize |
| `snapshot()` | Copy of the state |
| `events` | `change` |

## `CellUiElement` (`<cell-ui-sheet>`)

| Member | Description |
| --- | --- |
| `sheet` | `Spreadsheet \| null` |
| `whenReady` | `Promise<Spreadsheet>` |
| `options` | Additional options to set before the element is connected |
| `data` | Get / set the snapshot |
| `appendRows(n)` / `appendColumns(n)` / `focus()` | Operations |
| `defineCellUiElement(tagName?)` | Registration (already registered automatically as `cell-ui-sheet`) |
| `injectStyles(target)` / `CELL_UI_CSS` | Style injection |

For attributes and events, see [Options](./options.md#web-component-only).

## Utilities

| Function | Description |
| --- | --- |
| `columnLabel(col)` / `columnIndex('AB')` | Column number ⇔ letters |
| `addressToA1(addr)` / `a1ToAddress('B3')` / `a1ToRange('A1:C3')` / `rangeToA1(range)` | A1 references |
| `normalizeRange` / `rangeContains` / `rangeSize` / `iterateRange` / `sameAddress` / `sameRange` | Range operations |
| `columnRange(col, toCol?)` / `rowRange(row, toRow?)` | Whole columns / rows for validation rules |
| `parseInputValue(text)` / `formatValue(value)` / `editableText(cell)` | Value conversion |
| `buildClipboardPayload` / `parseHtmlTable` / `parseTsv` / `serializeHtml` / `serializeTsv` / `styleToCss` / `computePasteRange` / `tileBlock` | Clipboard |
| `applyBorderPreset(sheet, range, preset, color?)` / `currentRegion(sheet, range)` | Formatting / regions |
| `parseCombo` / `comboMatches` / `isMacPlatform` | Key input |
| `getStrings(locale)` / `registerLocale(code, strings)` | UI strings |
| `THEME_COLORS` / `STANDARD_COLORS` / `FONT_FAMILIES` / `FONT_SIZES` | Default choices |
