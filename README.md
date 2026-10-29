# RESONANT OBJECTS v0.1

A self-contained, landscape-first playable instrument prototype for iPhone Safari and desktop browsers. No libraries, build tools or external files are required.

## Play

1. Host `index.html` over HTTPS (e.g. GitHub Pages).
2. Open the page in Safari on an iPhone and rotate to landscape. Disable Rotation Lock if needed.
3. Tap any resonant object to start audio. Play multiple objects simultaneously with two hands; slide from object to object to strike each.
4. `MATERIAL`: soft metal to glass-like partials. `DECAY`: intrinsic modal sustain.
5. `REARRANGE`: drag objects to change proximity and sympathetic coupling, then tap `DONE`.
6. Desktop testing: click pads or use keys 1-9.

## Audio

- 6 sine-wave vibration modes per strike, based loosely on 1:2:3 tuned handpan modes with weak inharmonic upper partials.
- Very short band-filtered noise mallet transient.
- Up to 2 nearby objects are excited at reduced amplitudes; proximity determines strength.
- Max 30 active oscillator banks to constrain CPU; compressor and output attenuation prevent excessive peaks.
- Effects insert node is currently clean pass-through, reserved for later reverb, frequency shifting and feedback processing.

## Limitations / testing

- This prototype has not been tested on a physical iPhone. Stereo, latency and speaker tonal balance must be evaluated on-device.
- iPhone Safari landscape orientation is not force-locked by the page; the layout instead prompts the user to rotate the device.
- REARRANGE locations and sound settings are not saved after reload.
- Not a physically exact handpan model. Sound is an artistic modal-synthesis interpretation.
