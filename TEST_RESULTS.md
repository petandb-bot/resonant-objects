# v0.21 — Test results

- JavaScript (`node --check`): PASS.
- Chromium settings and interaction smoke test at 844x390 and 667x375: PASS; no unhandled JavaScript exceptions after fix.
- Offline Web Audio: connected vs. disconnected tests on all five material engines: PASS.
- Overall RMS of a single-note connected test increased by 21–36%, depending on material. Changes are not limited to loudness: target-pitch components are now present.
- A target-tone test with CANDY D4 connected to A4 showed the 440 Hz component approximately 77 times stronger than the disconnected control (the test had no room effect).
- Stress test: 22 note events across 9 linked objects, maximum Master, Bond, Bloom, Space, and TRANSFER delay. Peak samples: JEWEL 0.790, CANDY 0.640, CERAMIC 0.856, METAL 0.798, WAVE 0.861. No sample exceeded 0.98; no non-finite samples.
- iPhone Safari audio, physical speakers, long-duration battery/CPU behavior, and WebGL2 GPU rendering: NOT TESTED.

The tests verify signal behavior and absence of detected clipping in the stated scenarios; they do not establish subjective timbral quality.
