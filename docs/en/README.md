# cell-ui Documentation

日本語版: [docs/ja](../ja/README.md)

This is the documentation for **cell-ui**, an Excel-like cell UI library that runs in the web browser. It is written in framework-agnostic TypeScript and provides formatted copy and paste with Excel, the same keyboard shortcuts as Excel, style editing, and data validation. It is designed so that features such as formulas can be added later through plugins.

## Contents

| Document | Description |
| --- | --- |
| [Getting started](./getting-started.md) | Installation, minimal setup, development commands |
| [Options](./options.md) | Reference for constructor options / Web Component attributes |
| [Embedding guide](./embedding.md) | `<script>` tag, Web Component, React / Vue, iframe, notes for SPAs |
| [Layout and UI parts](./layout.md) | Row and column counts, fixed-size tables (`fitContent`), adding rows and columns, showing / hiding headers and bars, custom column labels |
| [Keyboard shortcuts](./keyboard-shortcuts.md) | List of Excel-compatible keys and edit mode behavior |
| [Clipboard (Excel interop)](./clipboard.md) | How copy and paste with Excel works, supported formatting, paste rules |
| [Styles (formatting)](./styling.md) | `CellStyle` properties, toolbar, borders, theme CSS variables |
| [Data validation](./validation.md) | Numbers only / list selection, specifying ranges, custom rules |
| [Extensibility (plugin API)](./extensibility.md) | Commands, keymaps, toolbar, menus, value parsers, display resolvers, cell renderers, `meta` |
| [API reference](./api.md) | Methods and events of `Spreadsheet` / `SheetModel` / `Selection` / `CellUiElement` |
| [Data format](./data-format.md) | Snapshot format of `toJSON()` / `load()`, cell and address types |
| [Architecture](./architecture.md) | Directory structure, internal design of rendering, editing, and clipboard |
| [Development guide](./development.md) | Build, tests, browser verification, CI |

## Quick start

```bash
npm install
npm run dev        # Demo at http://localhost:5173 (index.html) / embedding samples at /embed.html
npm run build      # Build into dist/
```

```ts
import { Spreadsheet } from 'cell-ui';
import 'cell-ui/style.css';

const sheet = new Spreadsheet(document.getElementById('app')!, { rows: 100, cols: 20, locale: 'en' });
sheet.model.setValue(0, 0, 'Hello');
```

```html
<!-- Embedding without a build step -->
<link rel="stylesheet" href="cell-ui.css"><script src="cell-ui.iife.js"></script>
<cell-ui-sheet rows="10" cols="5" fit-content column-labels="Item,Qty,Price,Notes"></cell-ui-sheet>
```
