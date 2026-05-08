# Feature: Audio Sandbox

## Overview

Build a global CLI package that runs application voice flows through Playwright
with speaker playback muted by default. The sandbox captures browser audio, TTS,
STT, and simulated native audio events so regressions like echo loops and failed
cutoff can be tested without relying on audible sound.

## Acceptance Criteria

- The CLI can list and run built-in scenarios.
- Nudge voice cutoff, echo-filter, native TTS routing, and STT warmup scenarios
  run against the real chat page with mocked APIs.
- Runs write `events.json`, Playwright trace/video, final screenshot, and
  optional audio files.
- Speaker playback is disabled unless `--audible` is passed.
- The package can be installed globally through its `bin` entries.

## Future Enhancements

- Add full iOS device automation when real speaker-path testing is needed.
- Add config-file based custom scenarios for non-Nudge apps.
- Mux captured audio into Playwright video when `ffmpeg` is available.
