# Development Guide

## Setup

```bash
npm install
npm run dev          # http://localhost:5173  (/ = demo, /embed.html = embedding sample)
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Build into `dist/` (ES module, IIFE, CSS, type definitions) |
| `npm run preview` | Preview the build output |
| `npm run typecheck` | Type check (`src` `test` `examples` `scripts`) |
| `npm test` | Unit tests (vitest + jsdom) |
| `npm run test:watch` | Watch mode |
| `npm run e2e` | Browser checks in Chromium (requires `npm run build`; uses the Chromium bundled with Playwright) |

## Testing

### Unit tests (`test/`)

| File | Covers |
| --- | --- |
| `address.test.ts` | A1 references, column labels, ranges |
| `model.test.ts` | Model, transactions, Undo, structural changes, JSON |
| `value.test.ts` | Value parsing and display |
| `tsv.test.ts` / `html.test.ts` | Clipboard formats |
| `keymap.test.ts` | Key combos |
| `spreadsheet.test.ts` | Shortcuts, clipboard, fill, extensions |
| `element.test.ts` | Web Component |
| `resize.test.ts` | Fixed-size tables, appending rows / columns, `autoExpand` |
| `visibility.test.ts` | Toggling visibility of UI parts |
| `labels.test.ts` | Formula bar parts, custom column labels |
| `validation.test.ts` | Validation rules |

Because jsdom has no Canvas, `test/setup.ts` disables `getContext` so text width falls back to an estimate. The viewport size is also 0, so avoid assertions that depend on the number of rendered cells.

### Browser checks (`scripts/e2e.mjs`)

Starts the Vite server and drives `index.html` and `embed.html` with Playwright. It checks copy and paste using the real clipboard (`navigator.clipboard`), pasting Excel-style HTML, the toolbar, menus, the fill handle, column resizing, the Web Component, validation rules, and more, and saves screenshots to `e2e-out/`.

```bash
npm run build && npm run e2e
```

The Chromium path is assumed to be `/opt/pw-browsers/chromium`. In other environments, change `executablePath` in `scripts/e2e.mjs` or install it with `npx playwright install chromium`.

### CI

`.github/workflows/ci.yml` runs `typecheck` → `test` → `build` on every push / pull request.

## Coding conventions

- TypeScript `strict`. Unused variables and parameters are errors.
- DOM class names use the `cui-` prefix. States are expressed with `--modifier` (`cui-tb-btn--active`).
- The model layer (`src/model`, `src/clipboard`, `src/keyboard`) must not depend on the DOM (the only exception is `DOMParser`, guarded by an existence check).
- Register every user-facing operation as a command, and keep key bindings in `defaults/keymap.ts`.
- Add UI strings to `i18n.ts`, providing both ja and en.

## Steps for adding a feature

1. Add the required state and operations to the model, and wire them into transactions (`writeXxx`) and `toJSON` / `load`.
2. Add a public API to `Spreadsheet`, extending `SpreadsheetOptions` and `setVisible` if needed.
3. Register commands in `defaults/commands.ts`, keys in `defaults/keymap.ts`, and menu / toolbar items in `defaults/menu.ts` / `defaults/toolbar.ts`.
4. If the Web Component should support it, update the attributes and `observedAttributes` in `element.ts`.
5. Add unit tests and browser checks, and update both `docs/ja/` and `docs/en/`.

## Release

```bash
npm run typecheck && npm test && npm run build && npm run e2e
npm pack        # Tarball for distribution
```
