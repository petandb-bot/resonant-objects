# RESONANT OBJECTS v0.19 — CONNECT / DELAY

v0.18をベースにした、Connectの音響的な関係と空間系エフェクトの発展版です。単体HTML、外部ライブラリ不要。

## 主な変更

### Connect
- 明示的な接続の共鳴結合係数を増加（0.145 → 0.205）。近接のみの結合との差を明確化。
- Connect相手に伝わる視覚エネルギーを増加。接続線の太さ・副線・伝播パルスを音響エネルギーに連動。
- TRANSFERモードでは接続された発音体間に、フィルターを通した短い遅延信号を送る。別の音符を発音させる仕組みではない。
- 接続解除・音数/Scale/Material変更時は、旧TRANSFER経路をフェードしてから解放。

### DELAY（SOUNDタブ）
- OFF: 原音・既存リバーブ・BLOOMの挙動を維持（初期値）。
- ECHO: 約218msと351msの2タップ、減衰するフィードバック、低域/高域フィルター。
- DRIFT: 約311msと473msの2タップ。0.075Hzの極めて緩い遅延変調を加え、穏やかな揺らぎを作る。
- TRANSFER: 明示的なConnectがある場合のみ、発音体間に遅延した共鳴信号を伝達。接続がなければ効果はほぼ発生しない。
- Delay amount: 全モード共通の効果量。既存のSPACE / Reverb / BLOOMとは独立。
- フィードバックは0.17〜0.25に制限。TRANSFERにはフィードバックGainNodeを追加せず、信号量を制限。

### オブジェクトの調整
- 角丸四角（ID 2）・縦長カプセル（ID 3）・横長カプセル（ID 7）の表示サイズを拡大。
- ピンク・黄緑・淡灰色の彩度と明度を調整し、周囲の幾何学的な形状となじませた。
- 3つの形状の内部塗りを減らして、線画としての統一感を強化。
- WebGLシェーダーとCanvas 2D互換描画の両方に同様の調整を反映。
- タッチ判定・衝突半径は変更していないため、演奏操作は従来通り。

## 使い方
1. `index.html` をGitHub Pagesの公開フォルダに配置。
2. 上部の設定ボタンを開き、SOUND → DELAY CHARACTERを選択。
3. ECHO / DRIFTはConnectなしでも使用可能。TRANSFERはConnectした発音体で試す。
4. DELAY AMOUNTを20〜40%から試す。既存のリバーブはSPACEで調整。
5. SCENE → SAVEでDelay typeとAmountを含む現在の設定を保存。

## 維持した機能
- JEWEL / CANDY / CERAMIC / METAL / WAVE
- 7 / 9 / 11 / 9+2 の独立配置・接続状態
- 12 Scale、4種類のReverb、BLOOM、Connect、Hold、ドラッグ、衝突、保存・復元
- 黒背景の幾何学的なGUI、WebGL2優先とCanvas2D互換モード

## 検証と制限
- JavaScript構文検査: PASS
- Chromium 667x375 / 844x390 / 1280x720: GUI操作テスト PASS
- Chromium Web Audio: 2タップ生成、TRANSFERの2方向接続、OFFでの経路解放、9+2/Scale/Material変更 PASS
- 保存データのDelay type / amountを模擬LocalStorageで再初期化して確認: PASS
- ブラウザのJavaScript例外: 上記の操作ではなし
- この実行環境ではGPU描画がCanvas2D互換モードにフォールバック。WebGL2実描画は未検証。
- iPhone Safari実機の音質、負荷、クリックノイズの完全解消は未検証。
