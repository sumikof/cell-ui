# オプション一覧

`new Spreadsheet(container, options)` の `options`(`SpreadsheetOptions`)と、Web Component `<cell-ui-sheet>` の属性の対応表です。Web Component の真偽値属性は `"false"` / `"0"` / `"off"` で無効、それ以外(空文字を含む)で有効になります。

## サイズとモデル

| オプション | 属性 | 既定 | 説明 |
| --- | --- | --- | --- |
| `rows` | `rows` | 1000 | 初期行数。貼り付けなどで必要なら自動で増える |
| `cols` | `cols` | 52 | 初期列数 |
| `defaultColumnWidth` | – | 80 | 列幅の既定値(px) |
| `defaultRowHeight` | – | 22 | 行高の既定値(px) |
| `defaultStyle` | – | Calibri 11pt | シート全体の既定書式(`CellStyle`) |
| `historyLimit` | – | 200 | Undo の履歴数 |
| `data` | `data` プロパティ | – | 初期スナップショット([データ形式](./data-format.md)) |
| `fitContent` | `fit-content` | false | `true` / `'height'` / `'width'`。行数・列数からコンポーネントのサイズを決める([レイアウト](./layout.md)) |
| `autoExpand` | `auto-expand` | false | `true` / `{ rows, cols }`。最終行で Enter/↓、最終列で Tab/→ を押すと行・列を追加 |

## UI 部品の表示

| オプション | 属性 | 既定 | 説明 |
| --- | --- | --- | --- |
| `toolbar` | `toolbar` | true | 書式ツールバー |
| `formulaBar` | `formula-bar` | true | 名前ボックス + 関数入力欄。`{ nameBox: false }` で名前ボックスのみ非表示。`{ input: false }` / `formula-input="false"` は関数入力欄を消し、セル位置表示も含めてバー全体が消える |
| – | `name-box` | true | 名前ボックス(`formulaBar: { nameBox }` に対応) |
| – | `formula-input` | true | 関数入力欄(`formulaBar: { input }` に対応) |
| `statusBar` | `status-bar` | true | 平均 / 個数 / 合計を表示するステータスバー |
| `contextMenu` | `context-menu` | true | 右クリックメニュー |
| `headers` | `headers` | true | 行番号・列名ヘッダー。`false` で両方非表示、`{ rows: false }` / `{ cols: false }` で片方のみ |
| – | `row-headers` / `column-headers` | true | ヘッダーを個別に指定 |
| `rowHeaderWidth` | – | 46 | 行番号ヘッダーの幅(px) |
| `columnHeaderHeight` | – | 22 | 列名ヘッダーの高さ(px) |
| `columnLabels` | `column-labels` | – | 列名を `['品名', '数量']` や `(col) => string` で差し替え。固定幅(`fitContent: true` / `'width'`)の表のみ有効。属性はカンマ区切りまたは JSON 配列 |
| `showGridlines` | `gridlines` | true | 枠線 |
| `fillHandle` | `fill-handle` | true | 選択範囲右下のフィルハンドル |

これらは構築後に `sheet.setVisible(part, visible)` で切り替えられます([API](./api.md#レイアウトと表示))。

## 動作

| オプション | 属性 | 既定 | 説明 |
| --- | --- | --- | --- |
| `locale` | `locale` | ブラウザ言語 | `'ja'` / `'en'`。`registerLocale()` で追加可能 |
| `pasteColumnWidths` | – | false | HTML 表を 1 セルに貼り付けたとき、表の列幅も適用する |
| `plugins` | `options` プロパティ | – | 構築時に `use()` するプラグインの配列 |
| `defaults.keymap` | – | true | `false` で既定のキー割り当てを登録しない |
| `defaults.toolbar` | – | true | `false` で既定のツールバー項目を登録しない(独自ツールバーを組む場合) |
| `defaults.contextMenu` | – | true | `false` で既定のメニュー項目を登録しない |

## Web Component 固有

| 名前 | 種別 | 説明 |
| --- | --- | --- |
| `sheet` | プロパティ | 内部の `Spreadsheet` インスタンス(接続後) |
| `whenReady` | プロパティ | `Promise<Spreadsheet>`。パース時点で即座に初期化されるため `ready` イベントより確実 |
| `options` | プロパティ | 接続前に設定すると構築オプションに合成(`plugins`, `defaults`, `data` など属性で表せないもの) |
| `data` | プロパティ | スナップショットの取得 / 設定 |
| `appendRows(n)` / `appendColumns(n)` | メソッド | 末尾に行・列を追加 |
| `ready` / `change` / `selectionchange` / `editcommit` / `paste` / `copy` | イベント | `CustomEvent`(`detail` に内容)。`composed: true` で Shadow DOM 外に届く |

## 例

```ts
const sheet = new Spreadsheet(el, {
  rows: 10,
  cols: 5,
  fitContent: true,
  autoExpand: { rows: true },
  headers: { rows: false },
  columnLabels: ['品名', '数量', '単価', '税率', '備考'],
  formulaBar: false,
  statusBar: false,
  locale: 'ja',
});
```

```html
<cell-ui-sheet rows="10" cols="5" fit-content auto-expand="true" headers="false"
               column-labels="品名,数量,単価,税率,備考" formula-bar="false" status-bar="false" locale="ja">
</cell-ui-sheet>
```
