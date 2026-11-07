# 日本の時間地図 — 全国鉄道版

`dist/index.html` を開くと試せます。APIキーやビルドは不要です。家賃表示も試す場合はローカルHTTPサーバーで開いてください。全国の駅を検索して出発地・目的地に設定し、所要時間で歪む地図を表示します。

- 東京側の駅・路線・代表区間時分は [東京の距離](https://github.com/vzwtim/tokyo-time-map) のコミット `cdf1d43011e8b697da7367d7b953ad94326e42ed` をクローンし、UI・描画・経路エンジンを継承。
- 全国の駅と線路は [国土数値情報 鉄道データ N02-25](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html) を加工。地図の海岸線は [Natural Earth 1:10m](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) を加工。
- 国土数値情報の `N02-25_RailroadSection.geojson`、`N02-25_Station.geojson` と Natural Earth の `ne_10m_admin_0_countries.geojson` を `countries.json` として同じディレクトリに置き、`python tools/build-geodata.py <入力ディレクトリ>` で地理データを再生成できます。
- 時刻は区間時分・速度・代表待ち時間による試算です。全国の快速・特急・直通・乗換は一部を反映しています。沖縄や一部のケーブルカーなど、鉄道で接続していない路線は各路線内で探索できます。収録基準は2025年12月末です。初回の発車待ちは東京版と同じく所要時間に含めていません。地図内の路線は隣接駅間を簡略化して描画します。

`npm run build` と `npm test` で構文・既存東京版の回帰・広域経路を確認できます。
