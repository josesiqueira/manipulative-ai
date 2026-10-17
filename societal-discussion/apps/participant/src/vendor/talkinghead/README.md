# TalkingHead (vendored)

From https://github.com/met4citizen/TalkingHead (MIT, see LICENSE), `modules/`
as of October 2026 (after v1.7.0). Local changes, both marked
"Vaalikeskustelu change" in talkinghead.mjs: the Finnish and English lip-sync
modules are imported statically so Vite can bundle them, and the default
module list is `['fi', 'en']`. `three` comes from npm (0.180.0).

Not vendored: `playback-worklet.js`, used only by the library's raw PCM streaming mode, which this app does not call.
