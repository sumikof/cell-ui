# cell-ui

An Excel-like spreadsheet UI library for the browser. It is framework-free (TypeScript + DOM only) and has no formula engine in the core, but is designed to be extended with plugins.

- **Copy & paste to/from Microsoft Excel** — not just values but also formatting round-trips: bold, italic, colours, fill, alignment, borders, fonts (Excel-compatible `text/html` + `text/plain`).
- **Excel keyboard shortcuts** — Arrows / Ctrl+Arrows / Shift+Arrows / Tab / Enter / F2 / Delete / Ctrl+C,X,V / Ctrl+Z,Y / Ctrl+B,I,U / Ctrl+D,R / Ctrl+Space / Shift+Space / Ctrl+A / Ctrl+1 / Ctrl+9,0 / Alt+Enter …
- **Styling toolbar** — font, size, bold / italic / underline / strikethrough, text colour, fill colour, horizontal and vertical alignment, wrap, border presets, clear formatting.
- **Built for cell UIs** — virtual scrolling, drag-to-resize and double-click auto-fit for columns and rows, fill handle (series), row/column insert / delete / hide, context menu, name box + formula bar, status bar (average / count / sum), undo / redo.
- **Data validation** — number-only and list-selection rules with an in-cell dropdown.
- **Extensible** — command registry, keymap, toolbar, context menu, value parsers, display resolvers, cell renderers and per-cell `meta` let you add a formula engine, validation rules and more later (see `examples/formula-plugin.ts` for a =SUM sample).
- **Embeddable three ways** — ES module for bundlers, a single-file IIFE build for `<script>` tags (global `CellUI`), and a `<cell-ui-sheet>` custom element with Shadow-DOM-isolated styles. See `embed.html`.

## Documentation

Documentation is available in English and Japanese:

- English: [docs/en/](./docs/en/README.md)
- 日本語: [docs/ja/](./docs/ja/README.md)

| Document | Contents |
| --- | --- |
| [Getting started](./docs/en/getting-started.md) | Installation, minimal setup, dev commands |
| [Options](./docs/en/options.md) | Constructor options / Web Component attributes |
| [Embedding guide](./docs/en/embedding.md) | `<script>` tag, Web Component, React / Vue, iframe |
| [Layout and UI parts](./docs/en/layout.md) | Fixed-size tables, adding rows/columns, showing/hiding headers and bars, column labels |
| [Keyboard shortcuts](./docs/en/keyboard-shortcuts.md) | Excel-compatible key list |
| [Clipboard](./docs/en/clipboard.md) | Copy & paste with Excel |
| [Styling](./docs/en/styling.md) | Formatting, borders, toolbar, theme |
| [Validation](./docs/en/validation.md) | Number-only / list selection |
| [Extensibility](./docs/en/extensibility.md) | Plugin API |
| [API reference](./docs/en/api.md) | Classes and methods |
| [Data format](./docs/en/data-format.md) | Snapshot JSON |
| [Architecture](./docs/en/architecture.md) | Internal design |
| [Development guide](./docs/en/development.md) | Build, test, CI |

## Usage

```bash
npm install
npm run dev      # Demo (http://localhost:5173) / embedding samples (/embed.html)
npm test         # Unit tests
npm run e2e      # Browser checks in Chromium
npm run build    # Build into dist/
```

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

const sheet = new Spreadsheet(document.getElementById('app')!, { rows: 1000, cols: 52, locale: 'en' });
sheet.model.setValue(0, 0, 'Hello');
sheet.model.setCell(0, 1, { value: 42, style: { bold: true, color: '#c00000' } });
const snapshot = sheet.toJSON();
```

```html
<!-- Embedding without a build step (Web Component) -->
<link rel="stylesheet" href="cell-ui.css"><script src="cell-ui.iife.js"></script>
<cell-ui-sheet rows="10" cols="5" fit-content column-labels="Item,Qty,Price,Notes"></cell-ui-sheet>
```

## Project layout

```
src/
  model/       Types, A1 addresses, sparse sheet model (transactions / undo / redo), validation
  clipboard/   Excel-compatible TSV / HTML serialisation and parsing
  keyboard/    Key combo parsing and keymap
  render/      Virtual-scrolling renderer
  ui/          Toolbar, colour picker, context menu, formula bar, status bar, dropdown
  defaults/    Default commands, key bindings, toolbar and menus
  plugins/     Extension API type definitions
  spreadsheet.ts  The component that ties everything together
  element.ts   Web Component <cell-ui-sheet>
examples/      Demo and formula plugin sample
docs/
  en/          Documentation (English)
  ja/          Documentation (Japanese)
test/          vitest unit tests
scripts/e2e.mjs  Browser checks in Chromium
```
