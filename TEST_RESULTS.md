# Browser regression — v0.17
Viewport: 667x375 / 844x390 / 1280x720 (Chromium)
- Settings drawer open/close: PASS
- Four tab navigation and one visible category: PASS
- Scale selection (F Lydian): PASS
- Reverb selection (PRISM): PASS
- Collision toggle: PASS
- JavaScript exceptions during tested UI interactions: 0
- JS syntax: PASS
Browser tests used Playwright `page.set_content` due to restricted local navigation.
Not verified: iPhone Safari, WebGL2 GPU pipeline, audio quality/latency under load.
