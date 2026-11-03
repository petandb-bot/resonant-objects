# v0.20 回帰テスト結果

JS syntax: PASS

## ブラウザ操作
667×375 / 844×390 / 1280×720 で Delay切替、Amount、SOUND / PLAY / VISUAL、素材切替、演奏場の基本操作を実行。JavaScript例外 0。描画は2D互換モード。

## 音響シミュレーション
CANDY（C4）0.35–0.65s RMS: 0.0000485
CERAMIC（C4）0.35–0.65s RMS: 0.02459
ECHO OFF 0.22–0.52s RMS: 0.000000
ECHO ON 0.22–0.52s RMS: 0.01196
DRIFT ON 0.55–0.85s RMS: 0.00946
非接続 0.12–0.50s RMS: 0.03109
接続あり 0.12–0.50s RMS: 0.04398
TRANSFER 0.50–1.0s RMS: 0.00620

## 音量・負荷
CANDY連打と接続: peak 0.405
CERAMIC連打と接続: peak 0.456
非有限サンプル: いずれも0。

## 保存
模擬Storageで9+2 / Transfer / Amount 61の復元とモード切替: PASS。

実機試験ではないため、主観的な音質や端末固有のノイズについては未判定。
