// Browser smoke test: starts the Vite dev server, drives the demo in Chromium
// and writes screenshots to e2e-out/. Run with `npm run e2e`.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('e2e-out', { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 700 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

await page.goto('http://localhost:5199/');
await page.waitForSelector('.cui-cell');
await page.screenshot({ path: 'e2e-out/01-initial.png' });

const active = () => page.evaluate(() => window.sheet.activeRef);
const value = (r, c) => page.evaluate(([r, c]) => window.sheet.model.getValue(r, c), [r, c]);

// Click a cell, type, Enter
await page.click('.cui-viewport', { position: { x: 30, y: 10 } });
check('click selects A1', (await active()) === 'A1', await active());
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
check('arrow moves to A11', (await active()) === 'A11', await active());
await page.keyboard.type('Hello world');
check('typing opens editor', await page.evaluate(() => window.sheet.isEditing));
await page.screenshot({ path: 'e2e-out/02-editing.png' });
await page.keyboard.press('Enter');
check('Enter commits', (await value(10, 0)) === 'Hello world', String(await value(10, 0)));
check('Enter moves down', (await active()) === 'A12', await active());
await page.keyboard.type('123');
await page.keyboard.press('Tab');
check('number parsed', (await value(11, 0)) === 123);
check('Tab moves right', (await active()) === 'B12', await active());
await page.keyboard.type('abc');
await page.keyboard.press('Enter');
check('Enter after Tab returns to start column', (await active()) === 'A13', await active());

// Shortcuts: select, bold, copy, paste
await page.keyboard.press('Control+Home');
check('Ctrl+Home', (await active()) === 'A1', await active());
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('Shift+ArrowDown');
await page.keyboard.press('Control+i');
check('Ctrl+I applies italic to range', await page.evaluate(() => window.sheet.model.getStyle(1, 1).italic === true));
await page.keyboard.press('Control+c');
const clip = await page.evaluate(async () => {
  const items = await navigator.clipboard.read();
  const out = {};
  for (const item of items) for (const t of item.types) out[t] = await (await item.getType(t)).text();
  return out;
});
check('Ctrl+C writes text/plain', (clip['text/plain'] ?? '').startsWith('商品\t数量'), JSON.stringify(clip['text/plain']));
check('Ctrl+C writes text/html', /<table/.test(clip['text/html'] ?? '') && /font-weight:\s*bold/.test(clip['text/html'] ?? '') && /x:num="12"/.test(clip['text/html'] ?? ''), (clip['text/html'] ?? '').slice(0, 200));
await page.keyboard.press('Control+End');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
const target = await active();
await page.keyboard.press('Control+v');
const pastedRange = await page.evaluate(() => { const r = window.sheet.selection.range; return [r.start.row, r.start.col, r.end.row, r.end.col]; });
const pv = await page.evaluate(([r, c]) => window.sheet.model.getCell(r, c), [pastedRange[0], pastedRange[1]]);
check('Ctrl+V pastes block with style', pv && pv.value === '商品' && pv.style && pv.style.bold === true && pv.style.italic === true, JSON.stringify(pv) + ' at ' + target);

// Paste Excel-style HTML from the system clipboard
await page.evaluate(async () => {
  const html = `<html><head><style>.xl65{color:#FF0000;font-weight:700;background:#FFFF00;border:.5pt solid windowtext}</style></head><body><table><tr><td class=xl65>Excel</td><td x:num>1,000</td></tr><tr><td>b1</td><td>b2</td></tr></table></body></html>`;
  await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob(['Excel\t1000\r\nb1\tb2\r\n'], { type: 'text/plain' }) })]);
});
await page.keyboard.press('Control+Home');
await page.keyboard.press('ArrowDown');
for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('Control+v');
const ex = await page.evaluate(() => window.sheet.model.getCell(21, 0));
const exn = await page.evaluate(() => window.sheet.model.getValue(21, 1));
check('Excel HTML paste applies styles', ex && ex.value === 'Excel' && ex.style.color === '#ff0000' && ex.style.bold && ex.style.backgroundColor === '#ffff00' && ex.style.borderTop?.style === 'thin', JSON.stringify(ex));
check('Excel HTML paste parses x:num', exn === 1000, String(exn));
await page.screenshot({ path: 'e2e-out/03-after-paste.png' });

// Undo
await page.keyboard.press('Control+z');
check('Ctrl+Z undoes paste', (await value(21, 0)) === null);

