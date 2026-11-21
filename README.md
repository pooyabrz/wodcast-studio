<p align="center"><img src="public/assets/wodcast-mark.svg" width="76" alt="WODCAST logo"></p>

# WODCAST Studio

**Your workout. Live.** A local-first HTML5 workout studio with a separate control panel and transparent OBS overlay.

Control the timer, update your workout, change your branding and connect a phone on the same private network. The full application uses Node.js built-ins and browser APIs with **zero runtime package dependencies**.

All repository code, interface text, comments, documentation and GitHub templates are in English.

## Start in one minute

Install a supported [Node.js LTS release](https://nodejs.org/), version 22 or later. Download or clone the repository, then run:

```sh
npm start
```

No dependency installation is required for normal operation.

| View | Address |
| --- | --- |
| Control panel | `http://127.0.0.1:8787/` |
| Transparent overlay | `http://127.0.0.1:8787/overlay.html` |

Keep the terminal open during the session. Stop with Ctrl+C. Windows and macOS launchers are also included; Linux users can run `sh start-linux.sh`. If a macOS launcher needs execute permission, run `chmod +x *.command` or use `npm start`.

## Try the standalone preview

Open **[WODCAST-Preview.html](WODCAST-Preview.html)** in your browser. Scripts, styles and sample SVG assets are embedded in the file. It supports timer controls, design changes, logo upload and layout import/export.

The preview runs while its browser page stays open and saves in that browser. OBS and phone control use the full server version. A preview output window requires pop-ups to be allowed.

## Features

- Three configurable zones: brand, timer and workout information.
- Transparent 1920 x 1080 base canvas with proportional 16:9 scaling.
- Responsive, separate control panel and read-only overlay view.
- Countdown/time cap, stopwatch, lead-in, repeated work/rest intervals and round display.
- AMRAP, EMOM and TABATA timer presets.
- Start, pause, resume and confirmed reset, plus focused-panel keyboard shortcuts.
- Text, coach, notes, clock, system font choices, sizes, colors and alignment.
- PNG/JPEG/WebP logo upload, replacement and removal.
- Element visibility, zone coordinates/dimensions and whole-zone fade.
- Explicit sound activation on one selected control panel.
- Saved settings, portable JSON layouts with embedded uploaded logos, default reset.
- Pairing-code phone/tablet control on the same trusted network.
- Readable source, tests, examples, launchers and GitHub workflows.

The [scope table](docs/SCOPE.md) lists each included, limited and future feature.

## Normal workflow

1. Choose a timer preset or enter your times and select **Apply timer**.
2. Edit session content and select **Apply content**.
3. Update your logo and design if needed.
4. Select **Save layout** to keep the active settings.
5. Add the overlay URL above your camera in OBS and start the session.

Form edits go live when applied. Timer settings are locked during a running or paused session; reset first. Content and appearance can change during a session.

The server owns the timer. Closing the panel or refreshing the OBS page does not reset it. A disconnected display freezes and shows **SYNC LOST** until it receives the current state. A server restart restores saved settings and starts the timer safely in Ready.

## Phone control

```sh
npm run start:lan
```

Connect the computer and phone to the same private Wi-Fi. Open **Connections** on the computer, enter the displayed computer URL on the phone and enter the six-digit code. The code changes on restart. Sessions expire after twelve hours.

The normal launcher binds to localhost. LAN mode binds to the local network and uses HTTP. Internet remote control and public hosting need a separate deployment/access design. No router port forwarding is required for local phone control.

## OBS and Zoom

Add a Browser Source in OBS with the overlay URL, width **1920** and height **1080**, above your camera. Start **OBS Virtual Camera** and select it in Zoom.

Sound cues originate in the control browser after **Enable sound cues** is clicked. Capture that browser's audio in OBS, or share computer audio separately in Zoom. The virtual camera is the video path. Check the received picture and sound from a second device.

See [Streaming setup](docs/STREAMING.md). Actual OBS/Zoom and physical phone tests remain target-system acceptance tasks. 1080p is the canvas size; Zoom's received quality depends on its account, settings, hardware and network.

## Save, back up and transfer

- **Save layout:** writes `data/settings.json` using an atomic file replacement.
- Uploaded logos: `data/assets/`.
- **Export layout:** downloads JSON with the active configuration and uploaded logo embedded.
- **Import layout:** loads that file on another studio; save afterward.
- Full backup: copy the project folder including `data/`.

Runtime data, local environment files and installed packages are excluded from Git. The repository ships with sample content only.

## Verification and GitHub

```sh
npm run verify
```

This checks JavaScript syntax, HTML references and the English source policy, runs Node tests, and rebuilds the standalone preview. GitHub Actions is configured for Node 22/24 on Linux, Windows and macOS.

An optional manual browser workflow and [browser smoke script](scripts/browser-smoke.mjs) are included. Browser execution was blocked by the development container, so no browser pass or practical OBS/Zoom pass is claimed. See [Testing and verification](docs/TESTING.md).

To upload this project, follow **[GitHub setup](docs/GITHUB.md)**. The ZIP is source ready for a repository; it does not create or publish a GitHub repository automatically. GitHub Pages can host a standalone preview, while the full control/overlay synchronization needs the Node server.

## Source map

| Path | Responsibility |
| --- | --- |
| `server.mjs` | Command-line entry point and launch behavior |
| `lib/studio.mjs` | HTTP, SSE, shared state, files and serialized mutations |
| `lib/access.mjs` | Pairing, sessions and rate limits |
| `public/control.html` | English studio interface |
| `public/overlay.html` | Transparent output |
| `public/js/model.js` | Defaults, schema validation and presets |
| `public/js/timer.js` | Deterministic monotonic timer engine |
| `public/js/client.js` | Server transport and standalone-preview adapter |
| `public/js/renderer.js` | Shared overlay renderer |
| `public/js/control-app.js` | Forms, user actions, audio and keyboard controls |
| `public/css/`, `public/assets/` | Styles and original SVG sample assets |
| `test/`, `scripts/` | Automated verification and preview build |
| `examples/` | Importable example layout files |

Read [Development](docs/DEVELOPMENT.md), [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), [Third-party notices](THIRD-PARTY-NOTICES.md) and [License](LICENSE).
