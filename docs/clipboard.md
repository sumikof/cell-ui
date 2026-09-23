# クリップボード(Excel 連携)

cell-ui と Microsoft Excel(および Google スプレッドシート、LibreOffice、ブラウザ上の表)との間で、値と書式をコピー&ペーストできます。

## 仕組み

コピー時にクリップボードへ 2 種類のデータを書き込みます。

| MIME | 内容 |
| --- | --- |
| `text/plain` | Excel と同じ TSV。セル区切りはタブ、行区切りは CRLF。改行・タブ・引用符を含むセルは `"…"` で囲み、内部の `"` は `""` にする |
| `text/html` | `<table>`。各 `<td>` にインライン CSS(`font-weight`, `color`, `background`, `text-align`, `vertical-align`, `border-*`, `white-space`, `mso-number-format`)と `x:num` / `x:bool` / `x:str` 属性を付ける。列幅は `<col width>`、行高は `<tr height>` |

Excel は `text/html` を優先して読み、書式ごと貼り付けます。貼り付け時はその逆で、`text/html` に `<table>` があれば解析し、無ければ `text/plain` を TSV として解析します。

## Excel → cell-ui で復元されるもの

Excel が生成する HTML は `<style>` ブロックのクラス(`.xl65 { … }`)、`td` の既定値、インライン `style`、`<b>` `<i>` `<u>` `<s>` `<font>` などで書式を表します。これらを解決して次を復元します。

| 項目 | 元になる CSS / 属性 |
| --- | --- |
| 値 | `x:num`(数値)、`x:bool`、テキスト。数値らしい文字列は数値に、TRUE/FALSE は真偽値に変換 |
| 太字 / 斜体 / 下線 / 取り消し線 | `font-weight`, `font-style`, `text-decoration`, `<b>` `<i>` `<u>` `<s>` |
| 文字色 / 塗りつぶし | `color`, `background(-color)`, `bgcolor`, `<font color>`。名前付き色・`rgb()`・`windowtext` を `#rrggbb` に正規化 |
| フォント / サイズ | `font-family`, `font-size`(pt / px / em / % を pt に換算) |
| 配置 | `text-align`, `vertical-align`, `align`, `valign` |
| 折り返し | `white-space`(`normal` → 折り返し、`nowrap` → なし) |
| 罫線 | `border`, `border-top/right/bottom/left`。太さ(pt / px)から thin / medium / thick、線種 dashed / dotted / double |
| 数値書式 | `mso-number-format`(`CellStyle.numberFormat` に保持。コアは解釈しない) |
| 結合セル | `colspan` / `rowspan` の分だけ空セルを置く(左上に値) |
| 複数行 | `<br>` → 改行 |

## 貼り付けの規則(Excel と同じ)

- 貼り付け先が 1 セルなら、ブロックの大きさで貼り付けます。足りない行・列は自動で増えます。
- 選択範囲がブロックの整数倍なら、タイル状に繰り返して貼り付けます(1 セルをコピーして範囲に貼ると全セルに入る)。
- 切り取り(Ctrl+X)後の貼り付けは元の範囲を消去します(値・書式・meta)。Esc で切り取り状態を解除できます。
- Ctrl+Shift+V(値のみ貼り付け)は書式を捨て、貼り付け先の書式を保ちます。
- 同一アプリ内の貼り付けは内部ペイロードを使うため、プラグインが `meta` に保存したデータもそのまま移動します。
- 入力規則は貼り付けを止めません。違反セルには赤いマークが付きます([入力規則](./validation.md))。
- `pasteColumnWidths: true` を指定すると、1 セルへの貼り付け時に HTML 表の列幅も適用します。

## API

```ts
// クリップボードイベントを介さない読み書き
sheet.copyToClipboard(false);                       // navigator.clipboard.write(フォールバックあり)
sheet.pasteFromClipboard({ valuesOnly: true });     // navigator.clipboard.read(Firefox は text/plain のみ)
sheet.pasteData({ html, text });                    // 任意のデータを貼り付け(サーバーから受け取った表など)

// 低レベル API
import { buildClipboardPayload, parseHtmlTable, parseTsv, serializeHtml, serializeTsv, styleToCss } from 'cell-ui';
const payload = buildClipboardPayload(sheet.model, range);   // { text, html, block, range }
const table = parseHtmlTable(html);                          // { cells, columnWidths, rowHeights } | null
```

イベント: `sheet.events.on('copy', ({ range, cut }) => …)`, `sheet.events.on('paste', ({ range, block, internal }) => …)`。

## ブラウザごとの注意

- キーボード操作(Ctrl+C/X/V)は `copy` / `cut` / `paste` イベントを使うため、権限なしにすべてのブラウザで動作します。
- ツールバーやメニューからのコピー / 貼り付けは非同期 Clipboard API を使います。HTTPS(または localhost)が必要で、貼り付けはブラウザによって許可ダイアログが出ます。Firefox は HTML の読み取りに非対応のため `text/plain` にフォールバックします。
- Chrome の Clipboard API で読み戻した HTML はサニタイズされますが、Excel は元データをそのまま受け取ります。
- Excel for Mac、Numbers、Google スプレッドシートも同じ HTML / TSV 形式を扱います。
