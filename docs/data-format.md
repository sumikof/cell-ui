# データ形式

## スナップショット(`SheetSnapshot`)

`sheet.toJSON()` / `sheet.model.toJSON()` が返し、`sheet.load()` / `data` オプション / `<cell-ui-sheet>.data` が受け取る JSON です。

```json
{
  "rows": 100,
  "cols": 26,
  "cells": {
    "0,0": { "value": "商品", "style": { "bold": true, "backgroundColor": "#217346", "color": "#ffffff" } },
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

| キー | 内容 |
| --- | --- |
| `rows` / `cols` | 行数・列数 |
| `cells` | `"row,col"`(0 始まり)をキーにした非空セルの辞書 |
| `colWidths` / `rowHeights` | 既定値と異なる列幅 / 行高(px)。`0` は非表示 |
| `validations` | 入力規則。`end.row` / `end.col` が `Number.MAX_SAFE_INTEGER` のものは列 / 行全体 |

`load()` は内容を置き換え、1 回の Undo で戻せます。`load()` の `snapshot` は部分的でも構いません(`{ cells: {} }` でクリア)。

## セル(`CellData`)

```ts
interface CellData {
  value: string | number | boolean | null;
  style?: CellStyle;                 // 書式(docs/styling.md)
  meta?: Record<string, unknown>;    // 拡張用の任意データ
}
```

- 空文字・`null`・空の `style`・空の `meta` だけのセルは保存されません。
- 値の型は Excel の「標準」書式に準じます。入力時に数値らしい文字列は `number`、`TRUE` / `FALSE` は `boolean` になり、先頭の `'` で文字列を強制できます。

## アドレスと範囲

```ts
interface CellAddress { row: number; col: number }          // 0 始まり
interface CellRange { start: CellAddress; end: CellAddress } // start が左上、end が右下(normalizeRange で正規化)
```

A1 形式との相互変換は `addressToA1` / `a1ToAddress` / `a1ToRange` / `rangeToA1` を使います。

## 変更イベント(`ChangeEvent`)

```ts
sheet.model.events.on('change', (e) => {
  e.cells;        // 変更されたセルの CellAddress[]
  e.structural;   // 行・列の挿入 / 削除、サイズ変更
  e.sizes;        // 列幅 / 行高の変更
  e.validations;  // 入力規則の変更
  e.label;        // 'enter' | 'paste' | 'fill' | 'undo' | 'redo' | 'load' | …
  e.fromHistory;  // Undo / Redo によるもの
});
```

## 他形式との変換

- **TSV / CSV**: `serializeTsv(rows)` / `parseTsv(text)`(Excel の TSV 方言)。
- **HTML 表**: `serializeHtml(block)` / `parseHtmlTable(html)`。
- **Excel ファイル(.xlsx)**: コアには含まれません。SheetJS などで `CellData[][]` に変換して `model.setCells()` に渡すか、Excel からのコピー&ペーストを使ってください。
