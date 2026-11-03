# v0.19 テスト記録

## 静的
- Node.js `--check`: PASS
- 外部ライブラリ不要の単体HTML構成: 維持

## ブラウザ（Chromium）
- 667x375 / 844x390 / 1280x720: 画面表示・設定開閉 PASS
- SOUND / PLAY / VISUAL / SCENE タブ切替 PASS
- DELAY OFF / ECHO / DRIFT / TRANSFER 選択 PASS
- Delay amountスライダー操作 PASS
- 9+2への切替、音源のクリックによるWeb Audio起動 PASS
- JavaScript pageerror / console error: 0（テストした操作に限る）
- 描画モード: Canvas2D COMPATIBILITY（WebGL GPU実描画は検証できず）

## Web Audio 回帰
- AudioContext unlock: running
- 9音源: 9タンク、2遅延タップ
- TRANSFERで0-1を接続: 2方向の遅延経路を生成
- OFFに切替: 0経路（フェード後にノードを解放）
- 9+2: 11タンク、Scale/Material変更後も11タンク
- 9音に復帰: 9タンク
- 実行中JavaScript例外: なし

## 保存
- 模擬LocalStorageでTRANSFERとDelay amount=73を保存し、新規ページに同じデータを注入して再初期化: PASS
- 実ブラウザの永続LocalStorageリロード: 環境のローカルHTTPアクセス制限により未検証

## 未検証
- iPhone Safari実機での演奏感、遅延音の音質、クリックノイズ
- WebGL2実描画、長時間高負荷演奏
- 実際のスピーカー・ヘッドホンでの音響測定