// Toolbar: fill colour via button
await page.keyboard.press('Control+Home');
await page.click('.cui-tb-split:nth-of-type(2) .cui-tb-color, [data-id]');
await page.click('.cui-tb-btn[title^="塗りつぶしの色"].cui-tb-color');
check('toolbar fill colour', (await page.evaluate(() => window.sheet.model.getStyle(0, 0).backgroundColor)) === '#ffff00', await page.evaluate(() => JSON.stringify(window.sheet.model.getStyle(0, 0))));
check('grid keeps focus after toolbar click', await page.evaluate(() => document.activeElement === window.sheet.grid.editor));

// Context menu
await page.click('.cui-viewport', { button: 'right', position: { x: 30, y: 10 } });
const menuVisible = await page.isVisible('.cui-menu');
check('context menu opens', menuVisible);
await page.screenshot({ path: 'e2e-out/04-context-menu.png' });
await page.keyboard.press('Escape');

// Fill handle drag
await page.evaluate(() => { window.sheet.selection.setActive({ row: 1, col: 1 }); });
await page.waitForTimeout(100);
const fh = await page.locator('.cui-fill-handle').boundingBox();
await page.mouse.move(fh.x + 3, fh.y + 3);
await page.mouse.down();
await page.mouse.move(fh.x + 3, fh.y + 60, { steps: 5 });
await page.mouse.up();
check('fill handle copies value', (await value(3, 1)) === 12, String(await value(3, 1)));

// Column resize by drag
const headerBox = await page.locator('.cui-header-col').first().boundingBox();
const w0 = await page.evaluate(() => window.sheet.model.getColumnWidth(0));
await page.mouse.move(headerBox.x + headerBox.width - 2, headerBox.y + 10);
await page.mouse.down();
await page.mouse.move(headerBox.x + headerBox.width + 40, headerBox.y + 10, { steps: 5 });
await page.mouse.up();
const w1 = await page.evaluate(() => window.sheet.model.getColumnWidth(0));
check('column resize', w1 > w0 + 30, `${w0} -> ${w1}`);

// Formula bar edit
await page.evaluate(() => window.sheet.selection.setActive({ row: 30, col: 0 }));
await page.click('.cui-formula-input');
await page.keyboard.type('from formula bar');
await page.keyboard.press('Enter');
check('formula bar commits', (await value(30, 0)) === 'from formula bar', String(await value(30, 0)));

// Scroll far and render
await page.evaluate(() => { window.sheet.grid.viewport.scrollTop = 5000; });
await page.waitForTimeout(100);
const firstRow = await page.evaluate(() => window.sheet.grid.visibleRows[0]);
check('virtual scrolling renders far rows', firstRow > 100, String(firstRow));
await page.screenshot({ path: 'e2e-out/05-scrolled.png' });

// Plugin: enable formulas
await page.click('#formulas');
await page.evaluate(() => window.sheet.selection.setActive({ row: 40, col: 3 }));
await page.keyboard.type('=SUM(D2:D5)');
await page.keyboard.press('Enter');
const disp = await page.evaluate(() => window.sheet.displayText({ row: 40, col: 3 }));
check('formula plugin evaluates', disp === '7980', disp);

// Mouse: double-click edit, header click, shift+click
await page.evaluate(() => { window.sheet.grid.viewport.scrollTop = 0; });
await page.waitForTimeout(50);
await page.dblclick('.cui-viewport', { position: { x: 30, y: 32 } });
check('double-click opens editor in edit mode', await page.evaluate(() => window.sheet.isEditing && window.sheet.editMode === 'edit'));
check('editor shows existing text', (await page.evaluate(() => window.sheet.grid.editor.value)) === 'りんご');
await page.keyboard.press('Escape');
await page.click('.cui-header-col >> nth=2');
check('column header click selects column', await page.evaluate(() => window.sheet.selection.mode === 'columns' && window.sheet.selection.range.start.col === 2));
await page.click('.cui-header-row >> nth=3');
check('row header click selects row', await page.evaluate(() => window.sheet.selection.mode === 'rows' && window.sheet.selection.range.start.row === 3));
await page.click('.cui-viewport', { position: { x: 30, y: 10 } });
await page.click('.cui-viewport', { position: { x: 200, y: 54 }, modifiers: ['Shift'] });
check('shift+click extends selection', (await page.evaluate(() => { const r = window.sheet.selection.range; return `${r.start.row},${r.start.col}-${r.end.row},${r.end.col}`; })) === '0,0-2,1');
await page.click('.cui-corner');
check('corner selects all', await page.evaluate(() => window.sheet.selection.mode === 'all'));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
