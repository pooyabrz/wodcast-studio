# Development guide

## Architecture

One Node process owns the workout session. A monotonic clock drives the timer; delayed ticks catch up against the original schedule. HTTP POST requests submit actions. Server-sent events distribute complete snapshots to the control panel and OBS view. Displays interpolate between snapshots and freeze on disconnection.

Network latency can introduce a small display offset; no zero-latency guarantee is made. Closing a controller does not stop the server timer. A server restart restores the saved layout and intentionally starts a new idle timer.

The standalone preview uses a separate browser-local adapter. It is useful for visual review but does not synchronize OBS or phone browsers. Do not replace the real server transport with localStorage or BroadcastChannel.

## Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | TCP port |
| `WODCAST_DATA_DIR` | Project `data/` | Writable settings/assets directory |
| `--lan` | Off | Listen on the private network |
| `--open` | Off | Open the panel after the server is listening |

`.env.example` is a reference. The application reads shell environment variables and does not automatically load `.env` files.

Unix example:

```sh
PORT=8989 node server.mjs
```

Windows CMD:

```bat
set PORT=8989
node server.mjs
```

Update the OBS URL when changing the port. Pairing codes are generated at startup; no account credentials or API keys are required.

## Add a participant-name field

1. Add `participant: ''` to `DEFAULT_CONFIG.content` in `public/js/model.js`.
2. Add a maximum length to `TEXT_LIMITS`, for example `participant: 100`. The explicit validator then accepts the field.
3. Add `participant: true` to `DEFAULT_CONFIG.visible`.
4. Add `field('content.participant', 'Participant name')` to a suitable form in `control-app.js`.
5. Add the visibility label to `visibilityNames`.
6. Add an output element with `data-field="participant"` in `renderer.js`. Assign its value using `textContent`.
7. Style it in `overlay.css` and choose its position inside a zone.
8. Add a behavior test for saving and transferring the field, then run `npm run verify`.

This is an extension example. A participant-name feature is not implemented in version 1.1.

## Change branding

Default content and style values are in `model.js`. Replace the contents of `public/assets/wodcast-mark.svg` to change the bundled vector sample while keeping its path. End-user logos use the upload control.

Allowed logo paths are explicit. If adding a new static logo path, update the schema. Do not accept arbitrary external image URLs or user-supplied SVG source without a separate design for those inputs.

## Extend the timer

Keep time logic in `timer.js`. States: `idle`, `running`, `paused`, `finished`. Phases: `ready`, `work`, `rest`, `finished`.

An interval cycle includes its final rest. A zero-second rest omits that phase. Stopwatch time excludes lead-in and pause time. Changes to active timer settings are rejected until reset.

A future expression parser such as `2m + 30 + 1:00` must define units, validate tokens and explicitly assign work/rest labels. Such a parser and variable-duration phase sequences are outside the current scope.

## API

| Endpoint | Method | Behavior |
| --- | --- | --- |
| `/api/bootstrap` | GET | Controller state, authorization and local pairing information |
| `/api/state` | GET | Read-only snapshot |
| `/api/events` | GET | SSE state stream |
| `/api/pair` | POST | Exchange a six-digit code for a session |
| `/api/command` | POST | Timer/configuration/save/audio actions |
| `/api/logo` | POST | Upload a binary PNG/JPEG/WebP logo |
| `/api/export` | GET | Download the active portable layout |
| `/api/import` | POST | Import a versioned portable layout |

Example command:

```json
{
  "action": "configure",
  "payload": {
    "content": { "title": "My Studio" }
  }
}
```

Mutations are serialized so concurrent saves cannot race over the temporary settings file. Settings are written to a temporary file and atomically renamed. Uploads use content-derived filenames. Old logo assets are retained to preserve existing backups.

## Build and test

No build step or package installation is needed to run the server. The preview build joins the project's readable modules without minifying them. Rebuild it after source or asset changes:

```sh
npm run build:preview
npm run check
npm test
```

See `TESTING.md` for optional browser checks and current verification limits.
