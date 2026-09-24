# 入力規則

Excel の「データの入力規則」に相当します。範囲に規則を設定すると、確定時に検証され、違反した入力はエラーメッセージを表示して編集状態のまま拒否されます。

## 規則の種類

### 数値のみ(`number`)

```ts
{ type: 'number', min?: number, max?: number, integer?: boolean, allowBlank?: boolean, message?: string }
```

| プロパティ | 説明 |
| --- | --- |
| `min` / `max` | 下限 / 上限(両方指定すると「A から B の間」のメッセージ) |
| `integer` | 整数のみ |
| `allowBlank` | 空欄を許可(既定 true) |
| `message` | 既定メッセージの代わりに表示する文言 |

### リスト選択(`list`)

```ts
{ type: 'list', options: (string | number)[], allowOther?: boolean, dropdown?: boolean, allowBlank?: boolean, message?: string }
```

| プロパティ | 説明 |
| --- | --- |
| `options` | 選択肢 |
| `allowOther` | リストにない値の入力も許可(既定 false) |
| `dropdown` | セル横の ▾ ボタンを表示(既定 true)。Alt+↓ はボタンの有無にかかわらず使える |

## 範囲の指定

```ts
import { columnRange, rowRange } from 'cell-ui';

sheet.model.setValidation(columnRange(1), { type: 'number', min: 0, integer: true });        // B 列全体
sheet.model.setValidation(columnRange(2, 3), { type: 'list', options: ['A', 'B'] });          // C〜D 列
sheet.model.setValidation(rowRange(0), { type: 'list', options: ['見出し'] });                // 1 行目全体
sheet.model.setValidation({ start: { row: 1, col: 4 }, end: { row: 99, col: 4 } }, rule);   // E2:E100
sheet.model.setValidation(columnRange(1), null);                                             // 解除
sheet.model.clearValidations();                                                              // すべて解除
```

- 後から設定した規則が優先されます(重なった部分は上書き)。
- `columnRange` / `rowRange` は「列全体」「行全体」を表し、後から追加した行・列にも規則が及びます。
- 行・列の挿入 / 削除に合わせて範囲は自動で移動します。
- Undo/Redo の対象で、`toJSON()` / `load()` にも含まれます(`validations` 配列)。

## 動作

| 場面 | 動作 |
| --- | --- |
| 確定(Enter / Tab / 矢印 / 数式バー / Ctrl+Enter) | 検証し、違反ならセル下にエラーを表示して編集を継続。Esc で取り消し。`validationerror` イベントを発火 |
| リストのセルを選択 | セル横に ▾ ボタン。クリックまたは Alt+↓ でドロップダウン(↑↓ / Home / End / Enter / Esc) |
| 貼り付け / フィル / API での書き込み | 止めない(Excel と同じ)。違反セルの右上に赤いマーク |
| `sheet.validateAll()` | 違反しているセルの一覧 `{ address, message }[]` |

```ts
sheet.events.on('validationerror', ({ address, value, message, rule }) => { … });
sheet.validate({ row: 3, col: 1 }, 'abc');   // 'Please enter a number.' / null
sheet.isInvalid({ row: 3, col: 1 });         // 保存済みの値が規則違反か
sheet.getValidation({ row: 3, col: 1 });     // 適用中の規則
sheet.openListDropdown();                    // アクティブセルのリストを開く(規則が無ければ false)
```

エラーメッセージは日本語 / 英語を内蔵しています(`locale`)。`registerLocale()` で他言語を追加できます。

## 独自の規則

`registerValidator(type, fn)` で新しい規則タイプを追加できます。`fn` はエラーメッセージ(文字列)または `null`(有効)を返します。

```ts
sheet.registerValidator('email', (value, rule, address, sheet) =>
  value === null || value === '' || /^[^@\s]+@[^@\s]+$/.test(String(value)) ? null : 'メールアドレスを入力してください',
);
sheet.model.setValidation(columnRange(5), { type: 'email' });
```

プラグインの `install()` から登録し、返り値のクリーンアップ関数で解除することもできます。組み込みの `number` / `list` も同じ名前で上書きできます。

## 注意点

- 規則は「値」に対して評価します。プラグインで `meta` に数式を持たせている場合は、表示値ではなく `cell.value` が検証されます。
- 空欄の扱いは `allowBlank` で制御します。既定では空欄を許可します。
- 大量のセルを一括で書き換えたあとに違反を確認したい場合は `validateAll()` を使ってください。画面上のマークは表示中のセルにのみ描画されます。
