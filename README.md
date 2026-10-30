# RESONANT OBJECTS v0.15 — TUNING & TOUCH

v0.14のWebGL幾何学デザインと5音源・WAVE層・4種リバーブ・接続/衝突を維持した調整版。

## 更新内容

### Scale 3種類 → 12種類
- 従来: D minor / C pentatonic / F Lydian
- 追加: E minor / A Dorian / G major / A minor pentatonic / D Kurd / D Celtic / C Hirajoshi / D In Sen / C whole tone
- 7/9/11の各モードでScaleごとに音を割り当てる。11音の追加2音は各Scaleに属する音を用いる。
- 既存の3Scaleの9音部分は前版と同じ音程を維持する。
- 変更時は長押しを終了し、過去の連打履歴をリセットする。配置とConnectは変更しない。
- モード名や音名は、通常画面に追加表示しない。設定内Scaleセレクトのみ拡張。

### Touch / 表示
- 指の微小なズレで隣の発音体が繰り返し鳴ることを抑制するため、スライド先の確定に内側90%判定を採用。
- 当たり判定をわずかに拡大。ただし7/9/11で共通の物理半径・衝突半径を維持。
- 同じPointer IDの二重登録を防止。
- 中心の静止タップは指を離した時に1回、中心ドラッグは打音なし、外周タップは触れた瞬間に発音する方式を維持。
- 発音した個体の識別色で、短い輪が広がる。常時装飾・UIボタンは追加しない。

### CANDY / CERAMIC
- CANDY: 独立FM合成のまま、短い弾性音、穏やかなFM変調、軽いピッチ復帰。
- CERAMIC: 独立した短い遅延回路のまま、柔らかなサイン波の励起、控えめな高域、長い空洞共鳴。
- 他のJEWEL / METAL / WAVEエンジンと4種類のリバーブは変更しない。
- 広帯域ノイズや移動時クリック音を追加しない。

## 公開
GitHub Pagesのルートにある `index.html` を本版と置き換えてください。外部ライブラリは不要です。
`source.js` はレビュー用のJS抜粋で、単独編集してもHTMLには反映されません。

## 検証
- `node --check source.js`: PASS
- `python tests/test_v015.py`: PASS（12音階×音数、操作イベント、オフライン音響検査）
- `xvfb-run -a python tests/capture_v015.py`: PASS（Chromium SwiftShader WebGL2、844×390と667×375）
- `tests/render_material_samples.py`: Web Audio音源から直接2秒サンプルを生成

**未検証**: iPhone Safari実機での音質・遅延・発熱・連続演奏。スクリーンショットはChromiumソフトウェアGPUで取得したものです。
