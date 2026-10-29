# resonant objects v0.2 — little sound things

A complete, self-contained landscape instrument for iPhone Safari and desktop browsers.

## How to use

1. Upload `index.html` to GitHub Pages or another HTTPS static host. No dependencies, build tools, third-party scripts, fonts or network services are required.
2. Open the published link in Safari and rotate the iPhone to landscape; disable Rotation Lock if needed. The page cannot force rotation in normal Safari tabs.
3. Tap one of the nine colorful sound objects to enable audio, then continue tapping or sliding across objects. Multi-touch and chords are supported.
4. **material**: from softer metal to brighter, glass-like partials. **ring**: intrinsic modal decay, not a delay/reverb effect.
5. Choose **move things**, drag objects to change their proximity and sympathetic coupling, then choose **let’s play!**. **reset places** restores the original arrangement.
6. On desktop, use mouse or keys `1`–`9`.

## Implementation

- Primary rendering path is **WebGL 2**, with **WebGL 1** support via GLSL ES 1.00 shaders. Includes a small Canvas 2D fallback for devices where WebGL is disabled/unavailable (for example due to enterprise security policy). It does not use p5.js or Three.js.
- GPU-drawn organically irregular pads, lighting, low-contrast fine connections, paper-toned background, and touch-driven resonance rings. Note glyphs and controls remain accessible HTML elements.
- **Audio is Web Audio**, not WebGL. The sound synthesis algorithm is preserved from v0.1: nine pitches (D3 / A3 / Bb3 / C4 / D4 / E4 / F4 / G4 / A4), six modal sine partials, softened noise attack, local sympathetic resonances, dynamics compressor.
- Graph routing preserves a **future FX insertion point** (`effectInsert`): modal voices -> effectInsert (currently bypass) -> compressor -> output. Effects have not yet been added.
- Renders only when needed instead of continuously animating. Device pixel ratio capped at 1.75 for mobile performance.
- No microphone, motion-sensor, or location permissions; no data collected, saved, or uploaded.

## Known limitations and validation

- Checked in a desktop Chromium browser at 1200x700, 844x390, 667x375, and 390x844 emulated viewports. GPU/WebGL 2 initialization, rendering, clicking, drag & reset, sliders, and portrait notice worked in this test environment.
- **Physical iPhone Safari, actual two-finger touch, speaker loudness, audio latency, and thermal performance have NOT been verified**. Tune these on the target phone before treating this as a finished instrument.
- Portrait is intentionally not an instrument-playing layout; smaller phone screens show a rotation message.
- Arrangements and settings reset when the page is reloaded.
- If WebGL is disabled, the fallback uses the same note interactions and audio with a simpler visual treatment.
