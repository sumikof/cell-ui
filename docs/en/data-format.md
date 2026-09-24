# Data Format

## Snapshot (`SheetSnapshot`)

The JSON returned by `sheet.toJSON()` / `sheet.model.toJSON()` and accepted by `sheet.load()`, the `data` option, and `<cell-ui-sheet>.data`.

```json
{
  "rows": 100,
  "cols": 26,
  "cells": {
    "0,0": { "value": "Product", "style": { "bold": true, "backgroundColor": "#217346", "color": "#ffffff" } },
    "1,1": { "value": 12 },
    "1,4": { "value": null, "meta": { "formula": "=B2*C2" } }
  },
  "colWidths": { "0": 120 },
  "rowHeights": { "8": 60 },
  "validations": [
    { "range": { "start": { "row": 0, "col": 1 }, "end": { "row": 9007199254740991, "col": 1 } }, "rule": { "type": "number", "min": 0, "integer": true } }
  ]
}
```

| Key | Contents |
| --- | --- |
| `rows` / `cols` | Number of rows / columns |
| `cells` | Dictionary of non-empty cells keyed by `"row,col"` (0-based) |
| `colWidths` / `rowHeights` | Column widths / row heights (px) that differ from the defaults. `0` means hidden |
| `validations` | Validation rules. Entries whose `end.row` / `end.col` is `Number.MAX_SAFE_INTEGER` cover an entire column / row |

`load()` replaces the contents and can be reverted with a single Undo. The `snapshot` passed to `load()` may be partial (`{ cells: {} }` clears the sheet).

## Cell (`CellData`)

```ts
interface CellData {
  value: string | number | boolean | null;
  style?: CellStyle;                 // Formatting (docs/en/styling.md)
  meta?: Record<string, unknown>;    // Arbitrary data for extensions
}
```

- Cells that contain only an empty string, `null`, an empty `style`, or an empty `meta` are not stored.
- Value types follow Excel's "General" format. On input, numeric-looking strings become `number`, `TRUE` / `FALSE` become `boolean`, and a leading `'` forces a string.

## Addresses and ranges

```ts
interface CellAddress { row: number; col: number }          // 0-based
interface CellRange { start: CellAddress; end: CellAddress } // start is top-left, end is bottom-right (normalize with normalizeRange)
```

Use `addressToA1` / `a1ToAddress` / `a1ToRange` / `rangeToA1` to convert to and from A1 notation.

## Change events (`ChangeEvent`)

```ts
sheet.model.events.on('change', (e) => {
  e.cells;        // CellAddress[] of the changed cells
  e.structural;   // Row / column insertion or deletion, resizing
  e.sizes;        // Column width / row height changes
  e.validations;  // Validation rule changes
  e.label;        // 'enter' | 'paste' | 'fill' | 'undo' | 'redo' | 'load' | …
  e.fromHistory;  // Caused by Undo / Redo
});
```

## Converting to and from other formats

- **TSV / CSV**: `serializeTsv(rows)` / `parseTsv(text)` (Excel's TSV dialect).
- **HTML tables**: `serializeHtml(block)` / `parseHtmlTable(html)`.
- **Excel files (.xlsx)**: Not included in the core. Convert to `CellData[][]` with a library such as SheetJS and pass it to `model.setCells()`, or copy and paste from Excel.
