# 東京の距離 / TOKYO TIME WARP

東京の移動時間を距離へ変換するインタラクティブ地図。家賃比較・沿線断面・808駅の経路モデルを収録。

## Cloudflare Workers Builds

- Repository: `vzwtim/tokyo-time-map`
- Production branch: `main`
- Root directory: `/`
- Build command: `npm run build`（省略も可）
- Deploy command: `npx wrangler deploy`
- Worker name: `tokyo-time-map`

`wrangler.jsonc` の `assets.directory` が `dist` を指定します。ビルドによる変換は不要です。GitHub連携済みのCloudflare Workers Buildsがmainへのpushを検出して公開します。認証情報はリポジトリに保存しません。

## Local verification

`npm run build` / `npm test`

## Included UX updates

- 常時表示の家賃ボタンと「時間で探す／家賃で比べる」
- 切替パネル・金額カードのアニメーションと安い順の明示
- 約110pxの行き先カード、経路の折りたたみ、レイヤー設定撤去

家賃は固定スナップショット、所要時間はモデル上の概算です。詳細は地図内の説明を参照してください。
