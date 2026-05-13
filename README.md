# Cycli 🌸

オフラインで動作する女性のための生理周期管理 PWA（Progressive Web App）。

スマートフォンのホーム画面に追加すれば、ふつうのアプリと同じように使えます。
データは端末内に暗号化して保存され、サーバーには一切送信されません。

> ⚠️ **本アプリは医療機器ではありません。** 診断や治療の判断には使用せず、体調に不安があるときは医療機関にご相談ください。

## 主な機能

- 🌷 **予測・スケジュール** — 過去の履歴から次回の生理日・排卵日・受孕期を自動予測
- 📅 **カレンダー** — 生理予定日／排卵予定日／PMS警戒期／痩せ期・溜め込み期を一覧表示
- 📝 **記録・セルフケア** — 経血量・痛み・薬の服用・基礎体温・体重・症状・気分を簡易UIで記録
- 📊 **統計・グラフ** — 基礎体温の二相性、体重推移、周期長の推移、周期安定度スコア
- 💊 **ピル服薬管理** — 毎日の服薬チェック、14日ヒートマップ、予定時刻リマインド
- 📄 **医療機関向けレポート** — 産婦人科持参用に印刷／PDF保存できるレポート出力
- 🎯 **ライフモード切替** — 月経管理／妊活／妊娠中／ジュニア の4モード
- 🌙 **ダークモード** — ライト／ダーク／自動（OS追従）
- 🔐 **パスコード + データ暗号化** — AES-GCM で IndexedDB のメモを暗号化
- 👁 **ダミーモード** — 電卓カモフラージュ画面（＝長押し3秒で復帰）
- 💾 **エクスポート / インポート** — JSON で機種変更時のデータ移行が可能
- 📴 **オフライン動作** — Service Worker でフルキャッシュ

## 任意で記録できる項目

- 身体症状：頭痛 / 腹痛 / 腰痛 / 肌荒れ / むくみ / 眠気
- 心の状態：イライラ / 落ち込み / 不安 / やる気が出ない
- ライフスタイル：睡眠時間 / 水分摂取量 / 運動時間
- 妊活モード時：おりもの観察 / 性交記録
- 自由メモ（暗号化対象）

## 技術スタック

- **TypeScript** + **Vite** + Vanilla JS（軽量で GitHub Pages 相性◎）
- **Dexie** (IndexedDB ラッパー) でデータ永続化
- **Chart.js** でグラフ描画
- **Web Crypto API** (AES-GCM) でメモ暗号化
- **vite-plugin-pwa** + Workbox で Service Worker / manifest 自動生成

## 起動方法

### 前提

- Node.js 20 以上

### 開発

```bash
npm install
npm run dev       # http://localhost:5173 で起動
```

### 本番ビルド & プレビュー

```bash
npm run build     # アイコン生成 + 型チェック + Vite ビルド
npm run preview   # 本番ビルドをローカルで配信
```

### 利用可能な npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | Vite 開発サーバ起動 |
| `npm run build` | アイコン生成 → 型チェック → Vite 本番ビルド |
| `npm run preview` | 本番ビルドをローカル配信 |
| `npm run typecheck` | TypeScript 型チェックのみ |
| `npm run gen-icons` | PWA 用 PNG アイコン4種を再生成 |

## スマホへのインストール手順

### iPhone (iOS Safari)
1. **Safari** で公開URLを開く（Chrome等では不可）
2. 下部メニューの **共有ボタン**（□↑）をタップ
3. **「ホーム画面に追加」** を選んで「追加」

### Android (Chrome)
1. **Chrome** で公開URLを開く
2. 画面下に **「Cycliをホームに追加」** プロンプトが出たらタップ、もしくは
3. 右上の **⋮ メニュー → 「アプリをインストール」** を選択

## プロジェクト構成

```
cycli/
├── index.html              # ランディングページ（インストール案内）
├── app.html                # アプリ本体
├── manifest.webmanifest    # PWAマニフェスト（自動生成）
├── public/
│   └── icons/              # SVG + 自動生成PNG（192/512/maskable/180）
├── src/
│   ├── main.ts             # アプリエントリ
│   ├── router.ts           # ハッシュベースルーター
│   ├── db/
│   │   ├── schema.ts       # Dexie スキーマ
│   │   ├── repository.ts   # データアクセス層
│   │   └── crypto.ts       # AES-GCM 暗号化
│   ├── domain/
│   │   ├── cycle.ts        # 周期予測ロジック
│   │   ├── pregnancy.ts    # 妊娠週数計算
│   │   └── diet-advice.ts  # フェーズ別アドバイス
│   ├── views/              # 各画面（home, calendar, record, stats, pill, report, settings, dummy, onboarding）
│   ├── components/         # 再利用UI（modal, toast, passcode）
│   ├── styles/             # tokens / base / app / landing CSS
│   └── utils/              # date, theme
├── scripts/
│   └── gen-icons.mjs       # 外部依存なしのPNGアイコン生成
└── .github/workflows/
    └── deploy.yml          # GitHub Pages 自動デプロイ
```

## プライバシー

- すべてのデータは **端末内の IndexedDB** に保存され、外部へ送信されません
- メモはパスコード設定時に **AES-GCM** で暗号化保存
- 通信は HTTPS（GitHub Pages）でアセット取得のみ
- 解析・トラッキングコードは含まれません

## ライセンス

[MIT License](LICENSE)

## 注意事項

- 本アプリは医療機器ではなく、医療判断には使用できません。
- 周期予測は過去の記録の中央値に基づく統計的推定であり、生理学的な変動を完全には反映しません。
- 体調に不安がある場合は産婦人科などの医療機関にご相談ください。
- ブラウザのストレージをクリアするとデータが失われます。定期的に「設定 → エクスポート」でバックアップを取ってください。
