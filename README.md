# Cybro Recorder

Desktop **call recorder** for web meetings (Chrome, Edge, and similar). Captures your **microphone** and **system/loopback audio** into a timestamped **WAV** under Documents.

> Not a general music or voice-memo app — built for recording calls in web calling apps.

**Targets:** macOS Apple Silicon (arm64) · Windows (x64)

## Download

Public installers ship via **GitHub Releases**. A small static landing page in `web/` is meant to be hosted on **Vercel** and points at the latest release assets (it does not build Electron binaries).

| Platform | Expected asset name |
|----------|---------------------|
| macOS Apple Silicon | `Cybro-Recorder-<version>-mac-arm64.dmg` |
| Windows (installer) | `Cybro-Recorder-<version>-win-x64-Setup.exe` |
| Windows (portable) | `Cybro-Recorder-<version>-win-x64-Portable.exe` |

Latest release page: https://github.com/asrafullfardin140-beep/call-recording/releases/latest

### Publish a release (GitHub Actions)

Workflow: [`.github/workflows/release.yml`](.github/workflows/release.yml)

1. Enable **GitHub Actions** for the repo if prompted.
2. Push a version tag, or run the workflow manually:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or: Actions → **Release** → **Run workflow** (optional tag / draft).

Runners: `macos-14` (arm64 DMG/ZIP) and `windows-latest` (NSIS + portable). Builds are **unsigned** in MVP — Gatekeeper / SmartScreen may warn.

### Deploy the download page (Vercel)

Static site lives in `web/`. Root `vercel.json` rewrites `/` → `/web/index.html`.

**Recommended:** Import the GitHub repo at [vercel.com/new](https://vercel.com/new) and set **Root Directory** to `web` (uses `web/vercel.json`). Or leave Root Directory empty and rely on the root rewrites.

```bash
# With Vercel auth (permanent project)
npx vercel --prod

# Or deploy only the web folder
npx vercel web --prod
```

This environment has no Vercel login — a permanent `*.vercel.app` URL requires you to connect the repo or claim a temporary deploy.

Preview locally: open `web/index.html` or `npx serve web`.

## Features (MVP)

- Record / Stop with live status and timer
- Default save folder: `Documents/Cybro Recorder` (created automatically)
- Timestamped filenames: `call-2026-10-25T19-16-42.wav`
- Stereo WAV when both sources are available: **L = mic**, **R = system**
- In-app permission guidance and “Open recordings folder”
- Packaging via `electron-builder` for Mac arm64 and Windows

## How call recording works

1. **Microphone** — `getUserMedia` (standard OS mic permission).
2. **System / loopback audio** — Chromium `getDisplayMedia` with Electron’s display-media handler set to `audio: 'loopback'`.
   - **Windows:** maps to **WASAPI loopback** (what you hear), which is the practical path for meeting audio from Chrome/Edge/etc.
   - **macOS:** best-effort via ScreenCaptureKit / screen-recording APIs when the OS and Electron build allow it; otherwise use a virtual audio device (below).
3. Streams are mixed in the renderer (Web Audio) and encoded as PCM **WAV** (48 kHz).

Keep the meeting tab **unmuted** and audible so loopback has signal. Cybro does not inject into the browser; it records what the OS exposes as mic + system audio.

## Run locally

**Requirements:** Node.js 18+, npm. For real system-audio capture you need Windows or macOS hardware (this repo’s CI/cloud Linux image cannot fully validate loopback).

```bash
npm install
npm start
```

Optional: `npm run dev` (same, with Chromium logging).

Syntax check (no Electron window):

```bash
npm run typecheck
```

## Build / package

```bash
# macOS Apple Silicon
npm run dist:mac

# Windows x64
npm run dist:win
```

Artifacts land in `dist/`.

| Script        | Output                          |
|---------------|---------------------------------|
| `dist:mac`    | arm64 DMG + ZIP                 |
| `dist:win`    | NSIS installer + portable EXE   |
| `pack`        | Unpacked dir only (faster)      |

Cross-compiling from Linux may need platform-specific tooling; prefer building Mac packages on a Mac and Windows packages on Windows (or a Windows CI runner).

## Permissions

### Windows

- Allow **microphone** when prompted.
- When recording starts, Chromium may show a **share screen/window** prompt so loopback audio can attach — pick a screen (video is discarded; only audio is kept).
- Meeting audio must be playing through the default output device.

### macOS (Apple Silicon)

1. **Microphone** — System Settings → Privacy & Security → Microphone → enable **Cybro Recorder**. The app can open this pane from the notice actions.
2. **Screen Recording** — required for many system-audio / ScreenCaptureKit paths. System Settings → Privacy & Security → Screen Recording → enable **Cybro Recorder**, then quit and relaunch.
3. If system audio is still missing after that, use a **virtual audio device** (recommended fallback):

#### BlackHole setup (macOS system audio fallback)

1. Install [BlackHole 2ch](https://existential.audio/blackhole/).
2. Open **Audio MIDI Setup** → create a **Multi-Output Device** including your speakers **and** BlackHole.
3. Set the Multi-Output Device as the Mac’s output while in the call (so you still hear the meeting and BlackHole receives a copy).
4. Start Cybro Recorder. If loopback via ScreenCaptureKit is unavailable, select BlackHole as an aggregate/input path in a future build — for this MVP, prefer Screen Recording first; BlackHole remains the documented escape hatch when OS loopback is blocked.

App entitlements ship in `build/entitlements.mac.plist` (mic + hardened runtime helpers). Notarization is out of scope for MVP; Gatekeeper may require “Open anyway” on unsigned local builds.

## Project layout

```
src/
  main/          Electron main process (window, IPC, paths, permissions, loopback handler)
  renderer/      UI + Web Audio recorder + WAV encoder
  shared/        Constants / IPC channel names
build/           macOS entitlements
```

## Known limitations (honest MVP)

| Area | Status |
|------|--------|
| UI Record/Stop, timer, save path, open folder | Implemented |
| Mic capture + WAV encode/save | Implemented |
| Windows WASAPI loopback via Electron `audio: 'loopback'` | Implemented in code — **needs Windows device testing** |
| macOS system audio via ScreenCaptureKit / display-media | Wired best-effort — **needs Mac hardware testing**; BlackHole documented |
| Mixing L=mic R=system | Implemented when both tracks exist; mic-only fallback with in-app warning |
| Cloud sync, accounts, transcription | **Out of scope** |
| Linux packaged product | Dev-only; not a ship target |

## License

MIT
