# RESONANT OBJECTS v0.17 — SETTINGS WORKFLOW

v0.16.1をベースに、音響エンジンと演奏フィールドは変更せず、設定画面を4カテゴリに再配置。

- SOUND: Scale・音数・素材・Brightness/Ring・Space/Reverb/Bloom・Bond/WAVE
- PLAY: Play Feel・Expression・Hold・Drag Sound・Collision・Live Link・Thread・Lock
- VISUAL: GPU Aura・Trace・Graphics Quality・Motion・Note names
- SCENE: Scene切替・Shuffle/Save・接続解除・配置リセット・Lab

既存の28種類の設定コントロールを維持。新しい音響パラメータは追加していません。
各カテゴリはタブ切替、キーボードの左右/Home/Endにも対応。小型横画面はスクロールで全項目にアクセス可能。
音源5種類、12 Scale、7/9/11/9+2、4種類のリバーブ、Connect、WebGL2、保存処理はv0.16.1と同じです。

検証:
- Node.js JavaScript構文検査: PASS
- Chromium 844x390、667x375、1280x720で設定画面のタブ、Scale、Reverb、Collision切替: PASS
- JavaScript例外: これらの操作では検出なし
- iPhone Safari実機でのタッチ・音質・GPU負荷: 未検証
- ChromiumのGPU実描画および長時間演奏の音響テスト: 今回は未実施
