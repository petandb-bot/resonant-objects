# v0.20.1 Changes

- Added a 38 Hz output high-pass filter, a gentle 350 Hz low-mid cut, a 3.8 kHz presence dip, and a mild 6.9 kHz high shelf.
- Kept a single dynamics stage, calibrated the output gain and added a mostly linear oversampled soft ceiling for exceptional peaks.
- Reduced cumulative resonator returns and persistent loop gain slightly.
- Crossfade repeated WAVE notes and cap long WAVE polyphony at six to prevent sustained voices from accumulating without bound.
- Removed the +5 dB coloration from explicit Connect reflections; retained feed-forward character and Transfer delay.
- Damped Echo repeats slightly above the upper midrange without reducing their wet output level.
- Kept all five source engines, four reverb profiles, GUI, playback controls and storage keys as in v0.20.
- Removed Japanese comments from the source and replaced README with a short English version.

The DSP was checked with offline browser rendering. Device-specific listening and long-session performance remain unverified.
