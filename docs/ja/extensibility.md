# 拡張(プラグイン API)

cell-ui のコアは「セル UI」に専念し、関数(数式)、入力補助、独自の書式などは外から差し込む設計です。すべての操作はコマンドとして登録されており、キーマップ・ツールバー・メニュー・入力と表示のフック・セルごとの `meta` を通じて拡張できます。

## プラグイン

```ts
import type { SpreadsheetPlugin } from 'cell-ui';

export const myPlugin: SpreadsheetPlugin = {
  name: 'my-plugin',
  install(sheet) {
    const off = [
      sheet.commands.register({ id: 'my.hello', run: ({ host }) => host.enterText('Hello') }),
      sheet.keymap.bind('Mod+Shift+H', 'my.hello'),
      sheet.toolbar.add({ id: 'my.hello', type: 'button', label: 'Hi', command: 'my.hello' }),
      sheet.contextMenu.add({ id: 'my.hello', label: 'Hello を入力', command: 'my.hello' }),
    ];
    return () => off.forEach((f) => f());   // 破棄時・removePlugin 時に呼ばれる
  },
};

sheet.use(myPlugin);
sheet.removePlugin('my-plugin');
// または構築時: new Spreadsheet(el, { plugins: [myPlugin] })
```

`install` が返すクリーンアップ関数は `sheet.destroy()` と `removePlugin()` で実行されます。各登録 API はクリーンアップ関数を返すので、まとめて呼び出せば安全に外せます。

## コマンド

すべてのユーザー操作はコマンド(`sheet.commands`)です。既定コマンドの一覧は [ショートカットキー](./keyboard-shortcuts.md) を参照してください。

```ts
sheet.commands.register({
  id: 'my.sum',
  label: 'AutoSum',
  run: ({ host, args, event }) => { … },     // false を返すとキー入力を「未処理」にできる
  isEnabled: ({ host }) => !host.isEditing,
});
sheet.commands.execute('my.sum', { args: 1 });   // プログラムから実行
sheet.commands.get('nav.move');                  // 既存コマンドの参照
sheet.commands.list();
```

同じ `id` で登録すると既定コマンドを上書きできます。たとえば `edit.commit` を差し替えれば確定時の挙動を変えられます。

## キーマップ

```ts
sheet.keymap.bind('Ctrl+Shift+K', 'my.cmd');                       // グリッド操作中
sheet.keymap.bind('Escape', 'my.cancel', { when: 'edit' });        // 編集中のみ
sheet.keymap.bind('Mod+S', 'my.save', { when: 'always', args: {} });
sheet.keymap.unbind('Enter');                                      // 既定の割り当てを外す
sheet.keymap.unbindCommand('insert.date');
sheet.keymap.list();
```

