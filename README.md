# App Audio Sandbox

`@dafuga/app-audio-sandbox` is a Playwright-powered CLI for testing app voice and
audio flows without playing sound through your speakers.

It launches or attaches to an app, injects browser audio/STT/TTS instrumentation,
records events, and can capture TTS audio artifacts while keeping playback muted by
default.

## Install

```bash
npm install -g @dafuga/app-audio-sandbox
```

## Usage

```bash
app-audio-sandbox list
app-audio-sandbox run --scenario nudge-voice-cutoff
app-audio-sandbox run --scenario nudge-voice-cutoff --record-audio
app-audio-sandbox run --scenario nudge-voice-cutoff --audible
```

`--record-audio` captures audio source files without speaker playback. `--audible`
is the only mode that allows sound to reach the speaker.

## Built-In Scenarios

- `nudge-voice-cutoff`
- `nudge-echo-filter`
- `nudge-native-tts-routing`
- `nudge-stt-warmup`

Each run writes an artifact folder with `events.json`, a Playwright trace, video,
final screenshot, and captured audio files when recording is enabled.
