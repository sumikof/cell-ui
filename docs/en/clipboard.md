# Clipboard (Excel Interoperability)

You can copy and paste values and formatting between cell-ui and Microsoft Excel (as well as Google Sheets, LibreOffice, and tables in the browser).

## How it works

On copy, two kinds of data are written to the clipboard.

| MIME | Content |
| --- | --- |
| `text/plain` | TSV identical to Excel's. Cells are separated by tabs and rows by CRLF. Cells containing line breaks, tabs, or quotes are wrapped in `"…"`, and any `"` inside is escaped as `""` |
| `text/html` | A `<table>`. Each `<td>` gets inline CSS (`font-weight`, `color`, `background`, `text-align`, `vertical-align`, `border-*`, `white-space`, `mso-number-format`) and an `x:num` / `x:bool` / `x:str` attribute. Column widths go in `<col width>` and row heights in `<tr height>` |

Excel prefers `text/html` and pastes it along with its formatting. Pasting works the other way around: if `text/html` contains a `<table>`, it is parsed; otherwise `text/plain` is parsed as TSV.

## What is restored when pasting from Excel into cell-ui

The HTML Excel generates expresses formatting through classes in a `<style>` block (`.xl65 { … }`), defaults on `td`, inline `style`, and tags such as `<b>` `<i>` `<u>` `<s>` `<font>`. cell-ui resolves these and restores the following.

| Item | Source CSS / attributes |
| --- | --- |
| Value | `x:num` (number), `x:bool`, text. Numeric-looking strings become numbers, and TRUE/FALSE become booleans |
| Bold / italic / underline / strikethrough | `font-weight`, `font-style`, `text-decoration`, `<b>` `<i>` `<u>` `<s>` |
| Text color / fill | `color`, `background(-color)`, `bgcolor`, `<font color>`. Named colors, `rgb()`, and `windowtext` are normalized to `#rrggbb` |
| Font / size | `font-family`, `font-size` (pt / px / em / % are converted to pt) |
| Alignment | `text-align`, `vertical-align`, `align`, `valign` |
| Wrapping | `white-space` (`normal` → wrap, `nowrap` → no wrap) |
| Borders | `border`, `border-top/right/bottom/left`. Width (pt / px) maps to thin / medium / thick; line styles dashed / dotted / double |
| Number format | `mso-number-format` (kept in `CellStyle.numberFormat`; not interpreted by the core) |
| Merged cells | Empty cells are inserted to cover the `colspan` / `rowspan` (the value goes in the top-left) |
| Multiple lines | `<br>` → line break |

## Paste rules (same as Excel)

- If the paste target is a single cell, the block is pasted at its own size. Missing rows and columns are added automatically.
- If the selection is an integer multiple of the block, the block is tiled across it (copying one cell and pasting it into a range fills every cell).
- Pasting after a cut (Ctrl+X) clears the source range (values, formatting, and meta). Press Esc to cancel the cut state.
- Ctrl+Shift+V (paste values only) discards the source formatting and keeps the destination's formatting.
- Pastes within the same app use an internal payload, so data that plugins stored in `meta` moves along as-is.
- Validation rules do not block pasting. Cells that violate a rule get a red marker (see [Validation](./validation.md)).
- With `pasteColumnWidths: true`, column widths from the HTML table are also applied when pasting into a single cell.

## API

```ts
// Read and write without going through clipboard events
sheet.copyToClipboard(false);                       // navigator.clipboard.write (with fallback)
sheet.pasteFromClipboard({ valuesOnly: true });     // navigator.clipboard.read (Firefox: text/plain only)
sheet.pasteData({ html, text });                    // Paste arbitrary data (e.g. a table received from a server)

// Low-level API
import { buildClipboardPayload, parseHtmlTable, parseTsv, serializeHtml, serializeTsv, styleToCss } from 'cell-ui';
const payload = buildClipboardPayload(sheet.model, range);   // { text, html, block, range }
const table = parseHtmlTable(html);                          // { cells, columnWidths, rowHeights } | null
```

Events: `sheet.events.on('copy', ({ range, cut }) => …)`, `sheet.events.on('paste', ({ range, block, internal }) => …)`.

## Browser notes

- Keyboard actions (Ctrl+C/X/V) use the `copy` / `cut` / `paste` events, so they work in every browser without permissions.
- Copy / paste from the toolbar or menus uses the asynchronous Clipboard API. It requires HTTPS (or localhost), and depending on the browser, pasting shows a permission prompt. Firefox does not support reading HTML, so it falls back to `text/plain`.
- HTML read back through Chrome's Clipboard API is sanitized, but Excel receives the original data unchanged.
- Excel for Mac, Numbers, and Google Sheets also handle the same HTML / TSV formats.