- `when`: `'grid'`(既定)、`'edit'`(セル編集中)、`'always'`。
- 後から登録したバインディングが優先されます。
- `Mod` は Windows/Linux で Ctrl、macOS で ⌘。記法は [ショートカットキー](./keyboard-shortcuts.md#キーの記法) を参照。
- `defaults: { keymap: false }` で既定の割り当てをすべて外し、`installDefaultKeymap(sheet.keymap)` で任意のタイミングで戻せます。

## ツールバー

```ts
sheet.toolbar.add({ id: 'sum', type: 'button', label: 'Σ', title: 'AutoSum', command: 'my.sum', order: 200,
                    isActive: (s) => …, isEnabled: (s) => … });
sheet.toolbar.add({ id: 'sep', type: 'separator', order: 199 });
sheet.toolbar.add({ id: 'unit', type: 'select', options: [{ value: 'px', label: 'px' }], getValue: (s) => …, onChange: (s, v) => … });
sheet.toolbar.add({ id: 'custom', type: 'custom', render: (s) => el, update: (s, el) => … });
sheet.toolbar.remove('strikethrough');
sheet.toolbar.refresh();   // 状態の再評価(通常は自動)
```

`order` が小さいものが左に並びます(既定項目は 0〜90)。`label` は HTML 可(SVG アイコンなど)。ボタンはクリック後にグリッドへフォーカスを戻します。

## コンテキストメニュー

```ts
sheet.contextMenu.add({ id: 'my', label: 'My action', command: 'my.cmd', shortcut: 'Ctrl+Shift+K', order: 50,
                        isVisible: (s) => s.selection.mode === 'rows', isEnabled: (s) => … });
sheet.contextMenu.add({ id: 'sep', separator: true, order: 51 });
sheet.contextMenu.remove('pasteValues');
```

## 表示と入力のフック

| API | 役割 | 戻り値 |
| --- | --- | --- |
| `addValueParser((text, address, sheet) => CellData \| CellValue \| undefined)` | 確定した文字列(および貼り付けたテキスト)をセルデータに変換 | `undefined` で次のパーサへ(最後は Excel 風の既定パーサ) |
| `addDisplayResolver((cell, address, sheet) => string \| undefined)` | セルに表示する文字列(クリップボードの `text/plain` にも使われる) | `undefined` で既定の表示 |
| `addEditTextResolver((cell, address, sheet) => string \| undefined)` | 編集開始時にエディタへ入れる文字列 | `undefined` で既定 |
| `addCellRenderer((element, cell, address, sheet) => void)` | 描画後のセル要素を装飾(クラス付与、アイコン挿入など) | – |

後から登録したものが先に評価されます。

## セルごとの `meta`

`CellData.meta` はコアが解釈しない任意のオブジェクトです。数式の元文字列、コメント、行 ID などを保持でき、コピー&ペースト(同一アプリ内)、Undo、`toJSON()` に追従します。

```ts
sheet.model.setMeta(0, 0, { formula: '=SUM(A1:A3)' });
sheet.model.setMeta(0, 0, { formula: undefined });   // キーを削除
sheet.model.getCell(0, 0)?.meta;
```

## 数式エンジンを載せる例

`examples/formula-plugin.ts` は上記のフックだけで `=SUM(A1:A3)` などを実現するサンプルです(デモの「数式プラグインを有効化」)。

```ts
sheet.addValueParser((text) => (text.startsWith('=') ? { value: null, meta: { formula: text } } : undefined));
sheet.addDisplayResolver((cell, addr) => (typeof cell?.meta?.formula === 'string' ? String(evaluate(cell.meta.formula, addr)) : undefined));
sheet.addEditTextResolver((cell) => cell?.meta?.formula as string | undefined);
sheet.addCellRenderer((el, cell) => el.classList.toggle('formula-cell', !!cell?.meta?.formula));
sheet.model.events.on('change', () => sheet.grid.scheduleRender());   // 参照先が変わったら再描画
```

## 入力規則の拡張

`sheet.registerValidator(type, fn)` で規則タイプを追加できます([入力規則](./validation.md#独自の規則))。

## イベント

| 発生源 | イベント | ペイロード |
| --- | --- | --- |
| `sheet.model.events` | `change` | `{ cells, structural, sizes, validations, label, fromHistory }` |
| | `history` | `{ canUndo, canRedo }` |
| `sheet.selection.events` | `change` | `{ active, range, anchor, mode }` |
| `sheet.events` | `editstart` | `{ address, mode }` |
| | `editcommit` | `{ address, text, cell }` |
| | `editcancel` | `{ address }` |
| | `copy` | `{ range, cut }` |
| | `paste` | `{ range, block, internal }` |
| | `fill` | `{ source, target }` |
| | `validationerror` | `{ address, value, message, rule }` |
| | `destroy` | – |

`on()` は解除関数を返します。`once()` / `off()` もあります。

## UI 文言の追加

```ts
import { registerLocale, getStrings } from 'cell-ui';
registerLocale('zh', { ...getStrings('en'), bold: '粗体', … });
new Spreadsheet(el, { locale: 'zh' });
```

## 低レベルのカスタマイズ

- `sheet.grid`(`GridView`): 描画・スクロール・座標計算。`scheduleRender()`, `scrollIntoView()`, `cellRect()`, `autoFitWidth()`, `overlayLayer`。
- `sheet.clipboard`(`ClipboardState`): 直前のコピー内容と切り取り状態。
- `installDefaultCommands` / `installDefaultKeymap` / `installDefaultToolbar` / `installDefaultContextMenu`: 既定セットの再登録。
- `openColorPicker` / `openDropdown`: ポップオーバー UI の再利用。
