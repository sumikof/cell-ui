# Layout and UI parts

## Rows and columns

`rows` / `cols` set the initial size. If a paste does not fit, the sheet expands automatically.

```ts
const sheet = new Spreadsheet(el, { rows: 10, cols: 5 });
sheet.model.rowCount;             // 10
sheet.model.resize(20, 8);        // Change directly (cells outside the new size are deleted)
sheet.model.ensureSize(30, 8);    // Expand only as much as needed
```

## Fixed-size tables (`fitContent`)

With `fitContent`, the width and height of the component itself are determined by the number of rows and columns. The parent element does not need a height, and the component grows as rows and columns are added. This suits small tables such as 10 rows × 5 columns.

| Value | Effect |
| --- | --- |
| `true` | Fit both width and height to the content (no scrollbars) |
| `'height'` | Height only (width follows the parent element, with horizontal scrolling) |
| `'width'` | Width only |

Tables with `fitContent: true` / `'width'` are treated as "fixed width", which enables [custom column labels](#custom-column-labels-columnlabels).

## Adding and removing rows and columns

| Method | Description |
| --- | --- |
| `sheet.appendRows(n)` / `sheet.appendColumns(n)` | Append at the end (Web Component: `el.appendRows(n)` / `el.appendColumns(n)`) |
| `sheet.model.insertRows(at, n)` / `insertColumns(at, n)` | Insert at the given position |
| `sheet.model.deleteRows(at, n)` / `deleteColumns(at, n)` | Delete |
| Right-click menu | Insert rows / Insert columns / Add row at bottom / Add column at right / Delete rows / Delete columns |
| Ctrl++ / Ctrl+- | Insert / delete rows (columns) depending on the selection |
| `autoExpand` | Adds one row / one column when Enter/↓ is pressed on the last row or Tab/→ on the last column. Can be limited to one direction, e.g. `{ rows: true }` |

All of these can be undone/redone, and column widths, row heights, and validation ranges move along with them. The `change` event is fired with `structural: true`.

## Column widths and row heights

```ts
sheet.model.setColumnWidth(0, 120);
sheet.model.setRowHeight(3, 40);
sheet.model.setColumnWidth(0, undefined);   // Reset to the default
sheet.model.setColumnWidth(2, 0);           // Hide (same as Ctrl+0 / Ctrl+9)
sheet.commands.execute('columns.autoFit');  // Fit the selected columns to their content (same as double-clicking a header border)
```

Drag a header border to resize, or double-click it to auto-fit. When entire rows or columns are selected, changing one applies the change to all selected ones (same as Excel).

## Showing / hiding UI parts

| Part | Option | Attribute | `setVisible` name |
| --- | --- | --- | --- |
| Toolbar | `toolbar` | `toolbar` | `'toolbar'` |
| Entire formula bar | `formulaBar` | `formula-bar` | `'formulaBar'` |
| Name box (cell position) | `formulaBar: { nameBox }` | `name-box` | `'nameBox'` |
| Formula input | `formulaBar: { input }` | `formula-input` | `'formulaInput'` |
| Status bar | `statusBar` | `status-bar` | `'statusBar'` |
| Right-click menu | `contextMenu` | `context-menu` | `'contextMenu'` |
| Row number header | `headers: { rows }` | `row-headers` | `'rowHeaders'` |
| Column name header | `headers: { cols }` | `column-headers` | `'columnHeaders'` |
| Both headers | `headers` | `headers` | `'headers'` |
| Gridlines | `showGridlines` | `gridlines` | `'gridlines'` |
| Fill handle | `fillHandle` | `fill-handle` | `'fillHandle'` |

```ts
// Show only the bare table
const sheet = new Spreadsheet(el, { headers: false, toolbar: false, formulaBar: false, statusBar: false, contextMenu: false });

// Toggle later
sheet.setVisible('toolbar', true);
sheet.isVisible('headers');
```

- Removing the formula input (`formulaBar: { input: false }`) removes the whole bar, including the cell position display, leaving only the table. Removing just the name box is possible (`{ nameBox: false }`).
- Even with the headers hidden, selection, input, shortcuts, and copy and paste all keep working. For operations that go through the headers (dragging column widths, clicking to select entire rows / columns), use the API instead (`setColumnWidth`, `selection.selectRows`).
- To replace only the toolbar's contents, remove the default buttons with `defaults: { toolbar: false }` and register your own with `sheet.toolbar.add()` ([Extensibility](./extensibility.md#toolbar)).

## Custom column labels (`columnLabels`)

In fixed-width tables (`fitContent: true` / `'width'`), the A, B, C… in the column name header can be replaced with arbitrary strings.

```ts
const sheet = new Spreadsheet(el, { rows: 10, cols: 4, fitContent: true, columnLabels: ['Item', 'Qty', 'Price', 'Notes'] });
sheet.setColumnLabels((col) => ['Item', 'Qty'][col]);   // A function also works. Columns for which it returns undefined fall back to letters
```

```html
<cell-ui-sheet fit-content column-labels="Item,Qty,Price,Notes"></cell-ui-sheet>
<cell-ui-sheet fit-content column-labels='["Item","Qty"]'></cell-ui-sheet>
```

- On a regular scrolling sheet, columns grow and shrink dynamically, so this is ignored and a warning is printed to the console.
- Cell references (name box, clipboard, A1 notation in plugins) stay as letters. Paste compatibility with Excel is not affected.
- The header sizes can be changed with `rowHeaderWidth` / `columnHeaderHeight`.

## Working with the selection

```ts
sheet.selection.setActive({ row: 2, col: 1 });                      // B3
sheet.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 4, col: 2 } });
sheet.selection.selectRows(3, 5);
sheet.selection.selectColumns(1);
sheet.selection.selectAll();
sheet.goTo({ row: 99, col: 0 });                                    // Move and scroll into view
sheet.selection.events.on('change', (s) => console.log(s.range, s.active, s.mode));
```

`mode` is `'cells' | 'rows' | 'columns' | 'all'` and is used for header highlighting and for the behavior of Ctrl++ (whether it inserts rows or columns).
