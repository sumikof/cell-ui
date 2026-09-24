# Options

This is a mapping table between `options` (`SpreadsheetOptions`) of `new Spreadsheet(container, options)` and the attributes of the Web Component `<cell-ui-sheet>`. Boolean attributes of the Web Component are disabled by `"false"` / `"0"` / `"off"` and enabled by any other value (including the empty string).

## Size and model

| Option | Attribute | Default | Description |
| --- | --- | --- | --- |
| `rows` | `rows` | 1000 | Initial number of rows. Grows automatically when needed, e.g. on paste |
| `cols` | `cols` | 52 | Initial number of columns |
| `defaultColumnWidth` | – | 80 | Default column width (px) |
| `defaultRowHeight` | – | 22 | Default row height (px) |
| `defaultStyle` | – | Calibri 11pt | Default formatting for the whole sheet (`CellStyle`) |
| `historyLimit` | – | 200 | Number of undo history entries |
| `data` | `data` property | – | Initial snapshot ([Data format](./data-format.md)) |
| `fitContent` | `fit-content` | false | `true` / `'height'` / `'width'`. Sizes the component based on the number of rows and columns ([Layout](./layout.md)) |
| `autoExpand` | `auto-expand` | false | `true` / `{ rows, cols }`. Adds a row or column when Enter/↓ is pressed on the last row or Tab/→ on the last column |

## UI part visibility

| Option | Attribute | Default | Description |
| --- | --- | --- | --- |
| `toolbar` | `toolbar` | true | Formatting toolbar |
| `formulaBar` | `formula-bar` | true | Name box + formula input. `{ nameBox: false }` hides only the name box. `{ input: false }` / `formula-input="false"` removes the formula input, and the whole bar disappears, including the cell position display |
| – | `name-box` | true | Name box (corresponds to `formulaBar: { nameBox }`) |
| – | `formula-input` | true | Formula input (corresponds to `formulaBar: { input }`) |
| `statusBar` | `status-bar` | true | Status bar showing average / count / sum |
| `contextMenu` | `context-menu` | true | Right-click menu |
| `headers` | `headers` | true | Row number and column name headers. `false` hides both; `{ rows: false }` / `{ cols: false }` hides only one |
| – | `row-headers` / `column-headers` | true | Specify the headers individually |
| `rowHeaderWidth` | – | 46 | Width of the row number header (px) |
| `columnHeaderHeight` | – | 22 | Height of the column name header (px) |
| `columnLabels` | `column-labels` | – | Replaces column names with `['Item', 'Qty']` or `(col) => string`. Only effective for fixed-width tables (`fitContent: true` / `'width'`). The attribute takes a comma-separated list or a JSON array |
| `showGridlines` | `gridlines` | true | Gridlines |
| `fillHandle` | `fill-handle` | true | Fill handle at the bottom-right of the selection |

These can be toggled after construction with `sheet.setVisible(part, visible)` ([API](./api.md#visibility)).

## Behavior

| Option | Attribute | Default | Description |
| --- | --- | --- | --- |
| `locale` | `locale` | Browser language | `'ja'` / `'en'`. More can be added with `registerLocale()` |
| `pasteColumnWidths` | – | false | When an HTML table is pasted into a single cell, also apply the table's column widths |
| `plugins` | `options` property | – | Array of plugins to `use()` at construction time |
| `defaults.keymap` | – | true | `false` skips registering the default key bindings |
| `defaults.toolbar` | – | true | `false` skips registering the default toolbar items (for building your own toolbar) |
| `defaults.contextMenu` | – | true | `false` skips registering the default menu items |

## Web Component only

| Name | Kind | Description |
| --- | --- | --- |
| `sheet` | Property | The internal `Spreadsheet` instance (after connection) |
| `whenReady` | Property | `Promise<Spreadsheet>`. More reliable than the `ready` event, because the element is initialized immediately at parse time |
| `options` | Property | If set before connection, merged into the construction options (for things that cannot be expressed as attributes, such as `plugins`, `defaults`, `data`) |
| `data` | Property | Get / set the snapshot |
| `appendRows(n)` / `appendColumns(n)` | Method | Append rows / columns at the end |
| `ready` / `change` / `selectionchange` / `editcommit` / `paste` / `copy` | Event | `CustomEvent` (contents in `detail`). `composed: true` lets it reach outside the Shadow DOM |

## Examples

```ts
const sheet = new Spreadsheet(el, {
  rows: 10,
  cols: 5,
  fitContent: true,
  autoExpand: { rows: true },
  headers: { rows: false },
  columnLabels: ['Item', 'Qty', 'Price', 'Tax rate', 'Notes'],
  formulaBar: false,
  statusBar: false,
  locale: 'en',
});
```

```html
<cell-ui-sheet rows="10" cols="5" fit-content auto-expand="true" headers="false"
               column-labels="Item,Qty,Price,Tax rate,Notes" formula-bar="false" status-bar="false" locale="en">
</cell-ui-sheet>
```
