# 開発ガイド

## セットアップ

```bash
npm install
npm run dev          # http://localhost:5173  (/ = デモ, /embed.html = 埋め込みサンプル)
```

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite 開発サーバー |
| `npm run build` | `dist/` にビルド(ES モジュール、IIFE、CSS、型定義) |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run typecheck` | 型チェック(`src` `test` `examples` `scripts`) |
| `npm test` | ユニットテスト(vitest + jsdom) |
| `npm run test:watch` | ウォッチモード |
| `npm run e2e` | Chromium での動作確認(要 `npm run build`、Playwright 同梱の Chromium を使用) |

## テスト

### ユニットテスト(`test/`)

| ファイル | 対象 |
| --- | --- |
| `address.test.ts` | A1 参照、列ラベル、範囲 |
| `model.test.ts` | モデル、トランザクション、Undo、構造変更、JSON |
| `value.test.ts` | 値の解釈と表示 |
| `tsv.test.ts` / `html.test.ts` | クリップボード形式 |
| `keymap.test.ts` | キーコンボ |
| `spreadsheet.test.ts` | ショートカット、クリップボード、フィル、拡張 |
| `element.test.ts` | Web Component |
| `resize.test.ts` | 固定サイズ表、行・列の追加、`autoExpand` |
| `visibility.test.ts` | UI 部品の表示切り替え |
| `labels.test.ts` | 数式バーの部品、列名の差し替え |
| `validation.test.ts` | 入力規則 |

jsdom には Canvas が無いため、`test/setup.ts` で `getContext` を無効化し、文字幅は概算にフォールバックさせています。ビューポートのサイズも 0 になるため、描画されるセル数に依存する検証は避けてください。

### ブラウザ検証(`scripts/e2e.mjs`)

Vite サーバーを起動し、Playwright で `index.html` と `embed.html` を操作します。実際のクリップボード(`navigator.clipboard`)を使ったコピー&ペースト、Excel 形式 HTML の貼り付け、ツールバー、メニュー、フィルハンドル、列幅変更、Web Component、入力規則などを確認し、`e2e-out/` にスクリーンショットを保存します。

```bash
npm run build && npm run e2e
```

Chromium のパスは `/opt/pw-browsers/chromium` を想定しています。別環境では `scripts/e2e.mjs` の `executablePath` を変更するか、`npx playwright install chromium` で取得してください。

### CI

`.github/workflows/ci.yml` で push / pull request ごとに `typecheck` → `test` → `build` を実行します。

## コーディング規約

- TypeScript `strict`。未使用の変数・引数はエラー。
- DOM のクラス名は `cui-` プレフィックス。状態は `--modifier` で表す(`cui-tb-btn--active`)。
- モデル層(`src/model`, `src/clipboard`, `src/keyboard`)は DOM に依存させない(`DOMParser` のみ例外で、存在チェック付き)。
- ユーザーが行える操作はコマンドとして登録し、キー割り当ては `defaults/keymap.ts` に集約する。
- UI 文言は `i18n.ts` に追加し、ja / en の両方を用意する。

## 機能を追加するときの手順

1. モデルに必要な状態と操作を追加し、トランザクション(`writeXxx`)と `toJSON` / `load` に組み込む。
2. `Spreadsheet` に公開 API を追加し、必要なら `SpreadsheetOptions` と `setVisible` を拡張する。
3. コマンドを `defaults/commands.ts` に、キーを `defaults/keymap.ts` に、メニュー / ツールバー項目を `defaults/menu.ts` / `defaults/toolbar.ts` に登録する。
4. Web Component で扱う場合は `element.ts` の属性・`observedAttributes` を更新する。
5. ユニットテストとブラウザ検証を追加し、`docs/` を更新する。

## リリース

```bash
npm run typecheck && npm test && npm run build && npm run e2e
npm pack        # 配布用 tarball
```
