# レイアウトと UI 部品

## 行数・列数

`rows` / `cols` で初期サイズを決めます。貼り付けで足りない場合は自動的に広がります。

```ts
const sheet = new Spreadsheet(el, { rows: 10, cols: 5 });
sheet.model.rowCount;             // 10
sheet.model.resize(20, 8);        // 直接変更(はみ出したセルは削除)
sheet.model.ensureSize(30, 8);    // 足りない分だけ広げる
```

## 固定サイズの表(`fitContent`)

`fitContent` を指定すると、コンポーネント自体の幅・高さが行数・列数から決まります。親要素に高さを与える必要がなく、行・列を追加するとその分だけ広がります。10 行 × 5 列のような小さな表に向いています。

| 値 | 効果 |
| --- | --- |
| `true` | 幅・高さの両方を内容に合わせる(スクロールバー無し) |
| `'height'` | 高さのみ(幅は親要素に合わせ、横スクロール) |
| `'width'` | 幅のみ |

`fitContent: true` / `'width'` の表は「固定幅」として扱われ、[列名の差し替え](#列名の差し替えcolumnlabels)が有効になります。

## 行・列の追加と削除

| 方法 | 内容 |
| --- | --- |
| `sheet.appendRows(n)` / `sheet.appendColumns(n)` | 末尾に追加(Web Component: `el.appendRows(n)` / `el.appendColumns(n)`) |
| `sheet.model.insertRows(at, n)` / `insertColumns(at, n)` | 指定位置に挿入 |
| `sheet.model.deleteRows(at, n)` / `deleteColumns(at, n)` | 削除 |
| 右クリックメニュー | 行の挿入 / 列の挿入 / 末尾に行を追加 / 末尾に列を追加 / 行の削除 / 列の削除 |
| Ctrl++ / Ctrl+- | 選択に応じて行(列)を挿入 / 削除 |
| `autoExpand` | 最終行で Enter/↓、最終列で Tab/→ を押すと 1 行 / 1 列追加。`{ rows: true }` のように片方だけも可 |

いずれも Undo/Redo の対象で、列幅・行高・入力規則の範囲も一緒に移動します。`change` イベントは `structural: true` で通知されます。

## 列幅・行高

```ts
sheet.model.setColumnWidth(0, 120);
sheet.model.setRowHeight(3, 40);
sheet.model.setColumnWidth(0, undefined);   // 既定値に戻す
sheet.model.setColumnWidth(2, 0);           // 非表示(Ctrl+0 / Ctrl+9 と同じ)
sheet.commands.execute('columns.autoFit');  // 選択列を内容に合わせる(ヘッダー境界のダブルクリックと同じ)
```

ヘッダーの境界をドラッグするとサイズ変更、ダブルクリックで自動調整です。行・列全体を選択した状態で 1 本を変更すると、選択中のすべてに適用されます(Excel と同じ)。

## UI 部品の表示 / 非表示

| 部品 | オプション | 属性 | `setVisible` の名前 |
| --- | --- | --- | --- |
| ツールバー | `toolbar` | `toolbar` | `'toolbar'` |
| 数式バー全体 | `formulaBar` | `formula-bar` | `'formulaBar'` |
| 名前ボックス(セル位置) | `formulaBar: { nameBox }` | `name-box` | `'nameBox'` |
| 関数入力欄 | `formulaBar: { input }` | `formula-input` | `'formulaInput'` |
| ステータスバー | `statusBar` | `status-bar` | `'statusBar'` |
| 右クリックメニュー | `contextMenu` | `context-menu` | `'contextMenu'` |
| 行番号ヘッダー | `headers: { rows }` | `row-headers` | `'rowHeaders'` |
| 列名ヘッダー | `headers: { cols }` | `column-headers` | `'columnHeaders'` |
| 両方のヘッダー | `headers` | `headers` | `'headers'` |
| 枠線 | `showGridlines` | `gridlines` | `'gridlines'` |
| フィルハンドル | `fillHandle` | `fill-handle` | `'fillHandle'` |

```ts
// 素の表だけを表示する
const sheet = new Spreadsheet(el, { headers: false, toolbar: false, formulaBar: false, statusBar: false, contextMenu: false });

// 後から切り替える
sheet.setVisible('toolbar', true);
sheet.isVisible('headers');
```

- 関数入力欄を消す(`formulaBar: { input: false }`)と、セル位置表示も含めてバー全体が消え、テーブル部分だけになります。名前ボックスだけを消すことは可能です(`{ nameBox: false }`)。
- ヘッダーを消しても、選択・入力・ショートカット・コピー&ペーストはそのまま使えます。ヘッダー経由の操作(列幅ドラッグ、行 / 列全体のクリック選択)は API(`setColumnWidth`、`selection.selectRows`)で代替してください。
- ツールバーの中身だけ差し替えたい場合は `defaults: { toolbar: false }` で既定ボタンを外し、`sheet.toolbar.add()` で登録します([拡張](./extensibility.md#ツールバー))。

## 列名の差し替え(`columnLabels`)

固定幅(`fitContent: true` / `'width'`)の表では、列名ヘッダーの A, B, C… を任意の文字列にできます。

```ts
const sheet = new Spreadsheet(el, { rows: 10, cols: 4, fitContent: true, columnLabels: ['品名', '数量', '単価', '備考'] });
sheet.setColumnLabels((col) => ['Item', 'Qty'][col]);   // 関数でも可。undefined を返した列は英字に戻る
```

```html
<cell-ui-sheet fit-content column-labels="品名,数量,単価,備考"></cell-ui-sheet>
<cell-ui-sheet fit-content column-labels='["品名","数量"]'></cell-ui-sheet>
```

- スクロールする通常のシートでは列が動的に増減するため無視され、コンソールに警告が出ます。
- セル参照(名前ボックス、クリップボード、プラグインの A1 表記)は英字のままです。Excel との貼り付け互換に影響しません。
- ヘッダーのサイズは `rowHeaderWidth` / `columnHeaderHeight` で変更できます。

## 選択の操作

```ts
sheet.selection.setActive({ row: 2, col: 1 });                      // B3
sheet.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 4, col: 2 } });
sheet.selection.selectRows(3, 5);
sheet.selection.selectColumns(1);
sheet.selection.selectAll();
sheet.goTo({ row: 99, col: 0 });                                    // 移動してスクロール
sheet.selection.events.on('change', (s) => console.log(s.range, s.active, s.mode));
```

`mode` は `'cells' | 'rows' | 'columns' | 'all'` で、ヘッダーのハイライトや Ctrl++ の挙動(行を挿入するか列を挿入するか)に使われます。
