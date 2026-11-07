# v0.20.1 Verification

## Static checks
- JavaScript syntax: PASS (`node --check`).
- No Japanese-language comments or UI strings remain in `index.html`.
- README is short and English-only.
- Existing material types, reverb presets, object layouts, and storage keys are unchanged.

## UI regression (Chromium, Canvas 2D fallback)
- Viewports: 667 × 375, 844 × 390, and 1280 × 720.
- Tested: settings drawer, four tabs, all four delay modes, four reverb presets, 9+2 mode, Ceramic material.
- Browser JavaScript exceptions during these interactions: 0.

## Web Audio offline rendering (44.1 kHz)
Nominal scenario: ten notes, multiple connections, room mix 75, Bloom 50, Delay 65.
No non-finite samples or clipped samples were observed in the tested material scenarios.

Stress scenario: 22 strikes over approximately 1.2 seconds, nine connected resonators, Delay 100, Space 100, Bloom 100, Master 100, Bond 100.

| Material | Highest absolute sample (v0.20.1) | Clipped samples | Non-finite samples |
|---|---:|---:|---:|
| Jewel | 0.832 | 0 | 0 |
| Candy | 0.710 | 0 | 0 |
| Ceramic | 0.843 | 0 | 0 |
| Metal | 0.801 | 0 | 0 |
| Wave | 0.861 | 0 | 0 |

By comparison, v0.20 reached 1.236 in the Wave stress scenario (527 samples at or above 0.98). This was the strongest identified clipping risk.

## Limitations
- No iPhone Safari hardware audio, headphone listening, or continuous multi-hour performance test was performed.
- Browser screenshots used Canvas 2D compatibility mode; WebGL 2 rendering was not verified on this machine.
- A numerical peak result cannot establish subjective sound quality; compare by listening on the target device.
